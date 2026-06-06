import json
from typing import Any

from app.core.aws_client import bedrock_runtime
from app.core.config import get_settings


def _fallback_report(row: dict[str, Any]) -> str:
    return (
        f"Vehicle {row['vehicle_id']} flagged at {row['timestamp']}: "
        f"anomaly score {row['score']:.3f}. "
        f"Review fuel change ({row.get('fuel_delta', 0):.1f}%), "
        f"speed ({row.get('speed_kmh')} km/h), and zone distance."
    )


def generate_insight(row: dict[str, Any]) -> str:
    settings = get_settings()
    if not settings.bedrock_enabled:
        return _fallback_report(row)

    prompt = (
        f"Vehicle {row['vehicle_id']} anomaly at {row['timestamp']}. "
        f"Score: {row['score']:.3f}. Speed: {row.get('speed_kmh')} km/h. "
        f"Fuel: {row.get('fuel_level_pct')}% (delta {row.get('fuel_delta', 0):.1f}). "
        f"Write a 2-sentence fleet manager insight with recommended action."
    )
    client = bedrock_runtime()
    response = client.invoke_model(
        modelId=settings.bedrock_model_id,
        body=json.dumps(
            {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 200,
                "messages": [{"role": "user", "content": prompt}],
            }
        ),
        contentType="application/json",
        accept="application/json",
    )
    result = json.loads(response["body"].read())
    return result["content"][0]["text"]
