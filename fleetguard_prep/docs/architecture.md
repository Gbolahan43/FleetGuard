# FleetGuard - Architecture

FleetGuard is a **hybrid fleet-intelligence platform**: it monitors vehicle telemetry in **real
time** (primary) and lets operators **upload trip logs for on-demand anomaly analysis** (secondary).
Both paths share the same IsolationForest model and Bedrock incident insights.

## Design principles

- **Score on arrival (primary)** - telemetry pings are scored as they arrive; fuel theft and route
  abuse need fast flagging, not end-of-day reports.
- **Batch audit on demand (secondary)** - operators upload a CSV to answer "was anything
  suspicious in this log?" without waiting for a live stream.
- **One model, two entry points** - identical feature engineering and IsolationForest scoring so
  results are consistent across real-time and batch.
- **Serverless first for real-time** - Lambda + API Gateway scale-to-zero for bursty telemetry.
- **Container for batch** - FastAPI on App Runner handles multipart CSV uploads and pandas batch
  scoring without Lambda size/cold-start constraints.
- **Decoupled model storage** - IsolationForest + scaler live in S3; both paths load from the same
  prefix. Retrain = re-upload.
- **Explainability via GenAI** - each anomaly becomes a human-readable incident report (Bedrock).

---

## Monorepo layout

```
fleetguard-monorepo/
├── .github/workflows/aws-deploy.yml   # OIDC CI/CD
├── backend/                           # FastAPI batch service (Path B)
│   ├── app/
│   │   ├── api/v1_router.py           # POST /api/v1/analyze-fleet
│   │   ├── core/{config,aws_client}.py
│   │   ├── ml_engine/
│   │   │   ├── generate_mock.py
│   │   │   ├── train_model.py
│   │   │   └── inference_core.py      # shared scoring logic
│   │   ├── schemas/fleet_data.py
│   │   ├── services/{inference,agent_bedrock}.py
│   │   └── main.py
│   ├── requirements.txt
│   └── Dockerfile                     # App Runner image
├── fleetguard_prep/                   # Real-time path (Path A) — existing ML prep
│   ├── src/
│   │   ├── fleetguard_lambda_handler.py
│   │   ├── fleetguard_generate_data.py
│   │   ├── fleetguard_train.py
│   │   └── fleetguard_replay.py
│   ├── models/                        # trained artifacts (source of truth)
│   └── infra/template.yaml            # SAM: Lambda + API Gateway + DynamoDB
├── frontend/                          # Next.js dashboard (both paths)
│   └── src/{app,components,hooks,lib,types}
└── docs/
```

> `fleetguard_prep/` holds the proven ML pipeline and Lambda handler. `backend/ml_engine/` should
> import or mirror `inference_core` so batch and real-time scores never diverge.

---

## Reference architecture (hybrid)

```mermaid
flowchart TB
  subgraph primary [Path A - Primary: Real-time monitoring]
    dev["Telematics / GPS / CSV replayer"]
    apigw["API Gateway HTTP"]
    scorefn["Lambda: ScoreFn (container)"]
    state["DynamoDB: vehicle-state (last ping)"]
    dev -->|"POST /score {pings}"| apigw --> scorefn
    scorefn --> state
  end

  subgraph secondary [Path B - Secondary: Batch audit]
    op["Operator uploads trip CSV"]
    fastapi["FastAPI on App Runner"]
    op -->|"POST /api/v1/analyze-fleet"| fastapi
  end

  subgraph shared [Shared intelligence layer]
    s3m["S3: model + scaler + feature_cols"]
    infer["IsolationForest (12 features)"]
    br["Bedrock (Claude 3.5 Sonnet / Haiku)"]
    ddb["DynamoDB: fleetguard-incidents"]
    cwl["CloudWatch"]
  end

  subgraph ui [Next.js dashboard - AWS Amplify Hosting]
    mgr["Fleet manager"]
    amp["Amplify app — frontend/"]
    live["Live Monitor tab"]
    audit["Analyze Logs tab"]
  end

  scorefn --> s3m
  fastapi --> s3m
  scorefn --> infer
  fastapi --> infer
  scorefn -->|"anomaly"| br
  fastapi -->|"top-N anomalies"| br
  scorefn -->|"source=realtime"| ddb
  fastapi -. optional .->|"source=batch"| ddb
  scorefn --> cwl
  fastapi --> cwl

  mgr --> amp
  amp --> live
  amp --> audit
  live --> apigw
  audit --> fastapi
```

---

## Path A — Real-time monitoring (primary)

**Purpose:** Catch fuel theft, route deviation, private use, and excessive idling *as pings arrive*.

| Aspect | Detail |
| --- | --- |
| Entry | `POST /score` via API Gateway → Lambda |
| Input | One or many telemetry pings (JSON) |
| Compute | Container-image Lambda (`arm64`, 512 MB) |
| Model | Loaded from S3 on cold start, cached warm |
| `fuel_delta` | Computed server-side from `vehicle-state` DynamoDB (last fuel level per vehicle) |
| Bedrock | Per anomaly (or high-severity only) |
| Persistence | Always writes to `fleetguard-incidents` with `source: "realtime"` |
| Demo | `fleetguard_replay.py --mode replay` streams CSV rows as live pings |

### Data flow (real-time)

1. Telemetry pings POST to `/score` (devices, telematics, or CSV replayer).
2. Lambda loads IsolationForest + scaler from S3, reads/writes `vehicle-state` for `fuel_delta`,
   engineers the 12-feature vector, and scores each ping.
3. For anomalies, Bedrock writes an incident report; the record is persisted to DynamoDB.
4. The **Live Monitor** tab reads `GET /incidents` and renders map + incident feed + AI reports.
5. Logs/metrics to CloudWatch.

---

## Path B — Batch log analysis (secondary)

**Purpose:** Answer "was there anything suspicious in this trip log?" — forensic audit without a
live stream.

| Aspect | Detail |
| --- | --- |
| Entry | `POST /api/v1/analyze-fleet` via FastAPI on App Runner |
| Input | Trip-log CSV (multipart upload) |
| Compute | FastAPI container (always warm, no cold starts) |
| Model | Same artifacts — bundled in image (demo) or loaded from S3 (prod) |
| `fuel_delta` | Computed server-side via pandas `groupby("vehicle_id").diff()` |
| Bedrock | Top-N anomalies only (Haiku for speed/cost; Sonnet for summary) |
| Persistence | **Optional** — returns JSON immediately; can write to DynamoDB with `source: "batch"` |
| Demo | Upload `fleetguard_telemetry.csv` via dropzone → instant table + charts |

### Data flow (batch)

1. Operator drops a CSV in the dashboard dropzone; frontend POSTs to `/api/v1/analyze-fleet`.
2. `inference.py` parses CSV, engineers features (including `fuel_delta`), scores all rows.
3. Top-N anomalies get Bedrock insight cards; API returns `{ summary, rows[], anomalies[] }`.
4. The **Analyze Logs** tab renders data table, anomaly scatter plot, map markers, and AI cards.
5. *(Optional)* anomalies persisted to DynamoDB for unified audit trail.

---

## Why both paths

| Need | Path | Why |
| --- | --- | --- |
| Continuous fleet monitoring | **A (primary)** | Matches the problem statement — catch losses *early* |
| Demo reliability / offline audit | **B (secondary)** | Upload sample CSV if streaming hiccups; managers audit past logs |
| Judge narrative | **A + B** | Lead with real-time story; show batch as practical operator feature |

Fuel theft and route abuse are **events** — Path A flags them in seconds. Path B is the safety net
and the "analyze last week's routes" workflow operators use day-to-day.

---

## Feature contract (shared)

Both paths must build features in the exact order in `fleetguard_feature_cols.json`:

8 base + 4 engineered: `fuel_delta`, `off_hours_speed`, `idle_speed_ratio`, `zone_breach`.

| Feature | Path A (real-time) | Path B (batch) |
| --- | --- | --- |
| `fuel_delta` | From `vehicle-state` DynamoDB (last ping per vehicle) | pandas `groupby("vehicle_id").diff()` on uploaded CSV |
| Other engineered | Same formulas in both `inference_core` implementations | Same |

> **Do not diverge.** Extract shared logic into `inference_core.py` (batch) and keep the Lambda
> handler in sync (or import the same module).

---

## Data model — `fleetguard-incidents`

| Attribute | Role | Example |
| --- | --- | --- |
| `incident_id` | partition key | `LG-1003_2025-01-26T15:19:00` |
| `vehicle_id` | attribute / GSI | `LG-1003` |
| `source` | origin path | `realtime` \| `batch` |
| `anomaly_score` | severity | `-0.18` |
| `report` | Bedrock text | "Suspected fuel siphoning..." |
| `created_at` | time | ISO timestamp |

Access patterns: recent incidents (scan/GSI by time), incidents per vehicle (GSI on `vehicle_id`),
filter by `source` in the dashboard.

---

## Frontend — two dashboard modes

| Tab | Data source | UI |
| --- | --- | --- |
| **Live Monitor** | `GET /incidents` + optional map pings from replayer | Map, incident log, AI report drilldown, summary cards |
| **Analyze Logs** | `POST /api/v1/analyze-fleet` | File dropzone, data table, anomaly scatter, AI insight cards |

Env vars: `NEXT_PUBLIC_API_URL` (Lambda/API Gateway), `NEXT_PUBLIC_BATCH_API_URL` (App Runner).
Set in **Amplify Console** environment variables.

---

## Frontend hosting — AWS Amplify

| Aspect | Detail |
| --- | --- |
| Service | **AWS Amplify Hosting** |
| Source | GitHub repo, app root `frontend/` |
| Build | Amplify runs `npm ci && npm run build` (see `frontend/amplify.yml`) |
| URL | `https://<branch>.<app-id>.amplifyapp.com` or custom domain |
| Env vars | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_BATCH_API_URL` in Amplify Console |

---

## CI/CD

GitHub Actions (OIDC, no long-lived AWS keys):

- **PR:** lint, model smoke test, Terraform validate, optional `next lint`.
- **Merge → main:** Amplify auto-deploys `frontend/`; GitHub Actions deploys Lambda → ECR → Terraform and App Runner.

---

## Scaling path (production)

- **Real-time ingestion at fleet scale:** IoT Core (MQTT) or API Gateway → **Kinesis Data Streams**
  → Lambda consumer (replaces direct POST for high throughput).
- **Telemetry history:** **Amazon Timestream** or S3 + Athena for route replay and trends.
- **Async enrichment:** EventBridge anomaly events → worker Lambda for Bedrock + **SNS** alerts.
- **Live dashboard push:** API Gateway WebSocket instead of polling `GET /incidents`.
- **Auth:** Cognito + JWT authorizer on both APIs.
