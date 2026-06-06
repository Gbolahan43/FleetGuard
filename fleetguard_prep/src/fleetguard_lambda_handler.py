"""FleetGuard - AWS Lambda anomaly scoring handler.

Deployment-ready (NOT deployed by this repo). This Lambda:
  1. Lazy-loads the trained IsolationForest + scaler from S3 (cached across warm invocations)
  2. Scores incoming telemetry pings
  3. Calls AWS Bedrock (Claude) to generate an incident report for each anomaly
  4. Stores incidents in DynamoDB

Feature engineering here MUST mirror fleetguard_train.py exactly (same column order as
fleetguard_feature_cols.json).

Deploy: zip this file (+ deps as a layer/container) into a Lambda.
Runtime: Python 3.11  |  Memory: 512MB  |  Timeout: 30s
Env vars: MODEL_BUCKET, MODEL_PREFIX (default "fleetguard-model"), DYNAMO_TABLE, BEDROCK_REGION
"""

import json
import os
import pickle
from datetime import datetime, timezone

import boto3
import numpy as np

# ─── Config ────────────────────────────────────────────────
TABLE_NAME = os.environ.get("DYNAMO_TABLE", "fleetguard-incidents")
BUCKET_NAME = os.environ.get("MODEL_BUCKET", "your-hackathon-bucket")
MODEL_PREFIX = os.environ.get("MODEL_PREFIX", "fleetguard-model")
BEDROCK_REGION = os.environ.get("BEDROCK_REGION", "us-east-1")
BEDROCK_MODEL_ID = os.environ.get(
    "BEDROCK_MODEL_ID", "anthropic.claude-3-5-sonnet-20241022-v2:0"
)

# Artifact object names in S3 (under MODEL_PREFIX/).
MODEL_KEY = "fleetguard_anomaly_model.pkl"
SCALER_KEY = "fleetguard_scaler.pkl"
FEATURES_KEY = "fleetguard_feature_cols.json"

# ─── AWS clients ───────────────────────────────────────────
dynamodb = boto3.resource("dynamodb")
bedrock = boto3.client("bedrock-runtime", region_name=BEDROCK_REGION)
s3 = boto3.client("s3")

# ─── Lazy-loaded model state (persists across warm invocations) ──
_model = None
_scaler = None
_feat_cols = None


def load_model() -> None:
    global _model, _scaler, _feat_cols
    if _model is not None:
        return

    for key in (MODEL_KEY, SCALER_KEY, FEATURES_KEY):
        s3.download_file(BUCKET_NAME, f"{MODEL_PREFIX}/{key}", f"/tmp/{key}")

    with open(f"/tmp/{MODEL_KEY}", "rb") as f:
        _model = pickle.load(f)
    with open(f"/tmp/{SCALER_KEY}", "rb") as f:
        _scaler = pickle.load(f)
    with open(f"/tmp/{FEATURES_KEY}") as f:
        _feat_cols = json.load(f)


def engineer_features(ping: dict) -> list:
    """Build the feature vector for one ping. Order must match fleetguard_feature_cols.json."""
    speed = float(ping.get("speed_kmh", 0))
    fuel = float(ping.get("fuel_level_pct", 100))
    engine = int(ping.get("engine_on", 0))
    idle = float(ping.get("idle_minutes", 0))
    hour = int(ping.get("hour", 12))
    dow = int(ping.get("day_of_week", 0))
    working = int(ping.get("is_working_hour", 1))
    zone_dist = float(ping.get("zone_distance_deg", 0))
    fuel_delta = float(ping.get("fuel_delta", 0))  # caller computes vs previous ping
    off_hrs_speed = speed * (1 - working)
    idle_speed_ratio = idle / (speed + 1)
    zone_breach = int(zone_dist > 0.08)

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


def generate_incident_report(ping: dict, score: float) -> str:
    prompt = (
        f"Vehicle {ping['vehicle_id']} triggered a fleet anomaly alert at "
        f"{ping.get('timestamp', 'unknown time')} "
        f"(hour {ping.get('hour', '?')}, "
        f"{'working' if ping.get('is_working_hour') else 'off'} hours). "
        f"Speed: {ping.get('speed_kmh')} km/h. "
        f"Fuel level: {ping.get('fuel_level_pct')}% "
        f"(change from last ping: {float(ping.get('fuel_delta', 0)):.1f}%). "
        f"Idle time: {ping.get('idle_minutes', 0)} minutes. "
        f"Distance from approved zone: "
        f"{round(float(ping.get('zone_distance_deg', 0)) * 111, 1)} km. "
        f"Anomaly confidence score: {abs(score):.3f}. "
        f"Write a concise 3-sentence incident report for the fleet manager "
        f"covering: (1) what was detected, (2) likely cause, "
        f"(3) recommended immediate action."
    )

    response = bedrock.invoke_model(
        modelId=BEDROCK_MODEL_ID,
        body=json.dumps(
            {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 300,
                "messages": [{"role": "user", "content": prompt}],
            }
        ),
        contentType="application/json",
        accept="application/json",
    )
    result = json.loads(response["body"].read())
    return result["content"][0]["text"]


def store_incident(ping: dict, score: float, report: str) -> None:
    table = dynamodb.Table(TABLE_NAME)
    now = datetime.now(timezone.utc).isoformat()
    table.put_item(
        Item={
            "incident_id": f"{ping['vehicle_id']}_{ping.get('timestamp', now)}",
            "vehicle_id": ping["vehicle_id"],
            "timestamp": ping.get("timestamp", now),
            "anomaly_score": str(round(score, 4)),
            "lat": str(ping.get("lat")),
            "lng": str(ping.get("lng")),
            "speed_kmh": str(ping.get("speed_kmh")),
            "fuel_level_pct": str(ping.get("fuel_level_pct")),
            "fuel_delta": str(ping.get("fuel_delta", 0)),
            "idle_minutes": str(ping.get("idle_minutes", 0)),
            "report": report,
            "created_at": now,
        }
    )


def handler(event, context):
    """API entry point.

    Expects an event body with a list of telemetry pings:
      {"pings": [{"vehicle_id": "LG-1001", "timestamp": "...", "speed_kmh": 12.5,
                  "fuel_level_pct": 34.2, "fuel_delta": -18.5, "idle_minutes": 45,
                  "hour": 14, "day_of_week": 2, "is_working_hour": 1,
                  "zone_distance_deg": 0.003, "engine_on": 1, "lat": .., "lng": ..}]}
    """
    load_model()

    body = json.loads(event.get("body", "{}")) if isinstance(event.get("body"), str) else event.get("body", {})
    pings = (body or {}).get("pings", [])

    if not pings:
        return {"statusCode": 400, "body": json.dumps({"error": "No pings provided"})}

    results = []
    for ping in pings:
        features = engineer_features(ping)
        x_scaled = _scaler.transform([features])
        prediction = _model.predict(x_scaled)[0]  # -1 = anomaly, 1 = normal
        score = float(_model.score_samples(x_scaled)[0])
        is_anomaly = prediction == -1

        result = {
            "vehicle_id": ping["vehicle_id"],
            "timestamp": ping.get("timestamp"),
            "is_anomaly": bool(is_anomaly),
            "score": round(score, 4),
            "report": None,
        }

        if is_anomaly:
            report = generate_incident_report(ping, score)
            store_incident(ping, score, report)
            result["report"] = report

        results.append(result)

    anomaly_count = sum(1 for r in results if r["is_anomaly"])

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(
            {"processed": len(results), "anomalies": anomaly_count, "results": results}
        ),
    }
