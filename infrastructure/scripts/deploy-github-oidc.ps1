# Deploy GitHub OIDC IAM stack for FleetGuard CI/CD
# Usage: .\deploy-github-oidc.ps1 [-GitHubOrg Gbolahan43] [-GitHubRepo FleetGuard]

param(
    [string]$GitHubOrg = "Gbolahan43",
    [string]$GitHubRepo = "FleetGuard",
    [string]$GitHubBranch = "main",
    [string]$Region = "us-west-2",
    [string]$Profile = "",
    [string]$StackName = "fleetguard-github-oidc",
    [switch]$OidcProviderExists
)

$ErrorActionPreference = "Stop"
if ($Profile) {
    $env:AWS_PROFILE = $Profile
} else {
    Remove-Item Env:AWS_PROFILE -ErrorAction SilentlyContinue
}
$env:AWS_DEFAULT_REGION = $Region

$RepoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$Template = Join-Path $RepoRoot "infrastructure\iam\github-oidc.yaml"

$Params = @(
    "GitHubOrg=$GitHubOrg",
    "GitHubRepo=$GitHubRepo",
    "GitHubBranch=$GitHubBranch"
)
if ($OidcProviderExists) {
    $Params += "CreateOidcProvider=false"
}

Write-Host "Deploying OIDC stack for repo $GitHubOrg/$GitHubRepo (branch: $GitHubBranch)..."
aws cloudformation deploy `
    --template-file $Template `
    --stack-name $StackName `
    --parameter-overrides @Params `
    --capabilities CAPABILITY_NAMED_IAM `
    --region $Region

$RoleArn = aws cloudformation describe-stacks `
    --stack-name $StackName `
    --query "Stacks[0].Outputs[?OutputKey=='GitHubActionsRoleArn'].OutputValue" `
    --output text `
    --region $Region

Write-Host @"

Done.

Add to GitHub → Settings → Secrets and variables → Actions:

  Secret:  AWS_DEPLOY_ROLE_ARN = $RoleArn
  Variable: ENABLE_AWS_DEPLOY = true

Then run workflow: Actions → AWS Deploy → Run workflow

See infrastructure/iam/README.md for alternatives (access keys vs OIDC).
"@
