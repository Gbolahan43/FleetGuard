# Upload ML artifacts to S3 for Lambda / App Runner.
# Usage: .\upload_models.ps1 -Bucket fleetguard-models-YOURACCOUNT -Region us-east-1

param(
    [Parameter(Mandatory = $true)]
    [string]$Bucket,
    [string]$Prefix = "fleetguard-model",
    [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$ModelsDir = Join-Path $RepoRoot "ml\models"

$Keys = @(
    "fleetguard_anomaly_model.pkl",
    "fleetguard_scaler.pkl",
    "fleetguard_feature_cols.json"
)

foreach ($Key in $Keys) {
    $LocalPath = Join-Path $ModelsDir $Key
    if (-not (Test-Path $LocalPath)) {
        Write-Error "Missing artifact: $LocalPath — run: python ml/scripts/train.py"
    }
    $S3Uri = "s3://$Bucket/$Prefix/$Key"
    Write-Host "Uploading $LocalPath -> $S3Uri"
    aws s3 cp $LocalPath $S3Uri --region $Region
}

Write-Host "Done. Lambda env: MODEL_BUCKET=$Bucket MODEL_PREFIX=$Prefix"
