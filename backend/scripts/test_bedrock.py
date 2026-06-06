"""Test Bedrock access using current AWS credential chain (.env or default profile).

Usage (cmd) — default account:
  set AWS_PROFILE=
  cd backend
  python scripts/test_bedrock.py

Usage — fleetguard profile:
  set AWS_PROFILE=fleetguard
  python scripts/test_bedrock.py
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

import boto3  # noqa: E402

REGION = os.getenv("AWS_REGION", "us-west-2")
FOUNDATION_MODEL = "anthropic.claude-opus-4-6-v1"
INFERENCE_PROFILE = os.getenv("BEDROCK_MODEL_ID", "us.anthropic.claude-opus-4-6-v1")


def check_availability(client, model_id: str) -> str:
    try:
        resp = client.get_foundation_model_availability(modelId=model_id)
        auth = resp.get("authorizationStatus", "UNKNOWN")
        agreement = resp.get("agreementAvailability", {}).get("status", "?")
        return f"{auth} (agreement: {agreement})"
    except Exception as exc:
        return f"ERROR: {exc}"


def try_invoke(client, model_id: str) -> str:
    body = json.dumps(
        {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 30,
            "messages": [{"role": "user", "content": "Reply with exactly: FleetGuard OK"}],
        }
    )
    try:
        resp = client.invoke_model(
            modelId=model_id,
            body=body,
            contentType="application/json",
            accept="application/json",
        )
        text = json.loads(resp["body"].read())["content"][0]["text"]
        return f"OK — {text.strip()[:60]}"
    except client.exceptions.ThrottlingException:
        return "AUTHORIZED but throttled (daily token limit) — credentials work"
    except Exception as exc:
        return f"FAILED — {type(exc).__name__}: {exc}"


def main() -> int:
    profile = os.getenv("AWS_PROFILE") or "(default)"
    print(f"Region: {REGION}  Profile: {profile}")
    try:
        sts = boto3.client("sts", region_name=REGION)
        ident = sts.get_caller_identity()
        print(f"Account: {ident['Account']}  Arn: {ident['Arn']}")
    except Exception as exc:
        print(f"STS failed: {exc}")
        return 1

    bedrock = boto3.client("bedrock", region_name=REGION)
    runtime = boto3.client("bedrock-runtime", region_name=REGION)

    print(f"\n[Claude Opus 4.6] foundation: {FOUNDATION_MODEL}")
    print(f"  availability: {check_availability(bedrock, FOUNDATION_MODEL)}")

    print(f"\n[Claude Opus 4.6] invoke profile: {INFERENCE_PROFILE}")
    print(f"  invoke: {try_invoke(runtime, INFERENCE_PROFILE)}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
