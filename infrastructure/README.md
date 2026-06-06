# FleetGuard Infrastructure

Terraform (AWS) and deploy scripts for the hybrid stack.

## Planned structure

```
infrastructure/
├── terraform/
│   ├── modules/
│   │   ├── lambda/         Path A — ScoreFn + API Gateway routes
│   │   ├── apprunner/      Path B — FastAPI service
│   │   ├── dynamodb/       incidents + vehicle-state tables
│   │   ├── s3/             model bucket only (not frontend)
│   │   ├── api_gateway/    HTTP API (/score, /incidents)
│   │   ├── amplify/        Amplify app (frontend Hosting) — optional IaC
│   │   └── iam/            OIDC + least-privilege roles
│   └── environments/
│       ├── dev/
│       └── prod/
└── scripts/                bootstrap, deploy, seed
```

**Frontend:** hosted on **AWS Amplify** (Git-connected). Amplify Console can provision the app
without Terraform; optional `amplify/` module for full IaC.

Region default: `us-east-1`. See `fleetguard_prep/docs/technicals.md` for resource list.
