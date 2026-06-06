# FleetGuard — Product Requirements (PRD)

## 1. Problem

Nigerian fleet operators lose money because they cannot verify:

- Whether drivers followed **approved routes**
- Whether **fuel** was used for deliveries (vs theft)
- Whether vehicles are used **privately** after hours
- Whether drivers sit **idle** excessively (wasted fuel/time)

FleetGuard turns raw vehicle telemetry into **ranked, explainable anomaly alerts** so managers
catch losses early, improve accountability, and optimize transportation performance.

## 2. Product vision

A **fleet intelligence command center** with two modes:

1. **Live Monitor (primary)** — vehicles stream GPS/fuel pings; anomalies appear in seconds with
   AI-written incident reports.
2. **Analyze Logs (secondary)** — operators upload a trip-log CSV and get an instant forensic
   report: which trips were suspicious and why.

## 3. Target users

| Persona | Goal |
| --- | --- |
| **Fleet manager** | See live incidents, drill into AI reports, act on fuel theft / route abuse |
| **Operations analyst** | Upload historical logs, export findings, compare vehicles |
| **Demo judge / stakeholder** | Understand AWS + AI value in under 5 minutes |

## 4. Anomaly types (in scope)

| Type | Signal (simplified) |
| --- | --- |
| **Route deviation** | Vehicle far outside approved Lagos delivery zones, often at high speed |
| **Fuel theft** | Large fuel drop while stationary, engine on |
| **Private use** | Movement outside working hours, outside approved areas |
| **Excessive idle** | Engine on, no movement, idle time very high |

Detection is **unsupervised** (IsolationForest) — no labelled incidents required in production.

## 5. Functional requirements

### 5.1 Path A — Real-time (must have)

| ID | Requirement |
| --- | --- |
| FR-A1 | Accept telemetry pings via `POST /score` (single or batch JSON) |
| FR-A2 | Score each ping with IsolationForest; return `is_anomaly`, `score` |
| FR-A3 | For anomalies, generate Bedrock incident report and persist to DynamoDB |
| FR-A4 | Expose `GET /incidents` for dashboard live feed (filter by vehicle, source) |
| FR-A5 | Compute `fuel_delta` server-side (vehicle-state table) |
| FR-A6 | Support CSV replayer to simulate live telematics for demo |

### 5.2 Path B — Batch audit (must have)

| ID | Requirement |
| --- | --- |
| FR-B1 | Accept trip-log CSV upload via `POST /api/v1/analyze-fleet` |
| FR-B2 | Score all rows; return summary + full scored table + top anomalies |
| FR-B3 | Generate Bedrock insights for top-N anomalies (not every row) |
| FR-B4 | Compute `fuel_delta` server-side from uploaded file |
| FR-B5 | Render results in dashboard: table, scatter chart, AI insight cards |

### 5.3 Frontend (must have)

| ID | Requirement |
| --- | --- |
| FR-F1 | **Live Monitor** tab: map (route markers), incident log, AI report panel |
| FR-F2 | **Analyze Logs** tab: file dropzone, data table, anomaly visualization |
| FR-F3 | Summary cards: vehicle count, anomaly count, breakdown by type |
| FR-F4 | Dual API configuration (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_BATCH_API_URL`) |

### 5.4 Shared (must have)

| ID | Requirement |
| --- | --- |
| FR-S1 | Same model artifacts and feature engineering on Path A and B |
| FR-S2 | Parity test: identical input row → identical score on both paths |
| FR-S3 | Deploy on AWS (Lambda, App Runner, S3, DynamoDB, Bedrock, **Amplify**) |

## 6. Non-functional requirements

| ID | Requirement |
| --- | --- |
| NFR-1 | Region: `us-east-1` (Bedrock model access) |
| NFR-2 | Real-time scoring latency: &lt; 2 s per ping batch (excluding Bedrock) |
| NFR-3 | Batch analysis: &lt; 30 s for ~5k rows (demo dataset) |
| NFR-4 | Demo cost: &lt; ~$5 total (Free Tier where possible) |
| NFR-5 | No auth for hackathon demo (Cognito = future) |

## 7. Out of scope (this sprint)

- Cognito / multi-tenant auth
- Real telematics device integration (simulated via replayer + CSV)
- Kinesis / IoT Core live ingestion (documented scaling path only)
- Automated model retraining pipeline
- Mobile app

## 8. Success metrics

| Metric | Target |
| --- | --- |
| Model detection (offline eval) | Anomaly F1 ≥ 0.95 (current prep: **0.994**) |
| Demo reliability | Both paths work; batch fallback if stream fails |
| Judge comprehension | Problem → solution → live demo in ≤ 5 min |

## 9. AWS services (summary)

| Service | Role |
| --- | --- |
| Lambda + API Gateway | Path A real-time scoring |
| App Runner | Path B FastAPI batch service |
| S3 | Model artifacts only (not frontend static site) |
| DynamoDB | Incidents + vehicle-state |
| Bedrock (Claude) | Incident insight text |
| **Amplify Hosting** | Next.js dashboard build, HTTPS, Git deploy |
| CloudWatch | Logs and metrics |
| GitHub Actions (OIDC) | CI/CD for backend/infra (Amplify handles frontend) |

Full justification: [../fleetguard_prep/docs/SOW.md](../fleetguard_prep/docs/SOW.md).

## 10. References

- Problem statement: hackathon brief (fuel theft & route abuse, Nigerian logistics)
- Sample data: `ml/data/mock/fleetguard_telemetry.csv`
- Trained model: `ml/models/` (F1 0.994 on injected labels)
