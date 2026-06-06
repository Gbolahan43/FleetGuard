"""Bedrock model IDs used across Path A (Lambda) and Path B (FastAPI).

Claude Opus 4.6 is invoked via a system inference profile (not the raw foundation-model id).
Verified on us-west-2 default account: us.anthropic.claude-opus-4-6-v1
"""

BEDROCK_MODEL_ID = "us.anthropic.claude-opus-4-6-v1"
BEDROCK_FOUNDATION_MODEL_ID = "anthropic.claude-opus-4-6-v1"
