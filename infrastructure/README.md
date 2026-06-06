# FleetGuard Infrastructure

Terraform (future) and **SAM** (Path A) deploy scripts for the hybrid stack.

## Quick start

1. Read [scripts/bootstrap_checklist.md](scripts/bootstrap_checklist.md) — Bedrock + AWS CLI
2. Deploy Path A: [sam/README.md](sam/README.md)
3. Upload models: `.\scripts\upload_models.ps1 -Bucket <ModelBucketName>`
4. Deploy Path B: `.\scripts\deploy_apprunner.ps1 -RepositoryName fleetguard-backend`
5. Smoke tests: `smoke_path_a.ps1`, `smoke_path_b.ps1`
6. Hand URLs to frontend: [../docs/deploy-urls.md](../docs/deploy-urls.md)

## Layout

```
infrastructure/
├── sam/
│   ├── template.yaml       Path A — Lambda + API Gateway + DynamoDB + S3
│   ├── events/             Sample Lambda invoke payloads
│   └── README.md
├── scripts/
│   ├── upload_models.ps1   S3 model upload
│   ├── smoke_path_a.ps1    POST /score + GET /incidents
│   ├── smoke_path_b.ps1    POST /api/v1/analyze-fleet
│   ├── deploy_apprunner.ps1  ECR build + push
│   └── bootstrap_checklist.md
└── terraform/              (post-demo) optional full IaC
```

**Frontend:** AWS Amplify (Git → `frontend/`). See [../frontend/README.md](../frontend/README.md).

Region default: `us-west-2`.
