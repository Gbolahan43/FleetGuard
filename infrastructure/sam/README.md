# Path A — SAM deploy (Lambda + API Gateway + DynamoDB)

## Prerequisites

- AWS CLI, SAM CLI, Docker (for container build)
- Bedrock model access enabled in `us-east-1` (see [../scripts/bootstrap_checklist.md](../scripts/bootstrap_checklist.md))
- Model artifacts trained with `scikit-learn==1.5.2` (matches Lambda container)

## Deploy

```powershell
cd infrastructure/sam
sam build
sam deploy --guided
```

After deploy, note stack **Outputs**:

| Output | Use |
| --- | --- |
| `ApiUrl` | `NEXT_PUBLIC_API_URL` |
| `ModelBucketName` | Upload models (step below) |

Upload model artifacts:

```powershell
cd ../..
.\infrastructure\scripts\upload_models.ps1 -Bucket <ModelBucketName>
```

## Local invoke (optional)

Requires Docker and local DynamoDB/S3 mocks or deployed tables:

```powershell
sam local invoke ScoreFunction -e infrastructure/sam/events/score.json
```

## Smoke test (deployed)

```powershell
$API = "https://YOUR_ID.execute-api.us-east-1.amazonaws.com"
curl "$API/incidents?limit=5"
python ml/scripts/replay.py --api $API --mode seed
python ml/scripts/replay.py --api $API --mode replay --limit 100
```

Or run the bundled script:

```powershell
.\infrastructure\scripts\smoke_path_a.ps1 -ApiUrl $API
```

## App Runner (Path B)

```powershell
# From repo root
docker build -f backend/Dockerfile -t fleetguard-backend .
# Tag and push to ECR, then create App Runner service from console or:
.\infrastructure\scripts\deploy_apprunner.ps1 -RepositoryName fleetguard-backend
```

Set App Runner env vars:

| Variable | Value |
| --- | --- |
| `CORS_ORIGINS` | `*` (or Amplify URL) |
| `BEDROCK_ENABLED` | `true` for production demo |
| `TOP_N_ANOMALIES` | `10` |

Health check path: `/healthz`

Smoke test:

```powershell
.\infrastructure\scripts\smoke_path_b.ps1 -BaseUrl https://YOUR.apprunner.com
```

## Files

| File | Purpose |
| --- | --- |
| `template.yaml` | SAM stack definition |
| `samconfig.toml.example` | Deploy defaults |
| `events/score.json` | Sample POST /score event |
| `events/incidents.json` | Sample GET /incidents event |
