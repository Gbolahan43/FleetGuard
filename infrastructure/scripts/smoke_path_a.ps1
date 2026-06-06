# Smoke test Path A after SAM deploy
# Usage: .\smoke_path_a.ps1 -ApiUrl https://xxx.execute-api.us-west-2.amazonaws.com

param(
    [Parameter(Mandatory = $true)]
    [string]$ApiUrl
)

$ErrorActionPreference = "Stop"
$Base = $ApiUrl.TrimEnd("/")

Write-Host "GET /incidents..."
$incidents = Invoke-RestMethod -Uri "$Base/incidents?limit=5&source=realtime" -Method Get
Write-Host "  incidents returned: $($incidents.incidents.Count)"

Write-Host "POST /score (single ping)..."
$body = @{
    pings = @(
        @{
            vehicle_id = "LG-1001"
            timestamp = "2025-01-26T15:19:00"
            lat = 6.455
            lng = 3.395
            speed_kmh = 45.2
            fuel_level_pct = 62.5
            engine_on = 1
            idle_minutes = 5
            hour = 15
            day_of_week = 0
            is_working_hour = 1
            zone_distance_deg = 0.012
        }
    )
} | ConvertTo-Json -Depth 5

$score = Invoke-RestMethod -Uri "$Base/score" -Method Post -Body $body -ContentType "application/json"
Write-Host "  processed=$($score.processed) anomalies=$($score.anomalies)"

Write-Host "Replay seed (optional — requires ml venv)..."
$RepoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$Python = Join-Path $RepoRoot ".venv\Scripts\python.exe"
if (Test-Path $Python) {
    & $Python (Join-Path $RepoRoot "ml\scripts\replay.py") --api $Base --mode seed
} else {
    Write-Host "  skip seed — no .venv; run: python ml/scripts/replay.py --api $Base --mode seed"
}

Write-Host "Path A smoke test OK"
