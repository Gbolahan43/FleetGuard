from __future__ import annotations

import io
from functools import lru_cache
from typing import Any

import pandas as pd

import app.core.ml_path  # noqa: F401 — must run before inference imports

from inference.inference_core import load_artifacts, score_dataframe
from app.core.config import get_settings
from app.schemas.fleet_data import AnalyzeFleetResponse, AnomalyReport, FleetSummary, ScoredRow
from app.services.agent_bedrock import generate_insight

REQUIRED_CSV_COLUMNS = [
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


@lru_cache
def _get_model_bundle():
    settings = get_settings()
    return load_artifacts(settings.model_path)


def analyze_fleet_csv(file_bytes: bytes) -> AnalyzeFleetResponse:
    df = pd.read_csv(io.BytesIO(file_bytes), parse_dates=["timestamp"])
    missing = [c for c in REQUIRED_CSV_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required column(s): {', '.join(missing)}")
    if df.empty:
        raise ValueError("CSV file is empty")

    model, scaler, feature_cols = _get_model_bundle()
    scored = score_dataframe(df, model, scaler, feature_cols)

    if "anomaly_type" not in scored.columns:
        scored["anomaly_type"] = "normal"
    scored.loc[scored["is_anomaly"], "anomaly_type"] = scored.loc[scored["is_anomaly"], "anomaly_type"].replace(
        "normal", "anomaly"
    )

    anomaly_df = scored[scored["is_anomaly"]].copy()
    breakdown: dict[str, int] = {}
    if "anomaly_type" in anomaly_df.columns:
        breakdown = {
            str(k): int(v)
            for k, v in anomaly_df["anomaly_type"].value_counts().items()
            if str(k) != "normal"
        }

    summary = FleetSummary(
        total_rows=int(len(scored)),
        total_vehicles=int(scored["vehicle_id"].nunique()),
        anomaly_count=int(scored["is_anomaly"].sum()),
        anomaly_rate_pct=round(float(scored["is_anomaly"].mean()) * 100, 1),
        breakdown=breakdown,
    )

    rows = [_row_to_scored(r) for _, r in scored.iterrows()]

    settings = get_settings()
    top = anomaly_df.nsmallest(settings.top_n_anomalies, "score")
    anomalies = [_row_to_anomaly_report(r) for _, r in top.iterrows()]

    return AnalyzeFleetResponse(summary=summary, rows=rows, anomalies=anomalies)


def _row_to_scored(row: pd.Series) -> ScoredRow:
    return ScoredRow(
        vehicle_id=str(row["vehicle_id"]),
        timestamp=str(row["timestamp"]),
        lat=float(row["lat"]),
        lng=float(row["lng"]),
        speed_kmh=float(row["speed_kmh"]),
        fuel_level_pct=float(row["fuel_level_pct"]),
        fuel_delta=float(row["fuel_delta"]),
        is_anomaly=bool(row["is_anomaly"]),
        score=round(float(row["score"]), 4),
        anomaly_type=str(row.get("anomaly_type", "normal")),
    )


def _row_to_anomaly_report(row: pd.Series) -> AnomalyReport:
    payload: dict[str, Any] = {
        "vehicle_id": str(row["vehicle_id"]),
        "timestamp": str(row["timestamp"]),
        "lat": float(row["lat"]),
        "lng": float(row["lng"]),
        "score": round(float(row["score"]), 4),
        "anomaly_type": str(row.get("anomaly_type", "unknown")),
        "fuel_level_pct": float(row["fuel_level_pct"]),
        "fuel_delta": float(row["fuel_delta"]),
        "speed_kmh": float(row["speed_kmh"]),
    }
    return AnomalyReport(**payload, report=generate_insight(payload))
