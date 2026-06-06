# FleetGuard Frontend

Next.js (App Router) dashboard — **Live Monitor** tab (Path A) and **Analyze Logs** tab (Path B).

## Planned structure

```
frontend/
├── public/
└── src/
    ├── app/              layout, pages (/live, /analyze)
    ├── components/
    │   ├── charts/       anomaly scatter, route map
    │   ├── ui/           data table, file dropzone
    │   └── reports/      AI insight cards
    ├── hooks/            useFleetData, useIncidents
    ├── lib/              api-client, utils
    └── types/            fleet.ts (mirrors backend Pydantic)
```

## Env vars (planned)

- `NEXT_PUBLIC_API_URL` — API Gateway (Lambda / real-time)
- `NEXT_PUBLIC_BATCH_API_URL` — App Runner (FastAPI / batch)
