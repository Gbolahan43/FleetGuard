# FleetGuard ML

Python ML pipeline for the hybrid FleetGuard platform. **Single source of truth** for training,
shared inference, and Path A (real-time Lambda).

Path B (FastAPI batch) imports `inference_core` from here — keep parity tests green.

## Layout

```
ml/
├── data/mock/                 fleetguard_telemetry.csv
├── models/                    trained artifacts (.pkl + JSON metadata)
├── src/
│   ├── paths.py               canonical ML_ROOT / MODEL_DIR paths
│   ├── generate/              mock telemetry generator
│   ├── train/                 IsolationForest trainer
│   ├── inference/             inference_core + constants (shared A + B)
│   └── realtime/              Path A Lambda handler (POST /score, GET /incidents)
├── scripts/                   CLI entrypoints
├── tests/                     parity + smoke tests
├── Dockerfile.lambda          container image for Path A
├── requirements.txt           local dev + training
└── requirements-lambda.txt    Lambda container deps only
```

> `fleetguard_prep/` is legacy — use `ml/` for all new work. Artifacts already copied to
> `ml/models/` and `ml/data/mock/`.

## Quickstart

From repo root with venv activated:

```powershell
pip install -r ml/requirements.txt

# 1. Generate mock data (optional — CSV already present)
python ml/scripts/generate_data.py

# 2. Train model (optional — artifacts already present)
python ml/scripts/train.py

# 3. Run parity tests
pytest ml/tests/ -q
```

## Path A — Lambda handler

- Module: `ml/src/realtime/handler.py`
- Routes: `POST /score`, `GET /incidents`
- Server-side `fuel_delta` via DynamoDB `fleetguard-vehicle-state`
- Incidents written with `source: "realtime"`

Build container:

```powershell
cd ml
docker build -f Dockerfile.lambda -t fleetguard-score .
```

Upload runtime artifacts to S3:

```powershell
# After sam deploy — use ModelBucketName output
..\..\infrastructure\scripts\upload_models.ps1 -Bucket <ModelBucketName>
```

SAM deploy: see [../infrastructure/sam/README.md](../infrastructure/sam/README.md).

## Path B — shared inference

Backend FastAPI should import:

```python
from inference.inference_core import load_artifacts, score_dataframe
```

(Add `ml/src` to `PYTHONPATH` or install as editable package later.)

## Demo replayer

```powershell
python ml/scripts/replay.py --api $env:NEXT_PUBLIC_API_URL --mode replay --limit 500
python ml/scripts/replay.py --api $env:NEXT_PUBLIC_API_URL --mode seed
```

## Docs

- [../docs/data_schema.md](../docs/data_schema.md) — CSV columns & features
- [../docs/api_contract.md](../docs/api_contract.md) — HTTP shapes
- [../fleetguard_prep/docs/technicals.md](../fleetguard_prep/docs/technicals.md) — AWS deploy detail
