from typing import Any

from pydantic import BaseModel, Field


class FleetSummary(BaseModel):
    total_rows: int
    total_vehicles: int
    anomaly_count: int
    anomaly_rate_pct: float
    breakdown: dict[str, int] = Field(default_factory=dict)


class ScoredRow(BaseModel):
    vehicle_id: str
    timestamp: str
    lat: float
    lng: float
    speed_kmh: float
    fuel_level_pct: float
    fuel_delta: float
    is_anomaly: bool
    score: float
    anomaly_type: str = "normal"


class AnomalyReport(BaseModel):
    vehicle_id: str
    timestamp: str
    lat: float
    lng: float
    score: float
    anomaly_type: str = "unknown"
    report: str


class AnalyzeFleetResponse(BaseModel):
    summary: FleetSummary
    rows: list[ScoredRow]
    anomalies: list[AnomalyReport]


class HealthResponse(BaseModel):
    status: str = "ok"
    model_loaded: bool = False
    model_path: str = ""


class ErrorDetail(BaseModel):
    detail: str
