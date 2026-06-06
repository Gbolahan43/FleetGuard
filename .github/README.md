# FleetGuard CI/CD

GitHub Actions workflows (OIDC → AWS, no long-lived keys).

## Workflows

| Workflow | Trigger | Actions |
| --- | --- | --- |
| [ci.yml](workflows/ci.yml) | PR + push `main` | ML parity tests, backend import, `sam validate` |
| [aws-deploy.yml](workflows/aws-deploy.yml) | **Manual only** (`workflow_dispatch`) | SAM deploy Path A, ECR push Path B |

**Frontend:** Amplify auto-deploys on Git push to `frontend/` (separate from these workflows).

## AWS deploy is disabled by default

`aws-deploy.yml` does **not** run on every push. It only runs when:

1. You trigger it manually: **Actions → AWS Deploy → Run workflow**
2. Repo variable **`ENABLE_AWS_DEPLOY`** is set to `true` (Settings → Secrets and variables → Actions → Variables)
3. Secret **`AWS_DEPLOY_ROLE_ARN`** is set (Settings → Secrets and variables → Actions → Secrets)

Until those are configured, commits will not attempt AWS deploy.

### When you are ready to deploy

1. Configure IAM OIDC + deploy role (see [../fleetguard_prep/docs/technicals.md](../fleetguard_prep/docs/technicals.md) §8).
2. Add secret `AWS_DEPLOY_ROLE_ARN`.
3. Add variable `ENABLE_AWS_DEPLOY` = `true`.
4. Run **AWS Deploy** manually from the Actions tab and verify smoke tests.
5. Optional: uncomment `push: branches: [main]` in `aws-deploy.yml` for auto-deploy on merge.

## Local equivalents

```powershell
pytest ml/tests/ -q
sam validate --template infrastructure/sam/template.yaml
cd infrastructure/sam && sam build && sam deploy --guided
```
