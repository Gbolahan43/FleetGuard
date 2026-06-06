# FleetGuard - Technical Specification (Build-Ready)

Implementation detail for the **hybrid FleetGuard platform**: **Path A (real-time Lambda)** as the
primary monitoring path, **Path B (FastAPI batch upload)** as the secondary audit path. Both
share the same IsolationForest model and Bedrock insights.

Pairs with [architecture.md](architecture.md), [SOW.md](SOW.md), and [plan.md](plan.md).

**Status:** Phase 1 (ML pipeline) complete. Artifacts marked `[TO BUILD]` do not exist yet.

---

## 0. Locked decisions

| # | Decision | Choice | Rationale |
| --- | --- | --- | --- |
| D-1 | Primary path | **Real-time `POST /score` (Lambda + API Gateway)** | Matches problem statement — catch anomalies as pings arrive |
| D-2 | Secondary path | **Batch `POST /api/v1/analyze-fleet` (FastAPI on App Runner)** | Upload CSV for forensic audit; reliable demo fallback |
| D-3 | Shared ML | **Same model artifacts + identical feature engineering** | Scores must match across both paths |
| D-4 | `GET /incidents` | **Required** (Path A) | Live Monitor tab reads from DynamoDB |
| D-5 | Batch persistence | **Optional** (`source: "batch"`) | Batch returns JSON immediately; optional write to unified incident table |
| D-6 | AWS region | **`us-east-1`** | Bedrock Claude availability |
| D-7 | Bedrock — real-time | **Claude 3.5 Sonnet** per anomaly | Already wired in Lambda handler |
| D-8 | Bedrock — batch | **Claude 3 Haiku** top-N; Sonnet for summary | Cost/speed for bulk rows |
| D-9 | Real-time `fuel_delta` | **Server-side via `vehicle-state` DynamoDB** | Removes fragile caller contract |
| D-10 | Batch `fuel_delta` | **Server-side via pandas `groupby().diff()`** | Natural fit for uploaded CSV |
| D-11 | Lambda packaging | **Container image (ECR), `arm64`** | sklearn exceeds zip limit |
| D-12 | Batch hosting | **AWS App Runner** (FastAPI container) | Always warm, simple deploy from ECR |
| D-13 | Frontend | **Next.js (App Router)** — two tabs: Live Monitor + Analyze Logs | |
| D-14 | Frontend hosting | **AWS Amplify Hosting** (Git → `frontend/`) | Managed Next.js build/deploy, HTTPS, env vars; no manual S3/CloudFront wiring |
| D-15 | CI/CD | **GitHub Actions OIDC** | No long-lived AWS keys |
| D-16 | Cold starts (Path A) | **EventBridge warm-ping every 5 min** during demo | Path B has no cold starts (App Runner) |
| D-17 | Bedrock reliability | **Pre-seed demo incidents**; cached-text fallback on throttle | Demo cannot depend on live LLM |

---

## 1. Component inventory & ownership

| Component | Location | State | Workstream |
| --- | --- | --- | --- |
| Telemetry generator | `fleetguard_prep/src/fleetguard_generate_data.py` | ✅ Done | - |
| Trainer | `fleetguard_prep/src/fleetguard_train.py` | ✅ Done | - |
| Model artifacts | `fleetguard_prep/models/` | ✅ Done | - |
| Shared inference core | `backend/app/ml_engine/inference_core.py` | `[TO BUILD]` | Shared |
| Real-time handler | `fleetguard_prep/src/fleetguard_lambda_handler.py` | ✅ Written; needs `GET /incidents` + `vehicle-state` | A |
| Lambda container | `fleetguard_prep/infra/Dockerfile.lambda` | `[TO BUILD]` | A |
| SAM IaC | `fleetguard_prep/infra/template.yaml` | `[TO BUILD]` | A |
| Replay + seeder | `fleetguard_prep/src/fleetguard_replay.py` | `[TO BUILD]` | A |
| FastAPI batch service | `backend/app/` | `[TO BUILD]` | B |
| App Runner Dockerfile | `backend/Dockerfile` | `[TO BUILD]` | B |
| CI/CD | `.github/workflows/aws-deploy.yml` | `[TO BUILD]` | Infra |
| Frontend | `frontend/` (Next.js) | `[TO BUILD]` | C |

### Workstreams

- **A — Real-time:** Lambda, API Gateway, DynamoDB (`incidents` + `vehicle-state`), replayer, Live Monitor UI.
- **B — Batch:** FastAPI, App Runner, Analyze Logs UI (dropzone, table, scatter, AI cards).
- **Shared:** `inference_core`, model artifacts, Bedrock prompts, Pydantic/TS types.
- **C — Frontend:** Both tabs; dual API URLs.

---

## 2. Path A — Real-time (Lambda)  `[TO BUILD infra]`

### 2.1 Lambda container

```dockerfile
# fleetguard_prep/infra/Dockerfile.lambda
FROM public.ecr.aws/lambda/python:3.11
COPY requirements-lambda.txt .
RUN pip install --no-cache-dir -r requirements-lambda.txt
COPY src/ ${LAMBDA_TASK_ROOT}/
CMD ["fleetguard_lambda_handler.handler"]
```

`requirements-lambda.txt` — pin scikit-learn to the **exact training version**:

```
scikit-learn==1.5.2   # MUST match training env
numpy==1.26.4
boto3>=1.34
```

Config: **512 MB**, **30 s**, **`arm64`**, container image.

### 2.2 Handler changes  `[TO BUILD]`

Existing `fleetguard_lambda_handler.py` implements `POST /score`. Add:

1. **`GET /incidents`** — dashboard feed (`?limit=50`, `?vehicle_id=`, filter `?source=realtime`).
2. **`vehicle-state` table** — per-vehicle last `fuel_level_pct` (and optionally lat/lng); compute
   `fuel_delta` on each ping server-side (**D-9**).
3. **`source: "realtime"`** on every incident write.

### 2.3 Environment variables (Lambda)

| Var | Default | Purpose |
| --- | --- | --- |
| `MODEL_BUCKET` | — | S3 bucket for model artifacts |
| `MODEL_PREFIX` | `fleetguard-model` | Key prefix |
| `DYNAMO_TABLE` | `fleetguard-incidents` | Incident table |
| `STATE_TABLE` | `fleetguard-vehicle-state` | Last ping per vehicle |
| `BEDROCK_REGION` | `us-east-1` | |
| `BEDROCK_MODEL_ID` | `anthropic.claude-3-5-sonnet-20241022-v2:0` | |

### 2.4 API surface (API Gateway HTTP API)

| Method / Route | Body / Query | Returns |
| --- | --- | --- |
| `POST /score` | `{ "pings": [ {vehicle_id, timestamp, speed_kmh, fuel_level_pct, idle_minutes, hour, day_of_week, is_working_hour, zone_distance_deg, engine_on, lat, lng} ] }` | `{ processed, anomalies, results:[{vehicle_id, is_anomaly, score, report}] }` |
| `GET /incidents` | `?limit=50` \| `?vehicle_id=` \| `?source=realtime` | `{ incidents: [...] }` |

> `fuel_delta` is **not** required in the request body — Lambda computes it from `vehicle-state`.

### 2.5 SAM resources (`template.yaml`)

| Logical ID | Type | Notes |
| --- | --- | --- |
| `ModelBucket` | S3 | `fleetguard-model/` artifacts |
| `IncidentsTable` | DynamoDB | PK `incident_id`; GSI `vehicle_id-index`; attr `source` |
| `VehicleStateTable` | DynamoDB | PK `vehicle_id`; attrs `fuel_level_pct`, `timestamp`, `lat`, `lng` |
| `ScoreFunction` | Serverless Function (Image) | Path A handler |
| `HttpApi` | HTTP API | `POST /score`, `GET /incidents`; CORS |
| `WarmRule` | EventBridge | `rate(5 minutes)` → ScoreFunction (**D-16**) |
| `WebBucket` + `Distribution` | ~~S3 + CloudFront~~ | **Removed** — frontend on **Amplify Hosting** (D-14) |

### 2.6 Replay script (`fleetguard_replay.py`)

```bash
# Simulate live telemetry (Path A demo)
python fleetguard_prep/src/fleetguard_replay.py \
  --api $NEXT_PUBLIC_API_URL --mode replay [--limit N]

# Pre-seed incidents for Live Monitor fallback
python fleetguard_prep/src/fleetguard_replay.py \
  --api $NEXT_PUBLIC_API_URL --mode seed
```

Streams CSV rows to `POST /score` in batches (no `fuel_delta` in payload — Lambda computes it).

---

## 3. Path B — Batch (FastAPI + App Runner)  `[TO BUILD]`

### 3.1 FastAPI structure

```
backend/app/
├── main.py
├── api/v1_router.py              # POST /api/v1/analyze-fleet, GET /healthz
├── core/config.py                # AWS_REGION, BEDROCK_MODEL_ID, MODEL_PATH, PERSIST_INCIDENTS
├── core/aws_client.py            # boto3 Bedrock + DynamoDB
├── ml_engine/
│   ├── inference_core.py         # engineer_features(df) + score — MUST match Lambda logic
│   ├── generate_mock.py
│   └── train_model.py
├── schemas/fleet_data.py         # TripLog, ScoredRow, AnalyzeFleetResponse, AnomalyReport
└── services/
    ├── inference.py              # wraps inference_core for CSV upload
    └── agent_bedrock.py          # top-N Bedrock insights (Haiku)
```

### 3.2 Dockerfile (App Runner)

```dockerfile
# backend/Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ ./app/
COPY ../fleetguard_prep/models/ ./models/   # or download from S3 at startup
EXPOSE 8080
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

`requirements.txt`: `fastapi`, `uvicorn`, `scikit-learn`, `pandas`, `numpy`, `boto3`, `python-multipart`.

### 3.3 API surface (App Runner)

| Method / Route | Body | Returns |
| --- | --- | --- |
| `POST /api/v1/analyze-fleet` | `multipart/form-data`: `file` (CSV) | `{ summary, total_rows, anomaly_count, rows[], anomalies[] }` |
| `GET /healthz` | — | `{ status: "ok" }` |

Each `anomaly` includes: `vehicle_id`, `timestamp`, `score`, `lat`, `lng`, `anomaly_type` (if
labeled), `report` (Bedrock text for top-N).

### 3.4 Batch behavior

- Parse CSV with pandas; compute `fuel_delta` via `groupby("vehicle_id")["fuel_level_pct"].diff()`.
- Score all rows with shared `inference_core`.
- Call Bedrock for **top-N** anomalies only (**D-8**); return full scored table in `rows[]`.
- If `PERSIST_INCIDENTS=true`, write anomalies to `fleetguard-incidents` with `source: "batch"`.

### 3.5 App Runner config

- Source: ECR image from `backend/Dockerfile`.
- Port: **8080**; health check: `GET /healthz`.
- Env: `MODEL_PATH=/app/models`, `BEDROCK_REGION`, `PERSIST_INCIDENTS=false` (demo default).

---

## 4. Shared model & S3 layout

Both paths load the same three runtime artifacts:

```
s3://<bucket>/fleetguard-model/
├── fleetguard_anomaly_model.pkl
├── fleetguard_scaler.pkl
└── fleetguard_feature_cols.json
```

| Path | Load strategy |
| --- | --- |
| A (Lambda) | S3 download on cold start, cache in `/tmp` |
| B (FastAPI) | Bundled in image (demo) or S3 at startup (prod) |

Feature order (12 cols): see `fleetguard_feature_cols.json` in `fleetguard_prep/models/`.

### 4.1 `inference_core.py` contract  `[TO BUILD]`

```python
def engineer_features(df: pd.DataFrame) -> pd.DataFrame: ...
def score_dataframe(df: pd.DataFrame, model, scaler, feature_cols) -> pd.DataFrame:
    # adds columns: predicted, anomaly_score, is_anomaly
```

Lambda handler must use equivalent logic (copy or shared package). **Run a parity test:** same CSV
row → same `is_anomaly` and `score` from both paths.

---

## 5. DynamoDB tables

### 5.1 `fleetguard-incidents`

| Attribute | Type | Notes |
| --- | --- | --- |
| `incident_id` | S (PK) | `{vehicle_id}_{timestamp}` |
| `vehicle_id` | S (GSI) | |
| `source` | S | `realtime` \| `batch` |
| `anomaly_score`, `report`, `created_at`, telemetry fields | S | |

### 5.2 `fleetguard-vehicle-state` (Path A only)

| Attribute | Type | Notes |
| --- | --- | --- |
| `vehicle_id` | S (PK) | |
| `fuel_level_pct` | N | Last seen fuel level |
| `timestamp` | S | Last ping time |
| `lat`, `lng` | S | Optional |

Updated on every `POST /score` ping; used to compute `fuel_delta`.

---

## 6. Bedrock integration

| Path | When | Model | Tokens |
| --- | --- | --- | --- |
| A (real-time) | Each anomaly | Claude 3.5 Sonnet | 300 |
| B (batch) | Top-N anomalies | Claude 3 Haiku | 200 |
| B (batch) | Fleet summary (optional) | Claude 3.5 Sonnet | 400 |

**Prerequisite:** enable model access in Bedrock console before first invoke.

Demo safety: pre-seed via `fleetguard_replay.py --mode seed`; fallback to cached text on
`ThrottlingException`.

---

## 7. Frontend — `frontend/`  `[TO BUILD]`

Next.js (App Router, TypeScript, Tailwind), deployed on **AWS Amplify Hosting** (D-14).

### 7.1 Setup

```bash
npx create-next-app@latest frontend --ts --app --tailwind --eslint
```

Use standard `next build` (no `output: 'export'` required). Amplify runs the build in CI and
hosts the app at `https://<branch>.<app-id>.amplifyapp.com`.

Monorepo config: **`frontend/amplify.yml`** (or root `amplify.yml` with `appRoot: frontend`).

### 7.2 Amplify Console

1. Connect GitHub repo → Amplify → **Host web app**.
2. Set **app root** to `frontend/`.
3. Add environment variables:
   - `NEXT_PUBLIC_API_URL` — API Gateway base URL (Path A)
   - `NEXT_PUBLIC_BATCH_API_URL` — App Runner URL (Path B)
4. Enable auto-deploy on push to `main`.

CORS on API Gateway and App Runner must allow the Amplify domain.

### 7.3 Dashboard tabs

| Tab | Route | API | Components |
| --- | --- | --- | --- |
| **Live Monitor** | `/` or `/live` | `NEXT_PUBLIC_API_URL` | Map (Leaflet), incident log, AI drilldown, summary cards |
| **Analyze Logs** | `/analyze` | `NEXT_PUBLIC_BATCH_API_URL` | `file-dropzone`, `data-table`, `anomaly-scatter`, `ai-insight-card` |

### 7.4 Env vars (Amplify + local `.env.local`)

```env
NEXT_PUBLIC_API_URL=https://xxxx.execute-api.us-east-1.amazonaws.com
NEXT_PUBLIC_BATCH_API_URL=https://xxxx.us-east-1.awsapprunner.com
```

### 7.5 Types

`frontend/src/types/fleet.ts` mirrors `backend/app/schemas/fleet_data.py` (TripLog, ScoredRow,
AnomalyReport, AnalyzeFleetResponse).

---

## 8. CI/CD  `[TO BUILD]`

**Split pipeline:**

| Layer | Tool | Trigger |
| --- | --- | --- |
| **Frontend** | **AWS Amplify Hosting** | Git push to `main` (builds `frontend/`) |
| **Backend + infra** | **GitHub Actions OIDC** | `.github/workflows/aws-deploy.yml` |

GitHub Actions on push to `main`:

1. **Lint & test** — pytest inference parity; Terraform validate; optional `next lint`.
2. **Path A** — build Lambda image → push ECR → Terraform/SAM deploy.
3. **Path B** — build FastAPI image → push ECR → update App Runner.

Amplify handles frontend build/deploy separately (no S3 sync or CloudFront invalidation).

On PR: GitHub Actions runs tests only; Amplify preview branches optional.

---

## 9. IAM summary

**ScoreFunction (Lambda):**

```
s3:GetObject                    on ModelBucket/fleetguard-model/*
dynamodb:PutItem|GetItem|UpdateItem on IncidentsTable, VehicleStateTable
dynamodb:Query                  on IncidentsTable GSI
bedrock:InvokeModel             on Claude models
logs:*
```

**App Runner task role (FastAPI):**

```
s3:GetObject                    on ModelBucket/fleetguard-model/*  (if S3 load)
dynamodb:PutItem                on IncidentsTable  (if PERSIST_INCIDENTS)
bedrock:InvokeModel             on Claude models
logs:*
```

---

## 10. Local testing

| Test | Command |
| --- | --- |
| Offline model smoke | Load `.pkl`, score one row, assert `n_features_in_ == 12` |
| Path A local | `sam local invoke ScoreFunction -e events/score.json` |
| Path A deployed | `curl -X POST $API/score -d @events/score.json` |
| Path B local | `uvicorn app.main:app --reload`; POST CSV to `/api/v1/analyze-fleet` |
| Parity | Same row through Lambda handler + `inference_core` → identical score |
| Replay demo | `fleetguard_replay.py --mode replay` |
| Batch demo | Upload `fleetguard_telemetry.csv` in Analyze Logs tab |

---

## 11. Definition of done

- [ ] **Path A:** `POST /score` live; anomalies + Bedrock reports; `GET /incidents` for Live Monitor.
- [ ] **Path B:** `POST /api/v1/analyze-fleet` live; CSV upload returns scored rows + top-N AI insights.
- [ ] **Shared:** parity test passes; same model artifacts in S3.
- [ ] **Frontend:** both tabs live on **Amplify**; dual API URLs in Amplify env vars.
- [ ] **IaC:** SAM template (Path A) + App Runner service (Path B) reproducible.
- [ ] **CI/CD:** GitHub Actions deploys on merge to `main`.
- [ ] **Demo:** replayer for Live Monitor + CSV upload fallback rehearsed.

---

## 12. Build order (critical path)

1. Enable Bedrock model access (kick off first — approval can lag).
2. Extract `inference_core.py`; add parity test against existing Lambda logic.
3. Pin scikit-learn → build Lambda Dockerfile; add `vehicle-state` + `GET /incidents` to handler.
4. `sam build && sam deploy`; upload model artifacts to S3.
5. Scaffold FastAPI batch service; wire to `inference_core`; build App Runner image.
6. Write `fleetguard_replay.py`; smoke-test Path A; upload sample CSV for Path B.
7. Build Next.js frontend (both tabs); connect repo to **Amplify Hosting** (`frontend/`).
8. Add GitHub Actions workflow for backend/infra; rehearse demo.
