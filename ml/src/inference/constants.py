"""Shared ML constants — must match docs/data_schema.md."""

PROJECT = "fleetguard"
RANDOM_SEED = 42
ANOMALY_RATE = 0.12
ZONE_BREACH_THRESHOLD = 0.08

FEATURE_COLS = [
    "speed_kmh",
    "fuel_level_pct",
    "engine_on",
    "idle_minutes",
    "hour",
    "day_of_week",
    "is_working_hour",
    "zone_distance_deg",
]

ENGINEERED_COLS = FEATURE_COLS + [
    "fuel_delta",
    "off_hours_speed",
    "idle_speed_ratio",
    "zone_breach",
]

# S3 / runtime artifact basenames
MODEL_KEY = "fleetguard_anomaly_model.pkl"
SCALER_KEY = "fleetguard_scaler.pkl"
FEATURES_KEY = "fleetguard_feature_cols.json"
