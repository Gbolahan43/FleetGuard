# FleetGuard Documentation

Central guide for the team. Start here, then drill into the doc for your workstream.

## Read order (new teammates)

1. [prd.md](prd.md) — what we're building and why
2. [app_flow.md](app_flow.md) — user journeys, screens, demo script
3. [api_contract.md](api_contract.md) — request/response shapes both paths must honour
4. [data_schema.md](data_schema.md) — CSV columns, features, DynamoDB tables
5. [team_guide.md](team_guide.md) — workstreams, repo map, build order, conventions
6. [frontend_guide.md](frontend_guide.md) — frontend onboarding (if building UI)

## Deep technical specs

| Doc | Location | Use when |
| --- | --- | --- |
| Architecture (hybrid A + B) | [../fleetguard_prep/docs/architecture.md](../fleetguard_prep/docs/architecture.md) | System design, AWS services, scaling path |
| Technical specification | [../fleetguard_prep/docs/technicals.md](../fleetguard_prep/docs/technicals.md) | Implementation detail, env vars, IaC |
| Build plan | [../fleetguard_prep/docs/plan.md](../fleetguard_prep/docs/plan.md) | Time-boxed hackathon timeline |
| Statement of work | [../fleetguard_prep/docs/SOW.md](../fleetguard_prep/docs/SOW.md) | Deliverables & AWS service justification |

## Repo map

```
FleetGuard/
├── docs/              ← you are here (product + team guides)
├── frontend/          Next.js — Live Monitor + Analyze Logs
├── backend/           FastAPI — Path B batch analysis
├── ml/                IsolationForest pipeline + Lambda handler (Path A)
├── infrastructure/    Terraform + deploy scripts
├── fleetguard_prep/   Working ML prototype (migrate → ml/)
└── .github/           CI/CD workflows
```

## Two paths (remember this)

| Path | Role | Entry | Owner folder |
| --- | --- | --- | --- |
| **A — Primary** | Real-time monitoring | `POST /score` | `ml/` + `infrastructure/` |
| **B — Secondary** | Batch log audit | `POST /api/v1/analyze-fleet` | `backend/` + `frontend/` |

Both paths **must share the same model and feature engineering**. See [team_guide.md](team_guide.md) § Shared rules.

## Definition of done (summary)

- [ ] Path A live: score pings, Bedrock reports, `GET /incidents`, Live Monitor tab
- [ ] Path B live: CSV upload, scored table + AI insights, Analyze Logs tab
- [ ] Parity test: same row → same score on A and B
- [ ] Demo rehearsed: replayer (A) + CSV upload fallback (B)

Full checklist in [team_guide.md](team_guide.md).
