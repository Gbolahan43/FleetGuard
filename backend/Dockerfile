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

# Full ml tree: train at build time (.pkl files are gitignored)
COPY ml /app/ml
COPY backend/app /app/app
ENV PYTHONPATH=/app/ml/src
ENV MODEL_PATH=/app/ml/models
RUN python /app/ml/scripts/train.py

ENV CORS_ORIGINS=*
ENV BEDROCK_ENABLED=true
ENV TOP_N_ANOMALIES=10
ENV AWS_REGION=us-west-2

EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
