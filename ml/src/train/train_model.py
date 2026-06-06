"""Train IsolationForest and write artifacts to ml/models/."""

from __future__ import annotations

import json
import pickle
import sys
from pathlib import Path

import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.metrics import classification_report
from sklearn.preprocessing import StandardScaler

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from inference.constants import ANOMALY_RATE, ENGINEERED_COLS, PROJECT, RANDOM_SEED  # noqa: E402
from inference.inference_core import engineer_features  # noqa: E402
from paths import MODEL_DIR, TELEMETRY_CSV  # noqa: E402


def train_model(df: pd.DataFrame) -> tuple[IsolationForest, StandardScaler, pd.DataFrame]:
    print(f"[{PROJECT}] training IsolationForest ...")
    df = engineer_features(df)
    x = df[ENGINEERED_COLS].values
    scaler = StandardScaler()
    x_scaled = scaler.fit_transform(x)
    model = IsolationForest(
        n_estimators=200,
        contamination=ANOMALY_RATE,
        max_samples="auto",
        random_state=RANDOM_SEED,
        n_jobs=-1,
    )
    model.fit(x_scaled)
    raw_preds = model.predict(x_scaled)
    df["predicted"] = (raw_preds == -1).astype(int)
    df["anomaly_score"] = model.score_samples(x_scaled)
    return model, scaler, df


def evaluate(df: pd.DataFrame) -> dict:
    print(f"\n[{PROJECT}] evaluation:")
    report = classification_report(
        df["is_anomaly"],
        df["predicted"],
        target_names=["Normal", "Anomaly"],
        digits=3,
        output_dict=True,
    )
    print(classification_report(df["is_anomaly"], df["predicted"], target_names=["Normal", "Anomaly"], digits=3))
    per_type = {}
    for atype, g in df[df["is_anomaly"] == 1].groupby("anomaly_type"):
        rate = float(g["predicted"].mean())
        per_type[atype] = {"detected_pct": round(rate * 100, 1), "n_records": int(len(g))}
    return {
        "classification_report": report,
        "detection_by_type": per_type,
        "n_records": int(len(df)),
        "n_true_anomalies": int(df["is_anomaly"].sum()),
        "n_predicted_anomalies": int(df["predicted"].sum()),
    }


def build_incidents(df: pd.DataFrame) -> list[dict]:
    flagged = df[df["predicted"] == 1].copy()
    incidents = []
    for vehicle_id, group in flagged.groupby("vehicle_id"):
        for _, row in group.nsmallest(3, "anomaly_score").iterrows():
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
                        f"Write a concise incident report for the fleet manager."
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
    with open(MODEL_DIR / "fleetguard_anomaly_model.pkl", "wb") as f:
        pickle.dump(model, f)
    with open(MODEL_DIR / "fleetguard_scaler.pkl", "wb") as f:
        pickle.dump(scaler, f)
    with open(MODEL_DIR / "fleetguard_feature_cols.json", "w") as f:
        json.dump(ENGINEERED_COLS, f, indent=2)
    metadata = {
        "project": PROJECT,
        "algorithm": "IsolationForest",
        "features": ENGINEERED_COLS,
        "contamination": ANOMALY_RATE,
        "n_records": int(len(df)),
        "n_vehicles": int(df["vehicle_id"].nunique()),
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
        "breakdown": df[df["predicted"] == 1]["anomaly_type"].value_counts().to_dict(),
    }
    with open(MODEL_DIR / "fleetguard_summary.json", "w") as f:
        json.dump(summary, f, indent=2)
    print(f"[{PROJECT}] artifacts saved to {MODEL_DIR}")


def main() -> None:
    print("=" * 55)
    print("  FleetGuard - Train IsolationForest")
    print("=" * 55)
    df = pd.read_csv(TELEMETRY_CSV, parse_dates=["timestamp"])
    model, scaler, df = train_model(df)
    metrics = evaluate(df)
    incidents = build_incidents(df)
    save_artifacts(model, scaler, df, metrics, incidents)


if __name__ == "__main__":
    main()
