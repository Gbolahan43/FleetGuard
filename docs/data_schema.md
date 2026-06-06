# FleetGuard — Data Schema

Telemetry CSV format, ML features, and DynamoDB tables. Shared by Path A and Path B.

---

## 1. Trip-log CSV (input)

Used by: batch upload (Path B), mock generator, CSV replayer (Path A).

### 1.1 Required columns

| Column | Type | Example | Description |
| --- | --- | --- | --- |
| `vehicle_id` | string | `LG-1001` | Fleet vehicle identifier |
| `timestamp` | datetime | `2025-01-26 15:19:00` | Ping time |
| `lat` | float | `6.455` | GPS latitude (Lagos area) |
| `lng` | float | `3.395` | GPS longitude |
| `speed_kmh` | float | `45.2` | Speed km/h |
| `fuel_level_pct` | float | `62.5` | Tank level 0–100 |
| `engine_on` | int | `1` | 1 = on, 0 = off |
| `idle_minutes` | int | `5` | Minutes idle at ping |
| `hour` | int | `15` | Hour of day 0–23 |
| `day_of_week` | int | `0` | 0 = Monday … 6 = Sunday |
| `is_working_hour` | int | `1` | 1 = within shift, 0 = off-hours |
| `zone_distance_deg` | float | `0.012` | Distance from nearest approved zone (degrees) |

### 1.2 Optional columns (training / eval only)

| Column | Type | Notes |
| --- | --- | --- |
| `is_anomaly` | 0 \| 1 | Ground truth — **not** sent to model at inference |
| `anomaly_type` | string | `normal`, `fuel_theft`, `route_deviation`, `private_use`, `excessive_idle` |

### 1.3 Sample file

`ml/data/mock/fleetguard_telemetry.csv` — 4,800 rows, 10 vehicles, ~12% anomalies.

### 1.4 Approved delivery zones (Lagos)

Used to compute `zone_distance_deg` in the generator:

| Zone | lat | lng |
| --- | --- | --- |
| Lagos Island | 6.455 | 3.395 |
| Victoria Island | 6.428 | 3.421 |
| Ikeja | 6.601 | 3.347 |
| Surulere | 6.499 | 3.358 |
| Lekki | 6.465 | 3.522 |

`zone_breach = 1` when `zone_distance_deg > 0.08`.

---

## 2. ML features (12 columns)

Order **must** match `fleetguard_feature_cols.json`:

| # | Feature | Source |
| --- | --- | --- |
| 1 | `speed_kmh` | CSV |
| 2 | `fuel_level_pct` | CSV |
| 3 | `engine_on` | CSV |
| 4 | `idle_minutes` | CSV |
| 5 | `hour` | CSV |
| 6 | `day_of_week` | CSV |
| 7 | `is_working_hour` | CSV |
| 8 | `zone_distance_deg` | CSV |
| 9 | `fuel_delta` | **Engineered** — see below |
| 10 | `off_hours_speed` | `speed_kmh * (1 - is_working_hour)` |
| 11 | `idle_speed_ratio` | `idle_minutes / (speed_kmh + 1)` |
| 12 | `zone_breach` | `1 if zone_distance_deg > 0.08 else 0` |

### 2.1 `fuel_delta` computation

| Path | Method |
| --- | --- |
| **A (real-time)** | `current_fuel - last_fuel` from `fleetguard-vehicle-state` DynamoDB |
| **B (batch)** | `df.groupby("vehicle_id")["fuel_level_pct"].diff().fillna(0)` |

Large negative `fuel_delta` + low speed → fuel theft signal.

### 2.2 Model artifacts

| File | Purpose |
| --- | --- |
| `fleetguard_anomaly_model.pkl` | Trained IsolationForest |
| `fleetguard_scaler.pkl` | StandardScaler |
| `fleetguard_feature_cols.json` | Feature column order |

Location: `ml/models/` → upload to S3 `fleetguard-model/`.

### 2.3 Model config

| Parameter | Value |
| --- | --- |
| Algorithm | IsolationForest |
| `n_estimators` | 200 |
| `contamination` | 0.12 |
| Prediction | `-1` = anomaly, `1` = normal |
| Score | `score_samples()` — **lower = more suspicious** |

Offline eval: anomaly F1 **0.994** on injected labels.

---

## 3. DynamoDB — `fleetguard-incidents`

| Attribute | Type | Key | Example |
| --- | --- | --- | --- |
| `incident_id` | S | PK | `LG-1003_2025-01-26T15:19:00` |
| `vehicle_id` | S | GSI | `LG-1003` |
| `source` | S | — | `realtime` \| `batch` |
| `timestamp` | S | — | Ping timestamp |
| `anomaly_score` | S | — | `-0.4521` |
| `report` | S | — | Bedrock insight text |
| `created_at` | S | — | ISO UTC |
| `lat`, `lng`, `speed_kmh`, `fuel_level_pct`, `fuel_delta`, `idle_minutes` | S | — | Telemetry snapshot |

**GSI:** `vehicle_id-index` on `vehicle_id`.

**Billing:** PAY_PER_REQUEST.

---

## 4. DynamoDB — `fleetguard-vehicle-state` (Path A only)

| Attribute | Type | Key | Notes |
| --- | --- | --- | --- |
| `vehicle_id` | S | PK | |
| `fuel_level_pct` | N | — | Last seen level |
| `timestamp` | S | — | Last ping time |
| `lat`, `lng` | S | — | Optional last position |

Updated on every successful `POST /score` ping for that vehicle.

---

## 5. Anomaly types (business labels)

Used in mock data and optional CSV column `anomaly_type`:

| Type | Typical pattern |
| --- | --- |
| `route_deviation` | High `zone_distance_deg`, high speed, outside Lagos zones |
| `fuel_theft` | Large negative `fuel_delta`, low speed, engine on |
| `private_use` | `is_working_hour=0`, movement outside zones |
| `excessive_idle` | High `idle_minutes`, low speed, engine on |

The production model is **unsupervised** — it does not require `anomaly_type` at inference.

---

## 6. Related docs

- [api_contract.md](api_contract.md) — JSON shapes built from this schema
- [../fleetguard_prep/docs/technicals.md](../fleetguard_prep/docs/technicals.md) §4–5 — S3 layout, IAM
