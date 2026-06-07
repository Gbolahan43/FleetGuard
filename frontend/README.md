# FleetGuard Frontend

Next.js dashboard — **Live Monitor** (Path A) and **Analyze Logs** (Path B).

**Hosting:** AWS Amplify (`frontend/` app root).

## Routes

| Route | Tab | API env var |
| --- | --- | --- |
| `/` or `/live` | Live Monitor | `NEXT_PUBLIC_API_URL` |
| `/analyze` | Analyze Logs | `NEXT_PUBLIC_BATCH_API_URL` |

When `NEXT_PUBLIC_API_URL` is unset, Live Monitor loads demo CSV and scores via Path B (`NEXT_PUBLIC_BATCH_API_URL`).

**Deployed Path B:** https://vxyrxhcfwr.us-west-2.awsapprunner.com — see [../docs/deploy-urls.md](../docs/deploy-urls.md).

## Local dev

```powershell
cd frontend
copy .env.example .env.local
npm install
npm run dev
```

**Path B (Analyze):** start the FastAPI backend on port 8080:

```powershell
cd backend
uvicorn app.main:app --port 8080
```

Set in `.env.local`:

```env
NEXT_PUBLIC_BATCH_API_URL=https://vxyrxhcfwr.us-west-2.awsapprunner.com
```

Local FastAPI alternative: `http://127.0.0.1:8080` (see [../backend/README.md](../backend/README.md)).

**Path A (Live):** set `NEXT_PUBLIC_API_URL` to your API Gateway URL after SAM deploy.

**Alert AI drilldown:** `/api/analyze` calls Amazon Bedrock (server-side). Requires AWS credentials locally (`AWS_PROFILE` or default) and `bedrock:InvokeModel`.

## Amplify deploy

1. Amplify Console → Host web app → connect GitHub repo `Gbolahan43/FleetGuard`.
2. Monorepo app root: `frontend/`.
3. Environment variables:
   - `NEXT_PUBLIC_API_URL` — leave empty until Path A SAM deploy
   - `NEXT_PUBLIC_BATCH_API_URL` — `https://vxyrxhcfwr.us-west-2.awsapprunner.com`
   - `AWS_REGION=us-west-2`
   - `BEDROCK_MODEL_ID=us.anthropic.claude-opus-4-6-v1`
4. Attach IAM role to Amplify SSR compute with `bedrock:InvokeModel`.

Build spec: [`amplify.yml`](amplify.yml).

## Scripts

```bash
npm run dev      # local dev server
npm run build    # production build
npm run lint     # ESLint
```
