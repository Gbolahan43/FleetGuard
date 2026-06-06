"""Stream mock CSV rows to POST /score (Path A demo) or seed incidents.

Usage:
  python ml/scripts/replay.py --api https://... --mode replay [--limit N]
  python ml/scripts/replay.py --api https://... --mode seed
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import pandas as pd
import urllib.request

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from paths import MODEL_DIR, TELEMETRY_CSV  # noqa: E402

PING_COLS = [
    "vehicle_id",
    "timestamp",
    "lat",
    "lng",
    "speed_kmh",
    "fuel_level_pct",
    "engine_on",
    "idle_minutes",
    "hour",
    "day_of_week",
    "is_working_hour",
    "zone_distance_deg",
]


def post_json(url: str, payload: dict) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url.rstrip("/") + "/score",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode())


def replay(api: str, limit: int | None, batch_size: int) -> None:
    df = pd.read_csv(TELEMETRY_CSV, parse_dates=["timestamp"])
    if limit:
        df = df.head(limit)
    pings_batch: list[dict] = []
    for _, row in df.iterrows():
        ping = {c: row[c] for c in PING_COLS}
        ping["timestamp"] = str(row["timestamp"])
        for k in ("lat", "lng", "speed_kmh", "fuel_level_pct", "zone_distance_deg"):
            ping[k] = float(ping[k])
        for k in ("engine_on", "idle_minutes", "hour", "day_of_week", "is_working_hour"):
            ping[k] = int(ping[k])
        pings_batch.append(ping)
        if len(pings_batch) >= batch_size:
            result = post_json(api, {"pings": pings_batch})
            print(f"  batch: processed={result['processed']} anomalies={result['anomalies']}")
            pings_batch = []
    if pings_batch:
        result = post_json(api, {"pings": pings_batch})
        print(f"  batch: processed={result['processed']} anomalies={result['anomalies']}")
    print("replay done")


def seed(api: str) -> None:
    path = MODEL_DIR / "fleetguard_incidents.json"
    incidents = json.loads(path.read_text())
    pings = []
    for inc in incidents[:10]:
        pings.append(
            {
                "vehicle_id": inc["vehicle_id"],
                "timestamp": inc["timestamp"],
                "lat": inc["lat"],
                "lng": inc["lng"],
                "speed_kmh": inc["speed_kmh"],
                "fuel_level_pct": inc["fuel_level_pct"],
                "engine_on": 1,
                "idle_minutes": inc["idle_minutes"],
                "hour": inc["hour"],
                "is_working_hour": inc["is_working_hour"],
                "zone_distance_deg": inc["zone_distance_deg"],
            }
        )
    result = post_json(api, {"pings": pings})
    print(f"seed: processed={result['processed']} anomalies={result['anomalies']}")


def main() -> None:
    parser = argparse.ArgumentParser(description="FleetGuard Path A replayer / seeder")
    parser.add_argument("--api", required=True, help="API Gateway base URL")
    parser.add_argument("--mode", choices=("replay", "seed"), required=True)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--batch-size", type=int, default=25)
    args = parser.parse_args()
    if args.mode == "replay":
        replay(args.api, args.limit, args.batch_size)
    else:
        seed(args.api)


if __name__ == "__main__":
    main()
