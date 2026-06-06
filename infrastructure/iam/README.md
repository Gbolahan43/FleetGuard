# GitHub Actions → AWS authentication

Deploy target: **default AWS account** (full permissions).  
Repo: **`Gbolahan43/FleetGuard`** · Region: **`us-west-2`**

The separate `fleetguard` CLI profile (limited hackathon account) is **not** used for deploy anymore.

---

## OIDC vs alternatives

| Approach | Use when |
| --- | --- |
| **OIDC** (recommended) | GitHub Actions deploy — no long-lived keys |
| **Local SAM (cmd)** | First deploy or debugging — `sam deploy --guided` |
| **Access keys in GitHub Secrets** | Emergency only if OIDC blocked |

---

## Step-by-step: deploy OIDC (cmd)

Run from repo root in **Command Prompt**.

### Step 0 — Use default account + us-west-2

```cmd
cd C:\Users\Excellus\Documents\FleetGuard

call infrastructure\scripts\use-default-aws.cmd
```

Confirm the **Account** id is your default account (not the limited hackathon account).  
Region should show **`us-west-2`**. If not:

```cmd
aws configure set region us-west-2
```

### Step 1 — Deploy IAM OIDC stack (one-time)

```cmd
infrastructure\scripts\deploy-github-oidc.cmd
```

If you get *OIDC provider already exists* in this account:

```cmd
infrastructure\scripts\deploy-github-oidc.cmd oidc-exists
```

Copy the **Role ARN** printed at the end (example shape):

`arn:aws:iam::YOUR_ACCOUNT_ID:role/fleetguard-github-actions-deploy`

**Manual equivalent:**

```cmd
aws cloudformation deploy ^
  --template-file infrastructure\iam\github-oidc.yaml ^
  --stack-name fleetguard-github-oidc ^
  --parameter-overrides GitHubOrg=Gbolahan43 GitHubRepo=FleetGuard GitHubBranch=main ^
  --capabilities CAPABILITY_NAMED_IAM ^
  --region us-west-2
```

### Step 2 — GitHub repo settings

Open: `https://github.com/Gbolahan43/FleetGuard/settings/secrets/actions`

**Secret**

| Name | Value |
| --- | --- |
| `AWS_DEPLOY_ROLE_ARN` | Role ARN from Step 1 |

**Variable** (Settings → Secrets and variables → Actions → Variables)

| Name | Value |
| --- | --- |
| `ENABLE_AWS_DEPLOY` | `true` |

### Step 3 — Test GitHub Actions deploy

1. GitHub → **Actions** → **AWS Deploy** → **Run workflow**
2. Both jobs should assume the role and run SAM + ECR steps

Workflow requires (already in repo):

```yaml
permissions:
  id-token: write
```

### Step 4 — Local SAM deploy (same default account)

Use this for first Path A deploy or if CI fails:

```cmd
call infrastructure\scripts\use-default-aws.cmd

cd infrastructure\sam
sam build
sam deploy --guided
```

After deploy, upload models:

```cmd
cd C:\Users\Excellus\Documents\FleetGuard
infrastructure\scripts\upload_models.ps1 -Bucket YOUR_MODEL_BUCKET_NAME
```

(Path B ECR / App Runner: see [../sam/README.md](../sam/README.md).)

---

## Trust policy scope

Only workflows from this repo/branch can assume the role:

`repo:Gbolahan43/FleetGuard:ref:refs/heads/main`

---

## Troubleshooting

| Error | Fix |
| --- | --- |
| Wrong AWS account | Run `use-default-aws.cmd`; clear `set AWS_PROFILE=fleetguard` |
| `AssumeRoleWithWebIdentity` denied | Repo name must match GitHub casing `FleetGuard`; branch `main` |
| Workflow skipped | Set GitHub variable `ENABLE_AWS_DEPLOY=true` |
| OIDC provider exists | Re-run `deploy-github-oidc.cmd oidc-exists` |
| SAM AccessDenied | Default account user needs IAM rights to deploy CloudFormation/SAM |

---

## Files

| File | Purpose |
| --- | --- |
| [github-oidc.yaml](github-oidc.yaml) | CloudFormation template |
| [../scripts/deploy-github-oidc.cmd](../scripts/deploy-github-oidc.cmd) | **cmd** one-shot OIDC deploy |
| [../scripts/use-default-aws.cmd](../scripts/use-default-aws.cmd) | Clear profile, set us-west-2 |
| [../../.github/workflows/aws-deploy.yml](../../.github/workflows/aws-deploy.yml) | CI workflow |
