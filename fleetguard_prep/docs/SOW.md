# FleetGuard - Statement of Work (SOW)

## 1. Purpose

Deploy FleetGuard - **real-time fuel-theft & route-abuse anomaly detection** with AI incident
reports - on AWS within ~5-6 hours, and justify each AWS service vs the alternatives.

## 2. Scope

### In scope
- Package the IsolationForest + scaler as a container-image Lambda behind `POST /score`.
- Provision S3, Lambda, API Gateway, DynamoDB, Bedrock, CloudWatch via AWS SAM.
- Fleet dashboard (**AWS Amplify Hosting**): vehicle map, incident log, Bedrock report panel.
- Bedrock incident reports for anomalies.

### Out of scope (time-boxed)
- Auth (Cognito), custom domain/WAF, multi-region, CI/CD.
- Real telematics device integration and high-throughput streaming (simulated via CSV replay).
- Automated retraining.

## 3. Deliverables

| # | Deliverable | Acceptance |
| --- | --- | --- |
| D1 | `POST /score` API | Returns per-ping anomaly flag, score, and report |
| D2 | Incident persistence | Anomalies stored in DynamoDB and shown in the live feed |
| D3 | Dashboard | Map + incident log + AI report on **Amplify** |
| D4 | SAM template | Reproduces the FleetGuard stack from scratch |

## 4. Service selection & justification

### 4.1 Compute - Lambda (container image)
Per-event scoring with bursty telemetry maps perfectly to scale-to-zero, pay-per-request Lambda;
the model is a small sklearn pickle.

| Alternative | Why not |
| --- | --- |
| SageMaker endpoint | Always-on instance cost; overkill for a lightweight tree model |
| EC2/Fargate | Always-on + ops for bursty, stateless scoring |

### 4.2 API - API Gateway (HTTP API)
Cheapest, lowest-latency managed front door with Lambda proxy + CORS; ideal for `POST /score`.

| Alternative | Why not |
| --- | --- |
| REST API | Extra features we don't need; higher cost |
| Function URL | Weaker routing/throttling/stage story |

### 4.3 Results store - DynamoDB (on-demand)
Incidents are keyed by `incident_id` with a `vehicle_id` GSI - a natural key/value + lookup
pattern with fast writes and no capacity planning.

| Alternative | Why not |
| --- | --- |
| RDS/Aurora | Relational ops not needed for these access patterns |
| Timestream | Better for high-volume GPS history at scale - the future path, not the demo |

### 4.4 Model storage - S3
Cheap, durable, decoupled (retrain = re-upload); also serves the React build.

| Alternative | Why not |
| --- | --- |
| Bundle in image | Couples model to code; redeploy on retrain |
| EFS | VPC/mount complexity unnecessary |

### 4.5 GenAI - Bedrock (Claude 3.5 Sonnet)
Managed, pay-per-token incident reports; no LLM infra; data stays in-region.

| Alternative | Why not |
| --- | --- |
| Self-hosted LLM | GPU cost + ops; overkill for short text |
| External API (OpenAI) | Third-party dependency + data egress |
| Comprehend | Classification/NER, not free-form report generation |

### 4.6 Frontend - AWS Amplify Hosting
Git-connected Next.js build/deploy, HTTPS, branch previews, env vars — faster than hand-rolling S3 + CloudFront.

| Alternative | Why not |
| --- | --- |
| S3 + CloudFront | More manual CI (sync + invalidation); Amplify chosen for speed |
| Vercel | Third-party; hackathon requires AWS |

### 4.7 IaC - AWS SAM
Purpose-built for serverless; minimal template.

| Alternative | Why not |
| --- | --- |
| CDK | More boilerplate for a time-boxed serverless build |
| Terraform | Heavier setup; multi-cloud irrelevant |

### 4.8 Observability - CloudWatch
Native, zero-setup logs/metrics.

### 4.9 (Scaling) Kinesis / IoT Core
Not used for the demo, but the chosen ingestion path for fleet-scale telemetry: buffering,
ordering, and throughput beyond direct POST.

## 5. Indicative cost (us-west-2)

Demo scale sits within Free Tier. ~4,800 pings of scoring + a handful of Bedrock reports:
Lambda ~$0, API ~$0, DynamoDB ~$0, S3 < $0.10, Bedrock a few cents. **Total < ~$1.**

## 6. Assumptions
- Phase 1 model is final; only packaging/serving remains.
- Callers provide `fuel_delta` (drop vs previous ping).
- Low demo traffic (judges + team).

## 7. Acceptance & sign-off
Complete when the dashboard flags live anomalies with AI incident reports, backed by persisted
DynamoDB incidents, all provisioned from the SAM template.
