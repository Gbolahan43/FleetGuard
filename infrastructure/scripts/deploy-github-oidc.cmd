@echo off
REM Deploy GitHub OIDC IAM stack — default AWS account, repo Gbolahan43/FleetGuard
REM Usage: infrastructure\scripts\deploy-github-oidc.cmd
REM        infrastructure\scripts\deploy-github-oidc.cmd oidc-exists

setlocal
cd /d "%~dp0..\.."

set AWS_PROFILE=
set AWS_DEFAULT_REGION=us-west-2
set STACK=fleetguard-github-oidc
set TEMPLATE=infrastructure\iam\github-oidc.yaml

echo Verifying default AWS account...
aws sts get-caller-identity
if errorlevel 1 exit /b 1

set PARAMS=GitHubOrg=Gbolahan43 GitHubRepo=FleetGuard GitHubBranch=main
if /i "%~1"=="oidc-exists" set PARAMS=%PARAMS% CreateOidcProvider=false

echo.
echo Deploying OIDC stack %STACK% ...
aws cloudformation deploy ^
  --template-file %TEMPLATE% ^
  --stack-name %STACK% ^
  --parameter-overrides %PARAMS% ^
  --capabilities CAPABILITY_NAMED_IAM ^
  --region us-west-2

if errorlevel 1 exit /b 1

echo.
echo Role ARN (copy to GitHub secret AWS_DEPLOY_ROLE_ARN):
aws cloudformation describe-stacks ^
  --stack-name %STACK% ^
  --query "Stacks[0].Outputs[?OutputKey=='GitHubActionsRoleArn'].OutputValue" ^
  --output text ^
  --region us-west-2

echo.
echo Next steps:
echo   1. GitHub - Gbolahan43/FleetGuard - Settings - Secrets: AWS_DEPLOY_ROLE_ARN = ARN above
echo   2. GitHub Variables: ENABLE_AWS_DEPLOY = true
echo   3. Actions - AWS Deploy - Run workflow
echo.
endlocal
