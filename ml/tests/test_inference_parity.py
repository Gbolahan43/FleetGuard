"""Parity: batch inference_core vs single-ping score_ping must agree."""

from __future__ import annotations

import pandas as pd

from inference.inference_core import engineer_features_ping, load_artifacts, score_dataframe, score_ping
from paths import TELEMETRY_CSV

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


def test_batch_and_single_ping_scores_match():
    model, scaler, _ = load_artifacts()
    df = pd.read_csv(TELEMETRY_CSV, parse_dates=["timestamp"]).head(200)
    scored = score_dataframe(df, model, scaler)

    for _, row in scored.iterrows():
        fuel_delta = float(row["fuel_delta"])
        ping = {c: row[c] for c in PING_COLS}
        ping["timestamp"] = str(row["timestamp"])
        single_is_anomaly, single_score = score_ping(ping, fuel_delta, model, scaler)
        assert single_is_anomaly == bool(row["is_anomaly"])
        assert abs(single_score - float(row["score"])) < 1e-4


def test_feature_vector_length():
    model, _, feature_cols = load_artifacts()
    assert model.n_features_in_ == len(feature_cols) == 12


def test_engineer_features_ping_order():
    ping = {
        "speed_kmh": 10,
        "fuel_level_pct": 50,
        "engine_on": 1,
        "idle_minutes": 5,
        "hour": 14,
        "day_of_week": 1,
        "is_working_hour": 1,
        "zone_distance_deg": 0.01,
    }
    vec = engineer_features_ping(ping, fuel_delta=-2.0)
    assert len(vec) == 12
