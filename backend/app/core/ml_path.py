"""Add ml/src to sys.path so backend can import shared inference_core."""

import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[3]
ML_SRC = _REPO_ROOT / "ml" / "src"

if ML_SRC.is_dir() and str(ML_SRC) not in sys.path:
    sys.path.insert(0, str(ML_SRC))

REPO_ROOT = _REPO_ROOT
DEFAULT_MODEL_DIR = _REPO_ROOT / "ml" / "models"
