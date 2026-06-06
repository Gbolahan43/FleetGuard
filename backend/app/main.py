from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load backend/.env into os.environ so boto3 sees AWS_* vars (if set).
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from app.api.v1_router import router as v1_router
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(title="FleetGuard Batch API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.cors_origins] if settings.cors_origins != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v1_router)


@app.get("/healthz", include_in_schema=False)
def root_healthz():
    from app.api.v1_router import healthz

    return healthz()
