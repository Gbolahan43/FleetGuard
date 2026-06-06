# FleetGuard



Fleet intelligence for Nigerian logistics — real-time anomaly detection (fuel theft, route abuse,

private use, excessive idling) with AI incident insights.



## Start here



**Team docs:** [docs/README.md](docs/README.md)



| Doc | Purpose |

| --- | --- |

| [docs/prd.md](docs/prd.md) | Product requirements |

| [docs/app_flow.md](docs/app_flow.md) | User flows & demo script |

| [docs/api_contract.md](docs/api_contract.md) | API request/response shapes |

| [docs/data_schema.md](docs/data_schema.md) | CSV, features, DynamoDB |

| [docs/team_guide.md](docs/team_guide.md) | Workstreams & build order |
| [Architecture-diagram.md](Architecture-diagram.md) | High-level AWS architecture + diagram PNG |



## Monorepo layout



```

FleetGuard/

├── docs/              Product & team guides (start here)

├── frontend/          Next.js — Live Monitor + Analyze Logs

├── backend/           FastAPI — Path B batch analysis

├── ml/                IsolationForest + Lambda handler — Path A

├── infrastructure/    Terraform + deploy scripts

├── fleetguard_prep/   Legacy (superseded by ml/)

└── .github/           CI/CD workflows

```



## Architecture (hybrid)



- **Path A (primary):** Real-time `POST /score` — Lambda + API Gateway + DynamoDB + Bedrock

- **Path B (secondary):** Batch `POST /api/v1/analyze-fleet` — FastAPI on App Runner



Deep specs: [fleetguard_prep/docs/architecture.md](fleetguard_prep/docs/architecture.md) ·

[fleetguard_prep/docs/technicals.md](fleetguard_prep/docs/technicals.md)



## Quickstart

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Path B — run batch API
cd backend
copy .env.example .env
uvicorn app.main:app --reload --port 8080
```

See [docs/team_guide.md](docs/team_guide.md) and [ml/README.md](ml/README.md).


