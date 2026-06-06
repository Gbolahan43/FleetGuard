# FleetGuard CI/CD

GitHub Actions workflows (OIDC → AWS, no long-lived keys).

## Planned workflows

| Workflow | Trigger | Actions |
| --- | --- | --- |
| `ci.yml` | Pull request | Lint, ML parity test, Terraform validate, frontend build |
| `aws-deploy.yml` | Push to `main` | Build & push ECR images, Terraform apply, S3/CloudFront sync |

See `fleetguard_prep/docs/technicals.md` §8 for full pipeline spec.
