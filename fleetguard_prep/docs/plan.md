# FleetGuard - Build & Deploy Plan

Take FleetGuard from "ML pipeline done" to "live on AWS with a working demo" in roughly 5-6
hours. FleetGuard is a **real-time anomaly detector**: it scores vehicle telemetry pings and
flags fuel theft, route deviation, private use, and excessive idling, with an AI incident report
per alert.

## Phase 1 - COMPLETE

- Mock telemetry generated: 10 Lagos vehicles, ~4,800 pings, ~12% injected anomalies
  (`fleetguard/mock_data/fleetguard_telemetry.csv`).
- IsolationForest + StandardScaler trained and serialized (`fleetguard/models/`).
- Verified anomaly F1 0.994 (precision 0.990 / recall 0.998); all 4 anomaly types ~100% detected.
- Deployment-ready handler already written (`fleetguard_lambda_handler.py`).

## What remains (this plan)

1. Package the model + scaler into a container-image Lambda; upload artifacts to S3.
2. Stand up the serverless backbone (S3, Lambda, API Gateway, DynamoDB, Bedrock, CloudWatch)
   with AWS SAM.
3. Build the fleet dashboard (vehicle map + live incident log + Bedrock report panel).
4. Deploy, seed demo incidents, rehearse the demo.

## Backbone

```
React dashboard (AWS Amplify Hosting)
      |  HTTPS
API Gateway (HTTP API)  <-- POST /score { pings: [...] }
      |
Lambda (container, Python 3.11 + scikit-learn)
   |          |             |
  S3        Bedrock        DynamoDB (fleetguard-incidents)
(model)   (incident report)  per-anomaly records
```

See [architecture.md](architecture.md), [technicals.md](technicals.md), [SOW.md](SOW.md).

## Workstreams (parallel)

- **A - Infra/Backend**: SAM template, IAM, S3, `fleetguard-incidents` table, Lambda, HTTP API,
  Bedrock access.
- **B - ML/Packaging**: build the scikit-learn container image, upload model + scaler +
  `fleetguard_feature_cols.json`, smoke-test scoring, seed demo incidents.
- **C - Frontend**: React map of vehicle pings (Leaflet/Mapbox), live incident log, Bedrock
  report panel.

## 5-6 hour timeline

| Time | A - Infra/Backend | B - ML/Packaging | C - Frontend |
| --- | --- | --- | --- |
| 0:00-0:45 | SAM bootstrap, S3 + `fleetguard-incidents`, IAM, enable Bedrock | Build scikit-learn container image; upload model/scaler/feature_cols to S3 | Scaffold Vite React + map |
| 0:45-2:00 | Deploy Lambda + HTTP API; verify `POST /score` with curl | `sam local invoke` smoke test; replay `fleetguard_telemetry.csv` pings | Plot vehicle pings + anomaly markers |
| 2:00-3:30 | Wire Bedrock; CORS; CloudWatch | Seed `fleetguard-incidents`; verify incident reports | Live incident log + filters by anomaly type |
| 3:30-4:30 | Tighten IAM; provisioned concurrency for demo | Integration with frontend; payload checks | Bedrock report panel + vehicle drilldown |
| 4:30-5:30 | Smoke test APIs | Confirm live scoring + Bedrock output | Amplify deploy + polish UI |
| 5:30-6:00 | Demo rehearsal + cached fallback | | |

## Deliverables

- Live `POST /score` endpoint: per-ping `is_anomaly`, `score`, and Bedrock `report`.
- Hosted dashboard: vehicle map, incident log, and AI incident reports.
- SAM template for the FleetGuard stack; CloudWatch logs/metrics.

## Top risks & mitigations

- **scikit-learn in Lambda** -> container-image Lambda (deps exceed the zip limit).
- **Bedrock latency/throttling** -> pre-generate demo incident reports into DynamoDB; fall back
  to cached text.
- **Cold starts at judging** -> provisioned concurrency = 1 or a warm ping.
- **`fuel_delta` requires previous ping** -> the caller/seeder computes it; document the contract.
