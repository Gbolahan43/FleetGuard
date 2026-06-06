# Build, tag, and push backend image to ECR for App Runner.
# Usage: .\deploy_apprunner.ps1 -RepositoryName fleetguard-backend [-Region us-east-1]

param(
    [Parameter(Mandatory = $true)]
    [string]$RepositoryName,
    [string]$Region = "us-east-1",
    [string]$Tag = "latest"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent

$AccountId = (aws sts get-caller-identity --query Account --output text)
$Registry = "$AccountId.dkr.ecr.$Region.amazonaws.com"
$ImageUri = "$Registry/${RepositoryName}:$Tag"

Write-Host "Ensuring ECR repository $RepositoryName..."
$repoExists = aws ecr describe-repositories --repository-names $RepositoryName --region $Region 2>$null
if (-not $repoExists) {
    aws ecr create-repository --repository-name $RepositoryName --region $Region
}

Write-Host "Logging in to ECR..."
aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin $Registry

Write-Host "Building backend image..."
docker build -f (Join-Path $RepoRoot "backend\Dockerfile") -t $RepositoryName $RepoRoot

Write-Host "Tagging and pushing $ImageUri..."
docker tag "${RepositoryName}:latest" $ImageUri
docker push $ImageUri

Write-Host @"

Image pushed: $ImageUri

Create App Runner service (Console):
  1. App Runner → Create service → Container registry → Amazon ECR
  2. Image: $ImageUri
  3. Port: 8080
  4. Health check: /healthz
  5. Env: CORS_ORIGINS=*, BEDROCK_ENABLED=true, TOP_N_ANOMALIES=10

Then run: .\infrastructure\scripts\smoke_path_b.ps1 -BaseUrl <AppRunnerUrl>
"@
