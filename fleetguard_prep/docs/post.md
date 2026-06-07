# FleetGuard — LinkedIn Post Series (Pre-Deploy)

Three linked posts for publishing **before** full AWS deployment. Add your dashboard snapshots where marked `[📸 …]`.

**Suggested publish order:** Post 1 → wait 1–2 days → Post 2 → wait 1–2 days → Post 3  
**Cross-link:** Each post ends with “Read Part X” so the series reads as one story.

---

## Post 1 of 3 — The Problem

**Title:** Why Nigerian fleet operators lose money they never see coming

**Hook:**  
Your drivers clock out. Your fuel receipts look normal. But somewhere between Lagos Island and Apapa, money is walking out the door — and spreadsheets won't tell you until it's too late.

**Body:**

We built **FleetGuard** because fleet managers in Nigeria face the same four questions every day:

- Did the driver stay on **approved routes**?
- Was **fuel** used for deliveries — or siphoned while the engine was running?
- Is the vehicle being used **privately** after hours?
- How much is **excessive idling** costing in wasted diesel?

End-of-day reports and manual log review can't keep up with thousands of GPS and fuel pings per vehicle. By the time someone notices, the loss is already gone.

FleetGuard is our answer: an **AI-powered fleet intelligence platform** that scores telemetry as it arrives and turns anomalies into **actionable incident reports** — not just red dots on a map.

We're preparing to deploy on AWS. Here's a first look at the command center we're building.

[📸 Screenshot: Dashboard home — map + vehicle list + alert count]

[📸 Screenshot: Summary stat cards — vehicles, alerts, fuel loss estimate]

**What we're detecting:**
- Fuel theft  
- Route deviation  
- Private use  
- Excessive idle  

No labelled incident history required in production — we use **unsupervised ML** (IsolationForest) on 12 telemetry features.

**→ Next:** Part 2 — how we designed a hybrid architecture so managers get **live monitoring** *and* **forensic CSV audits** from one shared model.

**Hashtags:**  
`#FleetGuard` `#FleetManagement` `#Logistics` `#Nigeria` `#AI` `#Telematics` `#FuelTheft` `#AWS` `#MachineLearning`

---

## Post 2 of 3 — The Solution (Hybrid Architecture)

**Title:** One model, two paths — how FleetGuard balances real-time alerts and batch forensics

**Hook:**  
Live pings need speed. Historical audits need depth. Most tools pick one. We integrated both — with **staging architecture** that shares a single ML layer so scores never disagree.

**Body:**

In [Part 1](#post-1-of-3--the-problem), we outlined the fleet losses FleetGuard targets. Here's how the solution is structured.

### Two modes, one brain

| Mode | User | Flow | Outcome |
| --- | --- | --- | --- |
| **Live Monitor** (primary) | Fleet manager | Telemetry → `POST /score` | Incidents on map + log in seconds |
| **Analyze Logs** (secondary) | Ops analyst | CSV upload → `POST /api/v1/analyze-fleet` | Full forensic audit + top anomaly insights |

Both paths call the **same inference core** (`ml/src/inference/inference_core.py`). Parity tests ensure identical input → identical score on live and batch — no “why does the dashboard disagree with the upload?”

### Detection layer

- **Model:** IsolationForest + StandardScaler  
- **Features:** speed, fuel level, fuel delta, idle time, zone distance, engine state, hour/day, working-hours flag, and more (12 total)  
- **Mock validation:** F1 **0.994** on Lagos-style fleet data (10 vehicles, ~4,800 pings)

### Explainability layer

Raw anomaly scores aren't enough for a fleet manager at 6 AM. **Amazon Bedrock (Claude Opus 4.6)** writes concise incident reports: what happened, why it matters, what to do next.

[📸 Screenshot: Alert drawer — AI analysis panel]

[📸 Screenshot: Analyze Logs page — scored table + anomaly breakdown]

[📸 Screenshot: Top-N anomaly cards with AI insight text]

### Integrated staging architecture (preview)

```
Next.js dashboard (AWS Amplify)
       │
       ├── Path A — API Gateway → Lambda (container) → DynamoDB + Bedrock
       │                      └── S3 (model artifacts)
       │
       └── Path B — App Runner → FastAPI → same model + Bedrock
```

Serverless for bursty real-time pings. Container for heavy CSV batch uploads. **S3** decouples model retraining from redeploy. **DynamoDB** stores incidents and per-vehicle state for server-side `fuel_delta`.

Full diagram: `architecture-diagram.png` in the repo.

**→ Next:** Part 3 — the AWS stack, Bedrock integration, and what the live demo will look like for judges and operators.

**Hashtags:**  
`#FleetGuard` `#SolutionArchitecture` `#MLOps` `#Serverless` `#FastAPI` `#NextJS` `#AmazonBedrock` `#GenAI` `#HybridCloud`

**Link back:**  
“Missed Part 1? [Why Nigerian fleet operators lose money they never see coming](#post-1-of-3--the-problem)”

---

## Post 3 of 3 — AWS Stack, Bedrock & Demo

**Title:** FleetGuard on AWS — from telemetry ping to Bedrock incident report in one flow

**Hook:**  
We didn't bolt AI onto a spreadsheet. We wired **ML detection**, **GenAI explainability**, and a **production-shaped AWS stack** into one demo a judge can trust in five minutes.

**Body:**

Parts [1](#post-1-of-3--the-problem) and [2](#post-2-of-3--the-solution-hybrid-architecture) covered the problem and hybrid design. Here's where Bedrock and AWS fit — and what you'll see when we go live.

### Where Amazon Bedrock is implemented

| Layer | Location | When it runs |
| --- | --- | --- |
| **Path A (real-time)** | `ml/src/realtime/handler.py` | On each anomaly during `POST /score` → stored in DynamoDB as `report` |
| **Path B (batch)** | `backend/app/services/agent_bedrock.py` | Top-N anomalies on CSV upload (cost-controlled) |
| **Dashboard drill-down** | `frontend/src/app/api/analyze/route.ts` | On-demand richer analysis when a manager clicks an alert |

Same model family: **Claude Opus 4.6** (`us.anthropic.claude-opus-4-6-v1`) in **us-west-2**. Fallback text if Bedrock throttles — demos don't break.

### AWS services & why

| Service | Role |
| --- | --- |
| **Lambda + API Gateway** | Real-time scoring, scale-to-zero |
| **App Runner** | Always-warm FastAPI for CSV batch |
| **S3** | Model artifacts — retrain without redeploying code |
| **DynamoDB** | Incidents + vehicle state |
| **Amazon Bedrock** | Human-readable incident narratives |
| **AWS Amplify** | Next.js dashboard, Git-based deploy |
| **GitHub Actions OIDC** | Deploy without long-lived AWS keys |

**Estimated demo cost:** under $5 with Free Tier where applicable.

[📸 Screenshot: Live Monitor — map with alert markers + “Demo” / “Live API” badge]

[📸 Screenshot: Incident log with severity badges]

[📸 Screenshot: Analyze Logs — upload zone + summary cards after CSV run]

[📸 Screenshot: Architecture diagram — `architecture-diagram.png`]

### 5-minute demo script (for posts / video)

1. **Live Monitor** — telemetry replay; watch anomalies appear on the Lagos map.  
2. **Click an incident** — read the Bedrock report (what happened + recommended action).  
3. **Analyze Logs** — upload `fleetguard_telemetry.csv`; review scored table and top AI insights.  
4. **Scaling note** — production ingestion via **IoT Core / Kinesis**; same Lambda scoring API.

### What this delivers

FleetGuard isn't a chart — it's a **loss-prevention workflow**:

- Catch fuel theft and route abuse **while the vehicle is still on the road**  
- Audit historical logs **without retraining on labelled fraud data**  
- Give managers **plain-language reports**, not anomaly scores  

We're finalizing deployment to **us-west-2** now. Follow along for the live Amplify URL.

**Call to action:**  
Comment **FLEET** if you want the repo link or a walkthrough when we go live. Tag a fleet ops lead who'd use this.

**Hashtags:**  
`#FleetGuard` `#AWS` `#AmazonBedrock` `#Claude` `#Hackathon` `#CloudComputing` `#LogisticsTech` `#NigeriaTech` `#AIForGood` `#FleetOps`

**Link back:**  
- [Part 1 — The Problem](#post-1-of-3--the-problem)  
- [Part 2 — Hybrid Architecture](#post-2-of-3--the-solution-hybrid-architecture)

---

## Publishing checklist

- [ ] Replace `[📸 …]` placeholders with PNG/JPG from localhost or Amplify
- [x] Path B live URL in `docs/deploy-urls.md` — https://vxyrxhcfwr.us-west-2.awsapprunner.com
- [ ] Add Amplify dashboard URL when connected
- [ ] Add Path A API URL when SAM deploy succeeds
- [ ] Pin Post 3 (or a comment) with repo / demo links
- [ ] Optional: turn Post 3 demo script into a 60–90s screen recording for LinkedIn native video

## Snapshot guide (recommended captures)

| Post | Page / view | What to show |
| --- | --- | --- |
| 1 | `/` dashboard | Full layout — map, sidebar, stats |
| 1 | `/` stats row | Alerts today, fuel loss ₦, compliance % |
| 2 | Alert drawer | AI Analysis section expanded |
| 2 | `/analyze` | Results after CSV upload — table + insights |
| 3 | `/` map | Multiple vehicles + alert state |
| 3 | `/analyze` | Dropzone + summary cards |
| 3 | — | `architecture-diagram.png` from repo root |
