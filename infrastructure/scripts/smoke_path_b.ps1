# Smoke test Path B (App Runner or local uvicorn)
# Usage: .\smoke_path_b.ps1 -BaseUrl http://localhost:8080

param(
    [Parameter(Mandatory = $true)]
    [string]$BaseUrl
)

$ErrorActionPreference = "Stop"
$Base = $BaseUrl.TrimEnd("/")
$RepoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$Csv = Join-Path $RepoRoot "ml\data\mock\fleetguard_telemetry.csv"

if (-not (Test-Path $Csv)) {
    Write-Error "Missing demo CSV: $Csv"
}

Write-Host "GET /healthz..."
$health = Invoke-RestMethod -Uri "$Base/healthz" -Method Get
Write-Host "  status=$($health.status) model_loaded=$($health.model_loaded)"

Write-Host "POST /api/v1/analyze-fleet..."
$response = curl.exe -s -X POST "$Base/api/v1/analyze-fleet" -F "file=@$Csv" | ConvertFrom-Json

Write-Host "  total_rows=$($response.summary.total_rows) anomaly_count=$($response.summary.anomaly_count)"
Write-Host "  top anomalies=$($response.anomalies.Count)"
Write-Host "Path B smoke test OK"
