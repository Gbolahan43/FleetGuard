# FleetGuard Frontend

Next.js (App Router) dashboard — **Live Monitor** (Path A) and **Analyze Logs** (Path B).

**Hosting:** **AWS Amplify Hosting** (Git-connected, auto-build on push).

## Local dev

```powershell
cd frontend
npm install
copy .env.example .env.local
npm run dev
```

## Amplify deploy

1. AWS Console → **Amplify** → Host web app → connect GitHub repo.
2. Set **monorepo app root** to `frontend/`.
3. Amplify uses `frontend/amplify.yml` for build settings.
4. Add environment variables in Amplify Console:
   - `NEXT_PUBLIC_API_URL` — API Gateway (Path A)
   - `NEXT_PUBLIC_BATCH_API_URL` — App Runner (Path B)

Build spec: standard Next.js (`npm run build`). HTTPS URL:
`https://main.<app-id>.amplifyapp.com`

## Env vars

See `.env.example` for local development (same names as Amplify).
