# FleetGuard CI/CD

GitHub Actions workflows (OIDC → AWS, no long-lived keys).

## Workflows

| Workflow | Trigger | Actions |
| --- | --- | --- |
| [ci.yml](workflows/ci.yml) | PR + push `main` | ML parity tests, backend import, `sam validate` |
| [aws-deploy.yml](workflows/aws-deploy.yml) | Push `main` / manual | SAM deploy Path A, ECR push Path B |

**Frontend:** Amplify auto-deploys on Git push to `frontend/` (separate from these workflows).

## Setup (one-time)

1. Create IAM OIDC provider for GitHub Actions in AWS.
2. Create deploy role with permissions for CloudFormation, Lambda, ECR, S3, DynamoDB, Bedrock.
3. Add repo secret: `AWS_DEPLOY_ROLE_ARN` = role ARN.

See [../fleetguard_prep/docs/technicals.md](../fleetguard_prep/docs/technicals.md) §8 for IAM policy sketch.

## Local equivalents

```powershell
pytest ml/tests/ -q
sam validate --template infrastructure/sam/template.yaml
cd infrastructure/sam && sam build && sam deploy --guided
```
