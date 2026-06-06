"""FleetGuard anomaly-detector training.

Loads the generated telemetry, engineers anomaly-amplifying features, trains an unsupervised
IsolationForest, evaluates it against the injected labels, builds Bedrock-ready incident
payloads, and serializes all artifacts (prefixed ``fleetguard_``) to ``fleetguard/models/``:

  - fleetguard_anomaly_model.pkl    trained IsolationForest
  - fleetguard_scaler.pkl           StandardScaler
  - fleetguard_feature_cols.json    feature column order (runtime must match)
  - fleetguard_model_metadata.json  algorithm + config + row counts
  - fleetguard_eval_metrics.json    precision/recall/F1 + per-type detection rates
  - fleetguard_incidents.json       top Bedrock-ready incident payloads
  - fleetguard_summary.json         dashboard summary stats

Run (from repo root, venv active):  python fleetguard/src/fleetguard_train.py
"""

from __future__ import annotations

import json
import pickle
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.metrics import classification_report
from sklearn.preprocessing import StandardScaler

PROJECT = "fleetguard"
RANDOM_SEED = 42
ANOMALY_RATE = 0.12  # contamination; matches the injected rate in the generator

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "mock_data"
MODEL_DIR = ROOT / "models"

# Base telemetry features straight from the generated CSV.
FEATURE_COLS = [
    "speed_kmh",
    "fuel_level_pct",
    "engine_on",
    "idle_minutes",
    "hour",
    "day_of_week",
    "is_working_hour",
    "zone_distance_deg",
]

# Derived features added in engineer_features (kept in lock-step with the Lambda handler).
ENGINEERED_COLS = FEATURE_COLS + [
    "fuel_delta",
    "off_hours_speed",
    "idle_speed_ratio",
    "zone_breach",
]


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add derived features that amplify anomaly signals (computed per vehicle)."""
    df = df.copy()
    # Fuel drop from previous ping (large negative => possible theft).
    df["fuel_delta"] = df.groupby("vehicle_id")["fuel_level_pct"].diff().fillna(0)
    # Moving fast outside working hours.
    df["off_hours_speed"] = df["speed_kmh"] * (1 - df["is_working_hour"])
    # High idle relative to speed.
    df["idle_speed_ratio"] = df["idle_minutes"] / (df["speed_kmh"] + 1)
    # Outside approved zones.
    df["zone_breach"] = (df["zone_distance_deg"] > 0.08).astype(int)
    return df


def train_model(df: pd.DataFrame) -> tuple[IsolationForest, StandardScaler, pd.DataFrame]:
    print(f"[{PROJECT}] training IsolationForest anomaly detector ...")
    df = engineer_features(df)
    X = df[ENGINEERED_COLS].values

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    model = IsolationForest(
        n_estimators=200,
        contamination=ANOMALY_RATE,
        max_samples="auto",
        random_state=RANDOM_SEED,
        n_jobs=-1,
    )
    model.fit(X_scaled)

    raw_preds = model.predict(X_scaled)  # -1 = anomaly, 1 = normal
    df["predicted"] = (raw_preds == -1).astype(int)
    df["anomaly_score"] = model.score_samples(X_scaled)  # lower = more anomalous
    return model, scaler, df


def evaluate(df: pd.DataFrame) -> dict:
    print(f"\n[{PROJECT}] evaluation (injected labels as ground truth):")
    report = classification_report(
        df["is_anomaly"],
        df["predicted"],
        target_names=["Normal", "Anomaly"],
        digits=3,
        output_dict=True,
    )
    print(
        classification_report(
            df["is_anomaly"], df["predicted"], target_names=["Normal", "Anomaly"], digits=3
        )
    )

    # Detection rate by anomaly type.
    print(f"[{PROJECT}] detection rate by anomaly type:")
    per_type = {}
    flagged = df[df["is_anomaly"] == 1]
    for atype, g in flagged.groupby("anomaly_type"):
        rate = float(g["predicted"].mean())
        per_type[atype] = {"detected_pct": round(rate * 100, 1), "n_records": int(len(g))}
        print(f"    {atype:<16} {rate * 100:5.1f}% detected ({len(g)} records)")

    metrics = {
        "classification_report": report,
        "detection_by_type": per_type,
        "n_records": int(len(df)),
        "n_true_anomalies": int(df["is_anomaly"].sum()),
        "n_predicted_anomalies": int(df["predicted"].sum()),
    }
    return metrics


def build_incidents(df: pd.DataFrame) -> list[dict]:
    """Extract the worst incidents per vehicle as Bedrock-ready payloads."""
    flagged = df[df["predicted"] == 1].copy()
    incidents = []
    for vehicle_id, group in flagged.groupby("vehicle_id"):
        worst = group.nsmallest(3, "anomaly_score")  # most anomalous pings
        for _, row in worst.iterrows():
            incidents.append(
                {
                    "vehicle_id": vehicle_id,
                    "timestamp": str(row["timestamp"]),
                    "lat": float(row["lat"]),
                    "lng": float(row["lng"]),
                    "speed_kmh": float(row["speed_kmh"]),
                    "fuel_level_pct": float(row["fuel_level_pct"]),
                    "fuel_delta": round(float(row["fuel_delta"]), 2),
                    "idle_minutes": int(row["idle_minutes"]),
                    "hour": int(row["hour"]),
                    "is_working_hour": int(row["is_working_hour"]),
                    "zone_distance_deg": float(row["zone_distance_deg"]),
                    "anomaly_score": round(float(row["anomaly_score"]), 4),
                    "bedrock_prompt": (
                        f"Vehicle {vehicle_id} triggered a fleet anomaly alert at "
                        f"{row['timestamp']} (hour {int(row['hour'])}, "
                        f"{'working' if row['is_working_hour'] else 'off'} hours). "
                        f"Speed: {row['speed_kmh']} km/h. "
                        f"Fuel level: {row['fuel_level_pct']}% "
                        f"(change: {round(float(row['fuel_delta']), 1)}%). "
                        f"Idle time: {int(row['idle_minutes'])} minutes. "
                        f"Distance from approved zone: "
                        f"{round(float(row['zone_distance_deg']) * 111, 1)} km. "
                        f"Write a concise incident report for the fleet manager "
                        f"highlighting the risk, likely cause, and recommended action."
                    ),
                }
            )
    return incidents


def save_artifacts(
    model: IsolationForest,
    scaler: StandardScaler,
    df: pd.DataFrame,
    metrics: dict,
    incidents: list[dict],
) -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    print(f"\n[{PROJECT}] saving artifacts to {MODEL_DIR}")

    with open(MODEL_DIR / "fleetguard_anomaly_model.pkl", "wb") as f:
        pickle.dump(model, f)
    with open(MODEL_DIR / "fleetguard_scaler.pkl", "wb") as f:
        pickle.dump(scaler, f)
    with open(MODEL_DIR / "fleetguard_feature_cols.json", "w") as f:
        json.dump(ENGINEERED_COLS, f, indent=2)

    metadata = {
        "project": PROJECT,
        "model_name": "fleetguard_anomaly_model",
        "algorithm": "IsolationForest",
        "supervised": False,
        "target": "is_anomaly (fuel theft / route abuse / private use / excessive idle)",
        "features": ENGINEERED_COLS,
        "n_features": len(ENGINEERED_COLS),
        "contamination": ANOMALY_RATE,
        "n_estimators": 200,
        "seed": RANDOM_SEED,
        "n_records": int(len(df)),
        "n_vehicles": int(df["vehicle_id"].nunique()),
        "hyperparameters": model.get_params(),
    }
    with open(MODEL_DIR / "fleetguard_model_metadata.json", "w") as f:
        json.dump(metadata, f, indent=2, default=str)

    with open(MODEL_DIR / "fleetguard_eval_metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)

    with open(MODEL_DIR / "fleetguard_incidents.json", "w") as f:
        json.dump(incidents[:20], f, indent=2, default=str)

    summary = {
        "total_records": int(len(df)),
        "total_vehicles": int(df["vehicle_id"].nunique()),
        "anomaly_count": int(df["predicted"].sum()),
        "anomaly_rate_pct": round(float(df["predicted"].mean()) * 100, 1),
        "top_vehicle": df[df["predicted"] == 1].groupby("vehicle_id").size().idxmax(),
        "breakdown": df[df["predicted"] == 1]["anomaly_type"].value_counts().to_dict(),
    }
    with open(MODEL_DIR / "fleetguard_summary.json", "w") as f:
        json.dump(summary, f, indent=2)

    for fname in [
        "fleetguard_anomaly_model.pkl",
        "fleetguard_scaler.pkl",
        "fleetguard_feature_cols.json",
        "fleetguard_model_metadata.json",
        "fleetguard_eval_metrics.json",
        "fleetguard_incidents.json",
        "fleetguard_summary.json",
    ]:
        print(f"    {fname}")


def main() -> None:
    print("=" * 55)
    print("  FleetGuard - Anomaly Detector Training")
    print("=" * 55)

    path = DATA_DIR / "fleetguard_telemetry.csv"
    print(f"[{PROJECT}] loading {path}")
    df = pd.read_csv(path, parse_dates=["timestamp"])

    model, scaler, df = train_model(df)
    metrics = evaluate(df)
    incidents = build_incidents(df)
    print(f"\n[{PROJECT}] built {len(incidents)} Bedrock-ready incident payloads")
    if incidents:
        print(f"[{PROJECT}] sample prompt:\n{'-' * 50}\n{incidents[0]['bedrock_prompt']}\n{'-' * 50}")

    save_artifacts(model, scaler, df, metrics, incidents)
    print(f"\n[{PROJECT}] done. Artifacts in {MODEL_DIR}")


if __name__ == "__main__":
    main()
