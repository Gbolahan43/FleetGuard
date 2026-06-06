# Build, tag, and push backend image to ECR for App Runner.
# Usage: .\deploy_apprunner.ps1 -RepositoryName fleetguard-backend [-Region us-west-2]

param(
    [Parameter(Mandatory = $true)]
    [string]$RepositoryName,
    [string]$Region = "us-west-2",
    [string]$Tag = "latest"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent

function Invoke-AwsCli {
    param(
        [switch]$CaptureOutput,
        [Parameter(ValueFromRemainingArguments = $true)][string[]]$AwsArgs
    )
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    if ($CaptureOutput) {
        $out = (& aws @AwsArgs 2>&1 | Out-String).Trim()
    } else {
        & aws @AwsArgs | Out-Null
        $out = $null
    }
    $exit = $LASTEXITCODE
    $ErrorActionPreference = $prev
    if ($exit -ne 0) { throw "aws failed ($exit): aws $($AwsArgs -join ' ')" }
    if ($CaptureOutput) { return $out }
}

$AccountId = (Invoke-AwsCli -CaptureOutput sts get-caller-identity --query Account --output text)
$Registry = "$AccountId.dkr.ecr.$Region.amazonaws.com"
$ImageUri = "$Registry/${RepositoryName}:$Tag"

Write-Host "Ensuring ECR repository $RepositoryName..."
$prev = $ErrorActionPreference
$ErrorActionPreference = "Continue"
aws ecr describe-repositories --repository-names $RepositoryName --region $Region 2>&1 | Out-Null
$ecrExists = ($LASTEXITCODE -eq 0)
$ErrorActionPreference = $prev
if (-not $ecrExists) {
    Invoke-AwsCli ecr create-repository --repository-name $RepositoryName --region $Region
}

Write-Host "Logging in to ECR..."
$loginPassword = Invoke-AwsCli -CaptureOutput ecr get-login-password --region $Region
$loginPassword | docker login --username AWS --password-stdin $Registry
if ($LASTEXITCODE -ne 0) { throw "docker login to ECR failed" }

Write-Host "Building backend image..."
docker build -f (Join-Path $RepoRoot "backend\Dockerfile") -t $RepositoryName $RepoRoot
if ($LASTEXITCODE -ne 0) { throw "docker build failed" }

Write-Host "Tagging and pushing $ImageUri..."
docker tag "${RepositoryName}:latest" $ImageUri
docker push $ImageUri
if ($LASTEXITCODE -ne 0) { throw "docker push failed" }

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
