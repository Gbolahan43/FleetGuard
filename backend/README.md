# FleetGuard Backend (Path B)

FastAPI batch analysis — `POST /api/v1/analyze-fleet` using shared `ml/src/inference/inference_core.py`.

## Setup (from repo root)

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r ml/requirements.txt -r backend/requirements.txt
copy backend\.env.example backend\.env
```

## Run locally

```powershell
cd backend
uvicorn app.main:app --reload --port 8080
```

- Health: http://127.0.0.1:8080/healthz
- Analyze: `POST /api/v1/analyze-fleet` with multipart `file` (CSV)

Test with sample data:

```powershell
curl -X POST http://127.0.0.1:8080/api/v1/analyze-fleet `
  -F "file=@../ml/data/mock/fleetguard_telemetry.csv"
```

## ML import

`app/core/ml_path.py` adds `ml/src` to `PYTHONPATH` so services import:

```python
from inference.inference_core import load_artifacts, score_dataframe
```

Model artifacts default to `ml/models/` (override via `MODEL_PATH` in `.env`).
