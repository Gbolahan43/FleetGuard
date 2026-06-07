# FleetGuard AWS bootstrap checklist

Complete before `sam deploy`. Region: **us-west-2**.

## 0. AWS account (default — full permissions)

FleetGuard deploy uses your **default** AWS CLI credentials (not the limited `fleetguard` profile).

```cmd
cd C:\Users\Excellus\Documents\FleetGuard
call infrastructure\scripts\use-default-aws.cmd
```

Set region once if needed:

```cmd
aws configure set region us-west-2
```

## 0b. GitHub OIDC (one-time, same default account)

```cmd
infrastructure\scripts\deploy-github-oidc.cmd
```

Then GitHub secret `AWS_DEPLOY_ROLE_ARN` + variable `ENABLE_AWS_DEPLOY=true`.  
Details: [../iam/README.md](../iam/README.md)

## 0c. Legacy limited profile (optional)

The `fleetguard` profile was a separate limited account — **skip for deploy** unless explicitly required:

```cmd
call infrastructure\scripts\use-fleetguard-aws.cmd
```

Optional PowerShell helper (legacy limited profile only):

```powershell
function Use-FleetGuardAws {
  $env:AWS_PROFILE = "fleetguard"
  $env:AWS_DEFAULT_REGION = "us-west-2"
}
```

## 1. AWS CLI

```cmd
call infrastructure\scripts\use-default-aws.cmd
aws configure get region
```

## 2. Amazon Bedrock model access

Console → **Amazon Bedrock** → **Model access** → enable **Claude Opus 4.6** (inference profile `us.anthropic.claude-opus-4-6-v1`).

## 3. Deploy Path B (App Runner) — first

```cmd
call infrastructure\scripts\use-default-aws.cmd
infrastructure\scripts\deploy_apprunner_service.cmd
powershell -File infrastructure\scripts\smoke_path_b.ps1 -BaseUrl https://vxyrxhcfwr.us-west-2.awsapprunner.com
```

Stack: `fleetguard-apprunner` · Template: [../apprunner/template.yaml](../apprunner/template.yaml)

## 4. Deploy Path A (SAM)

```cmd
call infrastructure\scripts\use-default-aws.cmd
cd infrastructure\sam
sam build
sam deploy --guided

cd ..\..
powershell -File infrastructure\scripts\upload_models.ps1 -Bucket MODEL_BUCKET_FROM_OUTPUT
```

## 5. Smoke test Path A

```cmd
set API=https://YOUR_API.execute-api.us-west-2.amazonaws.com
curl %API%/incidents?limit=5
python ml\scripts\replay.py --api %API% --mode seed
python ml\scripts\replay.py --api %API% --mode replay --limit 100
```

## 6. Hand off to frontend

Copy URLs into [../../docs/deploy-urls.md](../../docs/deploy-urls.md). Set Amplify env vars (see file).