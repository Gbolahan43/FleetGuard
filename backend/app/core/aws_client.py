import boto3

from app.core.config import get_settings


def bedrock_runtime():
    settings = get_settings()
    return boto3.client("bedrock-runtime", region_name=settings.aws_region)
