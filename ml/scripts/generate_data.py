"""CLI: generate mock telemetry CSV.

Writes ml/data/mock/fleetguard_telemetry.csv and syncs a copy to
frontend/public/ for the Next.js demo dashboard.

Run from repo root:
  python ml/scripts/generate_data.py
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[2]
_ML_SRC = Path(__file__).resolve().parents[1] / "src"

if str(_ML_SRC) not in sys.path:
    sys.path.insert(0, str(_ML_SRC))

# Lazy import after sys.path — avoids runtime errors; see ml/pyrightconfig.json for IDE
def _run() -> None:
    from generate.generate_mock import main as generate_main  # type: ignore[import-untyped]
    from paths import TELEMETRY_CSV  # type: ignore[import-untyped]

    generate_main()

    dest = _REPO_ROOT / "frontend" / "public" / "fleetguard_telemetry.csv"
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(TELEMETRY_CSV, dest)
    print(f"[fleetguard] synced demo CSV -> {dest.relative_to(_REPO_ROOT)}")


if __name__ == "__main__":
    _run()
