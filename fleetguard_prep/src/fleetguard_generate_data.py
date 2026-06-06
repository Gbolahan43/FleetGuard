"""FleetGuard mock telemetry generator.

Fleet Intelligence - Fuel Theft & Route Abuse detector (Problem #2).

Generates realistic GPS telemetry for a small Lagos-based fleet and injects four kinds of
anomalous behaviour (route deviation, fuel theft, private use, excessive idle). The output is a
single labelled CSV written to ``fleetguard/mock_data/`` (prefixed ``fleetguard_`` for
identification) that the trainer consumes:

  - fleetguard_telemetry.csv   per-ping telemetry + is_anomaly / anomaly_type labels

Run (from repo root, venv active):  python fleetguard/src/fleetguard_generate_data.py
"""

from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

PROJECT = "fleetguard"
RANDOM_SEED = 42

N_VEHICLES = 10
DAYS = 30
RECORDS_PER_VEHICLE = 480  # ~16 pings/hr across a 10hr shift => 4,800 rows total
ANOMALY_RATE = 0.12        # 12% anomalous records injected

# Lagos area bounding box (lat, lng).
LAGOS_LAT = (6.43, 6.70)
LAGOS_LNG = (3.25, 3.55)

# Approved delivery zones (centroids).
APPROVED_ZONES = [
    {"name": "Lagos Island", "lat": 6.455, "lng": 3.395},
    {"name": "Victoria Island", "lat": 6.428, "lng": 3.421},
    {"name": "Ikeja", "lat": 6.601, "lng": 3.347},
    {"name": "Surulere", "lat": 6.499, "lng": 3.358},
    {"name": "Lekki", "lat": 6.465, "lng": 3.522},
]

VEHICLE_IDS = [f"LG-{1000 + i}" for i in range(N_VEHICLES)]

OUT_DIR = Path(__file__).resolve().parent.parent / "mock_data"


def nearest_zone_distance(lat: float, lng: float) -> float:
    """Euclidean proxy for distance from the nearest approved zone (degrees)."""
    dists = [np.sqrt((lat - z["lat"]) ** 2 + (lng - z["lng"]) ** 2) for z in APPROVED_ZONES]
    return float(min(dists))


def generate_normal_record(rng: np.random.Generator, vehicle_id: str, timestamp: datetime) -> dict:
    hour = timestamp.hour
    day = timestamp.weekday()  # 0 = Monday

    # Working hours: 7am-6pm weekdays, 8am-2pm Saturday, off Sunday.
    is_working_hour = (day < 5 and 7 <= hour <= 18) or (day == 5 and 8 <= hour <= 14)

    # Pick a random approved zone and scatter nearby.
    zone = APPROVED_ZONES[rng.integers(0, len(APPROVED_ZONES))]
    lat = zone["lat"] + rng.normal(0, 0.015)
    lng = zone["lng"] + rng.normal(0, 0.015)

    speed_kmh = rng.uniform(10, 65) if is_working_hour else rng.uniform(0, 5)

    # Fuel: slow linear decay during the work day.
    fuel_level = float(
        np.clip(rng.uniform(55, 95) - (hour - 7) * rng.uniform(1.2, 2.0), 15, 100)
    )

    engine_on = int(is_working_hour and rng.random() > 0.05)

    idle_minutes = int(
        rng.choice([0, 0, 0, 2, 5, 8, 12], p=[0.5, 0.15, 0.1, 0.1, 0.07, 0.05, 0.03])
    )

    return {
        "vehicle_id": vehicle_id,
        "timestamp": timestamp,
        "lat": round(lat, 6),
        "lng": round(lng, 6),
        "speed_kmh": round(speed_kmh, 1),
        "fuel_level_pct": round(fuel_level, 1),
        "engine_on": engine_on,
        "idle_minutes": idle_minutes,
        "hour": hour,
        "day_of_week": day,
        "is_working_hour": int(is_working_hour),
        "zone_distance_deg": round(nearest_zone_distance(lat, lng), 5),
        "is_anomaly": 0,
        "anomaly_type": "normal",
    }


def inject_anomaly(rng: np.random.Generator, record: dict) -> dict:
    """Overwrite a normal record with one of four anomaly patterns."""
    anomaly_types = ["route_deviation", "fuel_theft", "private_use", "excessive_idle"]
    atype = str(rng.choice(anomaly_types, p=[0.35, 0.30, 0.20, 0.15]))
    record["is_anomaly"] = 1
    record["anomaly_type"] = atype

    if atype == "route_deviation":
        # Vehicle far outside any approved zone (south/west of Lagos), speeding.
        record["lat"] = round(float(rng.uniform(6.35, 6.43)), 6)
        record["lng"] = round(float(rng.uniform(2.90, 3.20)), 6)
        record["zone_distance_deg"] = round(nearest_zone_distance(record["lat"], record["lng"]), 5)
        record["speed_kmh"] = round(float(rng.uniform(60, 110)), 1)

    elif atype == "fuel_theft":
        # Sudden large fuel drop with engine on but vehicle stationary.
        record["fuel_level_pct"] = round(float(rng.uniform(8, 22)), 1)
        record["speed_kmh"] = round(float(rng.uniform(0, 3)), 1)
        record["engine_on"] = 1
        record["idle_minutes"] = int(rng.integers(25, 90))

    elif atype == "private_use":
        # Movement outside working hours, outside the city (personal trip).
        record["hour"] = int(rng.choice([22, 23, 0, 1, 2, 3, 4, 5]))
        record["is_working_hour"] = 0
        record["engine_on"] = 1
        record["speed_kmh"] = round(float(rng.uniform(20, 75)), 1)
        record["lat"] = round(float(rng.uniform(6.70, 6.85)), 6)
        record["lng"] = round(float(rng.uniform(3.55, 3.75)), 6)
        record["zone_distance_deg"] = round(nearest_zone_distance(record["lat"], record["lng"]), 5)

    elif atype == "excessive_idle":
        # Engine running, no movement, for a very long period.
        record["idle_minutes"] = int(rng.integers(90, 240))
        record["speed_kmh"] = round(float(rng.uniform(0, 2)), 1)
        record["engine_on"] = 1

    return record


def build_dataset(rng: np.random.Generator) -> pd.DataFrame:
    print(f"[{PROJECT}] generating mock telemetry ...")
    records = []
    start_date = datetime(2025, 1, 1, 6, 0, 0)

    for vehicle_id in VEHICLE_IDS:
        for _ in range(RECORDS_PER_VEHICLE):
            ts = start_date + timedelta(
                days=int(rng.integers(0, DAYS)),
                hours=int(rng.integers(0, 24)),
                minutes=int(rng.integers(0, 60)),
            )
            record = generate_normal_record(rng, vehicle_id, ts)
            if rng.random() < ANOMALY_RATE:
                record = inject_anomaly(rng, record)
            records.append(record)

    df = (
        pd.DataFrame(records)
        .sort_values(["vehicle_id", "timestamp"])
        .reset_index(drop=True)
    )
    return df


def main() -> None:
    rng = np.random.default_rng(RANDOM_SEED)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    df = build_dataset(rng)
    path = OUT_DIR / "fleetguard_telemetry.csv"
    df.to_csv(path, index=False)

    print(f"[{PROJECT}] wrote {path}  ({len(df):,} rows, {df.shape[1]} cols)")
    print(f"[{PROJECT}] vehicles      : {df['vehicle_id'].nunique()}")
    print(
        f"[{PROJECT}] anomalies     : {int(df['is_anomaly'].sum()):,} "
        f"({df['is_anomaly'].mean() * 100:.1f}%)"
    )
    print(f"[{PROJECT}] anomaly types :")
    counts = df[df["is_anomaly"] == 1]["anomaly_type"].value_counts()
    for atype, n in counts.items():
        print(f"    {atype:<16} {n}")


if __name__ == "__main__":
    main()
