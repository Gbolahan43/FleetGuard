"""FleetGuard ML — canonical paths (repo: ml/)."""

from pathlib import Path

ML_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ML_ROOT / "data" / "mock"
MODEL_DIR = ML_ROOT / "models"

TELEMETRY_CSV = DATA_DIR / "fleetguard_telemetry.csv"

MODEL_PKL = MODEL_DIR / "fleetguard_anomaly_model.pkl"
SCALER_PKL = MODEL_DIR / "fleetguard_scaler.pkl"
FEATURE_COLS_JSON = MODEL_DIR / "fleetguard_feature_cols.json"
