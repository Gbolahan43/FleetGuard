# FleetGuard — Team Guide

How to split work, what to build first, and rules everyone must follow.

---

## 1. Workstreams

| Stream | Owner focus | Folders | Delivers |
| --- | --- | --- | --- |
| **A — Real-time** | Lambda, API GW, DynamoDB, replayer | `ml/src/realtime/`, `infrastructure/` | `POST /score`, `GET /incidents`, Live Monitor data |
| **B — Batch** | FastAPI, App Runner | `backend/`, `ml/src/inference/` | `POST /api/v1/analyze-fleet`, Analyze Logs data |
| **Shared — ML** | Model, parity, features | `ml/` | `inference_core`, trained artifacts, tests |
| **C — Frontend** | Next.js UI | `frontend/` | Both dashboard tabs |
| **Infra** | Terraform, CI/CD | `infrastructure/`, `.github/` | Deploy pipeline, AWS resources |

One person can own multiple streams if the team is small — but **Shared ML** must be agreed before A and B diverge.

---

## 2. Build order (critical path)

Do not skip steps — later work depends on earlier artifacts.

| # | Task | Owner | Blocker for |
| --- | --- | --- | --- |
| 1 | Enable Bedrock model access (Console) | Anyone | All Bedrock calls |
| 2 | Migrate / copy ML scripts → `ml/`; keep models in sync | Shared | A, B |
| 3 | Extract `inference_core.py` + parity test | Shared | A, B |
| 4 | Lambda handler: `vehicle-state`, `GET /incidents` | A | Live Monitor |
| 5 | Terraform/SAM deploy Path A + upload models to S3 | A + Infra | Live demo |
| 6 | FastAPI batch service wired to `inference_core` | B | Analyze tab |
| 7 | App Runner deploy Path B | B + Infra | Analyze tab |
| 8 | Next.js both tabs + env vars | C | Full demo |
| 9 | `fleetguard_replay.py` + seed script | A | Live demo |
| 10 | GitHub Actions OIDC pipeline | Infra | Repeatable deploy |
| 11 | Demo rehearsal (replayer + CSV fallback) | All | Judging |

---

## 3. Shared rules (non-negotiable)

### 3.1 One scoring brain

- Feature order = `fleetguard_feature_cols.json` (12 features).
- Same formulas for `off_hours_speed`, `idle_speed_ratio`, `zone_breach`.
- Parity test must pass before merge to `main`.

### 3.2 API contract is law

- Shapes defined in [api_contract.md](api_contract.md).
- Change the contract → update TS types + Pydantic + this doc in the same PR.

### 3.3 No secrets in git

- Use `.env` / `.env.local` (gitignored).
- Templates: `backend/.env.example`, `frontend/.env.example`.

### 3.4 Branch naming (suggested)

```
feature/a-score-endpoint
feature/b-analyze-fleet
feature/frontend-live-monitor
fix/parity-fuel-delta
```

### 3.5 PR checklist

- [ ] Matches [api_contract.md](api_contract.md)
- [ ] No sklearn version drift (pin in requirements)
- [ ] Parity test green (when touching ML)
- [ ] README or docs updated if behaviour changed

---

## 4. Local development

### 4.1 Python (ML + backend)

```powershell
cd FleetGuard
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt   # when added
pip install -r ml/requirements.txt        # when added
```

**Existing prep scripts (migrated to `ml/`):**

```powershell
python ml/scripts/generate_data.py
python ml/scripts/train.py
pytest ml/tests/ -q
```

### 4.2 Backend (Path B)

```powershell
cd backend
uvicorn app.main:app --reload --port 8080
```

### 4.3 Frontend

```powershell
cd frontend
npm install
npm run dev
```

Copy `.env.example` files and set API URLs after first deploy.

---

## 5. Environment variables

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=          # Path A — API Gateway
NEXT_PUBLIC_BATCH_API_URL=    # Path B — App Runner
```

### Backend (`backend/.env`)

```env
AWS_REGION=us-east-1
MODEL_PATH=ml/models
BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0
PERSIST_INCIDENTS=false
```

### Lambda (set in Terraform/SAM)

See [../fleetguard_prep/docs/technicals.md](../fleetguard_prep/docs/technicals.md) §2.3.

---

## 6. Definition of done

### Path A

- [ ] `POST /score` scores pings; server-side `fuel_delta`
- [ ] Anomalies get Bedrock report + DynamoDB row (`source: realtime`)
- [ ] `GET /incidents` returns recent list
- [ ] Replayer streams sample CSV as live pings

### Path B

- [ ] `POST /api/v1/analyze-fleet` accepts CSV
- [ ] Returns `summary`, `rows`, `anomalies` per contract
- [ ] Top-N Bedrock insights only
- [ ] `GET /healthz` passes App Runner check

### Shared

- [ ] Parity test passes
- [ ] Model artifacts in S3 under `fleetguard-model/`

### Frontend

- [ ] Live Monitor: map, incident log, AI panel
- [ ] Analyze Logs: dropzone, table, scatter, AI cards
- [ ] Deployed to **Amplify** with both env vars set

### Demo

- [ ] 5-minute script rehearsed ([app_flow.md](app_flow.md) §5)
- [ ] Fallback: seeded incidents + batch CSV upload

---

## 7. Who to ask

| Question | Doc |
| --- | --- |
| What are we building? | [prd.md](prd.md) |
| Screen flows & demo | [app_flow.md](app_flow.md) |
| JSON / HTTP shapes | [api_contract.md](api_contract.md) |
| CSV & DynamoDB | [data_schema.md](data_schema.md) |
| AWS resources & deploy | [../fleetguard_prep/docs/technicals.md](../fleetguard_prep/docs/technicals.md) |
| Architecture diagram | [../fleetguard_prep/docs/architecture.md](../fleetguard_prep/docs/architecture.md) |

---

## 8. Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| sklearn pickle won't load in Lambda | Pin exact version; container image |
| Bedrock throttle at demo | Pre-seed incidents; cached report text |
| Path A/B scores differ | Parity test in CI |
| Live stream fails at judging | Batch CSV upload tab (Path B) |
| Cold start on Lambda | EventBridge warm-ping during event |

---

## 9. Current status

| Area | Status |
| --- | --- |
| ML training + eval | ✅ Done in `ml/` |
| Lambda handler (Path A) | ✅ Done in `ml/src/realtime/handler.py` |
| Shared inference core | ✅ Done in `ml/src/inference/` |
| Monorepo scaffold | ✅ Done |
| FastAPI backend | ✅ Done locally; deploy via App Runner |
| Frontend | 🔲 In progress |
| SAM / CI | ✅ Template + workflows in repo |
| Root docs | ✅ This folder |
