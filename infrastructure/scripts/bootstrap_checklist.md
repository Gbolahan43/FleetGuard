# FleetGuard AWS bootstrap checklist

Complete before `sam deploy`. Region: **us-east-1**.

## 1. AWS CLI

```powershell
aws sts get-caller-identity
aws configure get region   # should be us-east-1
```

## 2. Amazon Bedrock model access

Console → **Amazon Bedrock** → **Model access** → enable:

| Model | Path | Purpose |
| --- | --- | --- |
| Claude 3.5 Sonnet | Path A Lambda | Live incident reports |
| Claude 3 Haiku | Path B App Runner | Batch top-N insights |

## 3. Deploy Path A (SAM)

```powershell
cd infrastructure/sam
sam build
sam deploy --guided
# Note outputs: ApiUrl, ModelBucketName

cd ../..
.\infrastructure\scripts\upload_models.ps1 -Bucket <ModelBucketName from output>
```

## 4. Smoke test Path A

```powershell
$API = "https://YOUR_API.execute-api.us-east-1.amazonaws.com"
curl "$API/incidents?limit=5"
python ml/scripts/replay.py --api $API --mode seed
python ml/scripts/replay.py --api $API --mode replay --limit 100
```

## 5. Deploy Path B (App Runner)

See [../sam/README.md](../sam/README.md) § App Runner and [../../backend/README.md](../../backend/README.md).

## 6. Hand off to frontend

Copy URLs into `docs/deploy-urls.md` (from `docs/deploy-urls.example.md`).
