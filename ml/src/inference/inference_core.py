"""Shared IsolationForest inference — used by Path A (Lambda) and Path B (FastAPI batch)."""

from __future__ import annotations

import json
import pickle
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

from inference.constants import (
    ENGINEERED_COLS,
    FEATURES_KEY,
    MODEL_KEY,
    SCALER_KEY,
    ZONE_BREACH_THRESHOLD,
)
from paths import MODEL_DIR


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Batch feature engineering (Path B). fuel_delta via groupby per vehicle."""
    df = df.copy()
    df["fuel_delta"] = df.groupby("vehicle_id")["fuel_level_pct"].diff().fillna(0)
    df["off_hours_speed"] = df["speed_kmh"] * (1 - df["is_working_hour"])
    df["idle_speed_ratio"] = df["idle_minutes"] / (df["speed_kmh"] + 1)
    df["zone_breach"] = (df["zone_distance_deg"] > ZONE_BREACH_THRESHOLD).astype(int)
    return df


def engineer_features_ping(ping: dict[str, Any], fuel_delta: float) -> list[float]:
    """Single-ping feature vector (Path A). Order = ENGINEERED_COLS."""
    speed = float(ping.get("speed_kmh", 0))
    fuel = float(ping.get("fuel_level_pct", 100))
    engine = int(ping.get("engine_on", 0))
    idle = float(ping.get("idle_minutes", 0))
    hour = int(ping.get("hour", 12))
    dow = int(ping.get("day_of_week", 0))
    working = int(ping.get("is_working_hour", 1))
    zone_dist = float(ping.get("zone_distance_deg", 0))
    off_hrs_speed = speed * (1 - working)
    idle_speed_ratio = idle / (speed + 1)
    zone_breach = int(zone_dist > ZONE_BREACH_THRESHOLD)

    return [
        speed,
        fuel,
        engine,
        idle,
        hour,
        dow,
        working,
        zone_dist,
        fuel_delta,
        off_hrs_speed,
        idle_speed_ratio,
        zone_breach,
    ]


def load_artifacts(
    model_dir: Path | None = None,
) -> tuple[IsolationForest, StandardScaler, list[str]]:
    """Load model, scaler, and feature column order from disk."""
    root = model_dir or MODEL_DIR
    with open(root / MODEL_KEY, "rb") as f:
        model = pickle.load(f)
    with open(root / SCALER_KEY, "rb") as f:
        scaler = pickle.load(f)
    with open(root / FEATURES_KEY) as f:
        feature_cols = json.load(f)
    if feature_cols != ENGINEERED_COLS:
        raise ValueError("feature_cols.json out of sync with inference.constants.ENGINEERED_COLS")
    return model, scaler, feature_cols


def score_dataframe(
    df: pd.DataFrame,
    model: IsolationForest,
    scaler: StandardScaler,
    feature_cols: list[str] | None = None,
) -> pd.DataFrame:
    """Score all rows; adds predicted, anomaly_score, is_anomaly."""
    cols = feature_cols or ENGINEERED_COLS
    engineered = engineer_features(df)
    x_scaled = scaler.transform(engineered[cols].values)
    raw_preds = model.predict(x_scaled)
    engineered["predicted"] = (raw_preds == -1).astype(int)
    engineered["anomaly_score"] = model.score_samples(x_scaled)
    engineered["is_anomaly"] = engineered["predicted"].astype(bool)
    engineered["score"] = engineered["anomaly_score"]
    return engineered


def score_ping(
    ping: dict[str, Any],
    fuel_delta: float,
    model: IsolationForest,
    scaler: StandardScaler,
) -> tuple[bool, float]:
    """Score one ping (Path A). Returns (is_anomaly, score)."""
    features = engineer_features_ping(ping, fuel_delta)
    x_scaled = scaler.transform([features])
    prediction = model.predict(x_scaled)[0]
    score = float(model.score_samples(x_scaled)[0])
    return prediction == -1, score
