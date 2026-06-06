"""Path A — AWS Lambda handler: POST /score, GET /incidents.

Uses shared inference_core + vehicle-state DynamoDB for server-side fuel_delta.
Deploy via ml/Dockerfile.lambda — CMD realtime.handler.handler
"""

from __future__ import annotations

import json
import os
import pickle
from decimal import Decimal
from datetime import datetime, timezone
from typing import Any

import boto3

from inference.bedrock_models import BEDROCK_MODEL_ID as DEFAULT_BEDROCK_MODEL_ID
from inference.constants import FEATURES_KEY, MODEL_KEY, SCALER_KEY
from inference.inference_core import load_artifacts, score_ping

TABLE_NAME = os.environ.get("DYNAMO_TABLE", "fleetguard-incidents")
STATE_TABLE = os.environ.get("STATE_TABLE", "fleetguard-vehicle-state")
BUCKET_NAME = os.environ.get("MODEL_BUCKET", "your-hackathon-bucket")
MODEL_PREFIX = os.environ.get("MODEL_PREFIX", "fleetguard-model")
BEDROCK_REGION = os.environ.get("BEDROCK_REGION", "us-west-2")
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", DEFAULT_BEDROCK_MODEL_ID)

dynamodb = boto3.resource("dynamodb")
bedrock = boto3.client("bedrock-runtime", region_name=BEDROCK_REGION)
s3 = boto3.client("s3")

_model = None
_scaler = None
_feat_cols = None


def _load_model_from_s3() -> None:
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


def _load_model_local() -> None:
    """Local dev when MODEL_BUCKET is unset."""
    global _model, _scaler, _feat_cols
    if _model is not None:
        return
    _model, _scaler, _feat_cols = load_artifacts()


def load_model() -> None:
    if os.environ.get("MODEL_BUCKET"):
        _load_model_from_s3()
    else:
        _load_model_local()


def compute_fuel_delta(vehicle_id: str, current_fuel: float) -> float:
    table = dynamodb.Table(STATE_TABLE)
    resp = table.get_item(Key={"vehicle_id": vehicle_id})
    item = resp.get("Item")
    if not item:
        return 0.0
    return current_fuel - float(item["fuel_level_pct"])


def update_vehicle_state(ping: dict[str, Any]) -> None:
    table = dynamodb.Table(STATE_TABLE)
    table.put_item(
        Item={
            "vehicle_id": ping["vehicle_id"],
            "fuel_level_pct": Decimal(str(ping["fuel_level_pct"])),
            "timestamp": str(ping.get("timestamp", "")),
            "lat": str(ping.get("lat", "")),
            "lng": str(ping.get("lng", "")),
        }
    )


def _fallback_incident_report(ping: dict[str, Any], score: float, fuel_delta: float) -> str:
    zone_km = round(float(ping.get("zone_distance_deg", 0)) * 111, 1)
    return (
        f"Vehicle {ping['vehicle_id']} triggered an anomaly at "
        f"{ping.get('timestamp', 'unknown time')}: score {score:.3f}, "
        f"speed {ping.get('speed_kmh')} km/h, fuel {ping.get('fuel_level_pct')}% "
        f"(delta {fuel_delta:.1f}%), idle {ping.get('idle_minutes', 0)} min, "
        f"~{zone_km} km from approved zone. Review telemetry and contact the driver."
    )


def generate_incident_report(ping: dict[str, Any], score: float, fuel_delta: float) -> str:
    prompt = (
        f"Vehicle {ping['vehicle_id']} triggered a fleet anomaly alert at "
        f"{ping.get('timestamp', 'unknown time')} "
        f"(hour {ping.get('hour', '?')}, "
        f"{'working' if ping.get('is_working_hour') else 'off'} hours). "
        f"Speed: {ping.get('speed_kmh')} km/h. "
        f"Fuel level: {ping.get('fuel_level_pct')}% "
        f"(change from last ping: {fuel_delta:.1f}%). "
        f"Idle time: {ping.get('idle_minutes', 0)} minutes. "
        f"Distance from approved zone: "
        f"{round(float(ping.get('zone_distance_deg', 0)) * 111, 1)} km. "
        f"Anomaly confidence score: {abs(score):.3f}. "
        f"Write a concise 3-sentence incident report for the fleet manager."
    )
    try:
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
    except Exception:
        return _fallback_incident_report(ping, score, fuel_delta)


def store_incident(ping: dict[str, Any], score: float, fuel_delta: float, report: str) -> None:
    table = dynamodb.Table(TABLE_NAME)
    now = datetime.now(timezone.utc).isoformat()
    table.put_item(
        Item={
            "incident_id": f"{ping['vehicle_id']}_{ping.get('timestamp', now)}",
            "vehicle_id": ping["vehicle_id"],
            "source": "realtime",
            "timestamp": str(ping.get("timestamp", now)),
            "anomaly_score": str(round(score, 4)),
            "lat": str(ping.get("lat")),
            "lng": str(ping.get("lng")),
            "speed_kmh": str(ping.get("speed_kmh")),
            "fuel_level_pct": str(ping.get("fuel_level_pct")),
            "fuel_delta": str(round(fuel_delta, 2)),
            "idle_minutes": str(ping.get("idle_minutes", 0)),
            "report": report,
            "created_at": now,
        }
    )


def list_incidents(
    limit: int = 50,
    vehicle_id: str | None = None,
    source: str | None = None,
) -> list[dict]:
    table = dynamodb.Table(TABLE_NAME)
    if vehicle_id:
        resp = table.query(
            IndexName="vehicle_id-index",
            KeyConditionExpression="vehicle_id = :v",
            ExpressionAttributeValues={":v": vehicle_id},
            Limit=limit,
        )
        items = resp.get("Items", [])
    else:
        resp = table.scan(Limit=min(limit, 200))
        items = resp.get("Items", [])
    if source:
        items = [i for i in items if i.get("source") == source]
    items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return items[:limit]


def score_pings(pings: list[dict[str, Any]]) -> dict[str, Any]:
    load_model()
    results = []
    for ping in pings:
        fuel_delta = compute_fuel_delta(ping["vehicle_id"], float(ping["fuel_level_pct"]))
        is_anomaly, score = score_ping(ping, fuel_delta, _model, _scaler)
        ping_with_delta = {**ping, "fuel_delta": fuel_delta}
        result: dict[str, Any] = {
            "vehicle_id": ping["vehicle_id"],
            "timestamp": ping.get("timestamp"),
            "is_anomaly": is_anomaly,
            "score": round(score, 4),
            "report": None,
        }
        if is_anomaly:
            report = generate_incident_report(ping_with_delta, score, fuel_delta)
            store_incident(ping_with_delta, score, fuel_delta, report)
            result["report"] = report
        update_vehicle_state(ping)
        results.append(result)
    return {
        "processed": len(results),
        "anomalies": sum(1 for r in results if r["is_anomaly"]),
        "results": results,
    }


def _route(event: dict) -> tuple[str, str]:
    ctx = event.get("requestContext", {}).get("http", {})
    return ctx.get("method", "POST").upper(), ctx.get("path", "/score")


def handler(event, context):
    if event.get("warmup"):
        return {"statusCode": 200, "body": json.dumps({"warm": True})}

    method, path = _route(event)

    if method == "GET" and path.endswith("/incidents"):
        params = event.get("queryStringParameters") or {}
        limit = int(params.get("limit", 50))
        incidents = list_incidents(
            limit=limit,
            vehicle_id=params.get("vehicle_id"),
            source=params.get("source"),
        )
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"incidents": incidents}),
        }

    if method == "POST" and path.endswith("/score"):
        body = (
            json.loads(event["body"])
            if isinstance(event.get("body"), str)
            else event.get("body", {})
        )
        pings = (body or {}).get("pings", [])
        if not pings:
            return {
                "statusCode": 400,
                "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"error": "No pings provided"}),
            }
        payload = score_pings(pings)
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps(payload),
        }

    return {
        "statusCode": 404,
        "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
        "body": json.dumps({"error": "Not found"}),
    }
