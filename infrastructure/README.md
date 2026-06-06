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
│   │   ├── s3/             model bucket + frontend static hosting
│   │   ├── api_gateway/    HTTP API (/score, /incidents)
│   │   ├── cloudfront/     CDN for Next.js export
│   │   └── iam/            OIDC + least-privilege roles
│   └── environments/
│       ├── dev/
│       └── prod/
└── scripts/                bootstrap, deploy, seed
```

Region default: `us-east-1`. See `fleetguard_prep/docs/technicals.md` for resource list.
