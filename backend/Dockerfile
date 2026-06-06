# FleetGuard Path B — FastAPI batch service for AWS App Runner
# Build from repo root: docker build -f backend/Dockerfile -t fleetguard-backend .

FROM python:3.11-slim

WORKDIR /app

COPY ml/requirements.txt /tmp/ml-requirements.txt
COPY backend/requirements.txt /tmp/backend-requirements.txt
RUN pip install --no-cache-dir \
    scikit-learn==1.5.2 \
    numpy==1.26.4 \
    pandas>=2.1 \
    boto3>=1.34 \
    && pip install --no-cache-dir -r /tmp/backend-requirements.txt

COPY ml/src /app/ml/src
COPY ml/models /app/models
COPY backend/app /app/app

ENV PYTHONPATH=/app/ml/src
ENV MODEL_PATH=/app/models
ENV CORS_ORIGINS=*
ENV BEDROCK_ENABLED=false
ENV TOP_N_ANOMALIES=10
ENV AWS_REGION=us-east-1

EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
