# FleetGuard — API Contract

Single source of truth for request/response shapes. **Frontend, backend, and Lambda must match
this document.** TypeScript types in `frontend/src/types/fleet.ts` and Pydantic models in
`backend/app/schemas/fleet_data.py` must stay in sync.

**Base URLs (after deploy):**

| Path | Env var | Example |
| --- | --- | --- |
| A — Real-time | `NEXT_PUBLIC_API_URL` | `https://abc123.execute-api.us-west-2.amazonaws.com` |
| B — Batch | `NEXT_PUBLIC_BATCH_API_URL` | `https://vxyrxhcfwr.us-west-2.awsapprunner.com` |

**Common:** JSON responses use `Content-Type: application/json`. CORS: `Access-Control-Allow-Origin: *` (demo).

---

## Path A — Real-time (Lambda + API Gateway)

### A1. `POST /score`

Score one or more telemetry pings. **`fuel_delta` is not sent by the client** — Lambda computes it
from `vehicle-state`.

**Request**

```http
POST /score
Content-Type: application/json
```

```json
{
  "pings": [
    {
      "vehicle_id": "LG-1001",
      "timestamp": "2025-01-26T15:19:00",
      "lat": 6.455,
      "lng": 3.395,
      "speed_kmh": 45.2,
      "fuel_level_pct": 62.5,
      "engine_on": 1,
      "idle_minutes": 5,
      "hour": 15,
      "day_of_week": 0,
      "is_working_hour": 1,
      "zone_distance_deg": 0.012
    }
  ]
}
```

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `vehicle_id` | string | yes | e.g. `LG-1001` |
| `timestamp` | string | yes | ISO or `YYYY-MM-DD HH:MM:SS` |
| `lat`, `lng` | number | yes | GPS |
| `speed_kmh` | number | yes | |
| `fuel_level_pct` | number | yes | 0–100 |
| `engine_on` | 0 \| 1 | yes | |
| `idle_minutes` | number | yes | |
| `hour` | 0–23 | yes | |
| `day_of_week` | 0–6 | yes | Monday = 0 |
| `is_working_hour` | 0 \| 1 | yes | |
| `zone_distance_deg` | number | yes | Distance from nearest approved zone |

**Response `200`**

```json
{
  "processed": 1,
  "anomalies": 1,
  "results": [
    {
      "vehicle_id": "LG-1001",
      "timestamp": "2025-01-26T15:19:00",
      "is_anomaly": true,
      "score": -0.4521,
      "report": "Vehicle LG-1001 triggered an anomaly at 15:19..."
    }
  ]
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `processed` | int | Count of pings scored |
| `anomalies` | int | Count where `is_anomaly === true` |
| `results[].is_anomaly` | boolean | IsolationForest prediction |
| `results[].score` | number | Lower = more suspicious |
| `results[].report` | string \| null | Bedrock text; null if not anomaly |

**Errors**

| Status | Body |
| --- | --- |
| `400` | `{ "error": "No pings provided" }` |
| `500` | `{ "error": "Internal error message" }` |

---

### A2. `GET /incidents`

Recent incidents for Live Monitor. Sorted **newest first**.

**Request**

```http
GET /incidents?limit=50&vehicle_id=LG-1001&source=realtime
```

| Query | Type | Default | Notes |
| --- | --- | --- | --- |
| `limit` | int | 50 | Max items returned |
| `vehicle_id` | string | — | Filter by vehicle (uses GSI) |
| `source` | string | — | `realtime` \| `batch` |

**Response `200`**

```json
{
  "incidents": [
    {
      "incident_id": "LG-1001_2025-01-26T15:19:00",
      "vehicle_id": "LG-1001",
      "timestamp": "2025-01-26T15:19:00",
      "source": "realtime",
      "anomaly_score": "-0.4521",
      "lat": "6.455",
      "lng": "3.395",
      "speed_kmh": "45.2",
      "fuel_level_pct": "62.5",
      "fuel_delta": "-18.5",
      "idle_minutes": "5",
      "report": "Vehicle LG-1001 triggered an anomaly...",
      "created_at": "2025-01-26T15:19:05.123Z"
    }
  ]
}
```

> DynamoDB stores numeric telemetry as strings in Path A. Frontend must `parseFloat` where needed.

---

## Path B — Batch (FastAPI on App Runner)

### B1. `GET /healthz`

**Response `200`**

```json
{
  "status": "ok",
  "model_loaded": true,
  "model_path": "/app/models"
}
```

Used by App Runner health checks. `model_loaded` confirms scoring artifacts are readable.

---

### B2. `POST /api/v1/analyze-fleet`

Upload a trip-log CSV; receive scored rows and top anomaly insights.

**Request**

```http
POST /api/v1/analyze-fleet
Content-Type: multipart/form-data
```

| Part | Type | Required |
| --- | --- | --- |
| `file` | CSV file | yes |

**CSV required columns:** see [data_schema.md](data_schema.md). Optional label columns
(`is_anomaly`, `anomaly_type`) are ignored for scoring but may appear in response for demo eval.

**Response `200`**

```json
{
  "summary": {
    "total_rows": 4800,
    "total_vehicles": 10,
    "anomaly_count": 576,
    "anomaly_rate_pct": 12.0,
    "breakdown": {
      "fuel_theft": 188,
      "route_deviation": 181,
      "private_use": 123,
      "excessive_idle": 78
    }
  },
  "rows": [
    {
      "vehicle_id": "LG-1001",
      "timestamp": "2025-01-26T15:19:00",
      "lat": 6.455,
      "lng": 3.395,
      "speed_kmh": 45.2,
      "fuel_level_pct": 62.5,
      "fuel_delta": -2.1,
      "is_anomaly": false,
      "score": 0.1234,
      "anomaly_type": "normal"
    }
  ],
  "anomalies": [
    {
      "vehicle_id": "LG-1003",
      "timestamp": "2025-01-26T15:19:00",
      "lat": 6.373,
      "lng": 3.047,
      "score": -0.6745,
      "anomaly_type": "route_deviation",
      "report": "Vehicle LG-1003 was detected far outside approved delivery zones..."
    }
  ]
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `summary` | object | Fleet-level stats for dashboard cards |
| `rows` | array | Full scored dataset (paginate in UI if large) |
| `anomalies` | array | Top-N only; includes Bedrock `report` |
| `rows[].score` | number | Anomaly score (lower = more suspicious) |
| `rows[].is_anomaly` | boolean | Model prediction |

**Errors**

| Status | Body |
| --- | --- |
| `400` | `{ "detail": "Missing required column: fuel_level_pct" }` |
| `413` | File too large |
| `422` | FastAPI validation error |
| `500` | `{ "detail": "Scoring failed: ..." }` |

---

## Shared types (TypeScript / Pydantic names)

Use these names consistently across frontend and backend:

| Name | Used in |
| --- | --- |
| `TelemetryPing` | Path A request ping object |
| `ScoreResult` | Path A `results[]` item |
| `Incident` | Path A `incidents[]` item |
| `TripLogRow` | Path B CSV row / `rows[]` item |
| `AnomalyReport` | Path B `anomalies[]` item |
| `FleetSummary` | Path B `summary` object |
| `AnalyzeFleetResponse` | Path B full response |

---

## Parity rule (critical)

Given the same telemetry row (after server-side `fuel_delta` computation):

```
Path A score(row) === Path B score(row)   // same is_anomaly and score (±1e-4)
```

Enforced by `ml/tests/test_inference_parity.py` (planned).

---

## Versioning

| API | Version prefix | Notes |
| --- | --- | --- |
| Path A | none (`/score`, `/incidents`) | API Gateway stage can be `v1` in URL |
| Path B | `/api/v1/` | Bump on breaking CSV/response changes |

---

## Related docs

- [data_schema.md](data_schema.md) — CSV columns and feature list
- [app_flow.md](app_flow.md) — when each endpoint is called
- [../fleetguard_prep/docs/technicals.md](../fleetguard_prep/docs/technicals.md) — env vars, IAM, deploy
