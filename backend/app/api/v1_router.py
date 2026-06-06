from fastapi import APIRouter, File, HTTPException, UploadFile

from app.core.config import get_settings
from app.schemas.fleet_data import AnalyzeFleetResponse, HealthResponse
from app.services.inference import _get_model_bundle, analyze_fleet_csv

router = APIRouter(prefix="/api/v1", tags=["fleet"])


@router.get("/healthz", response_model=HealthResponse)
def healthz() -> HealthResponse:
    settings = get_settings()
    try:
        _get_model_bundle()
        loaded = True
    except Exception:
        loaded = False
    return HealthResponse(status="ok", model_loaded=loaded, model_path=str(settings.model_path))


@router.post("/analyze-fleet", response_model=AnalyzeFleetResponse)
async def analyze_fleet(file: UploadFile = File(...)) -> AnalyzeFleetResponse:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Upload a .csv trip log file")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    try:
        return analyze_fleet_csv(content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Scoring failed: {exc}") from exc
