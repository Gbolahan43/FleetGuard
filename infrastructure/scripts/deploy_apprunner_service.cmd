@echo off
REM Build, push ECR image, deploy App Runner CloudFormation stack.
REM Usage: infrastructure\scripts\deploy_apprunner_service.cmd
REM From repo root with default AWS credentials (use-default-aws.cmd).

setlocal
cd /d "%~dp0..\.."

set AWS_PROFILE=
set AWS_DEFAULT_REGION=us-west-2
set REGION=us-west-2
set REPO=fleetguard-backend
set STACK=fleetguard-apprunner

echo Verifying AWS account...
aws sts get-caller-identity
if errorlevel 1 exit /b 1

echo.
echo === Step 1: Build and push Docker image to ECR ===
powershell -NoProfile -ExecutionPolicy Bypass -File infrastructure\scripts\deploy_apprunner.ps1 -RepositoryName %REPO% -Region %REGION% -Tag latest
if errorlevel 1 exit /b 1

for /f "usebackq delims=" %%A in (`aws sts get-caller-identity --query Account --output text`) do set ACCOUNT=%%A
set IMAGE_URI=%ACCOUNT%.dkr.ecr.%REGION%.amazonaws.com/%REPO%:latest

echo.
echo === Step 2: Deploy App Runner stack %STACK% ===
echo Image: %IMAGE_URI%
aws cloudformation deploy ^
  --template-file infrastructure\apprunner\template.yaml ^
  --stack-name %STACK% ^
  --parameter-overrides ImageUri=%IMAGE_URI% ServiceName=%REPO% EcrRepositoryName=%REPO% ^
  --capabilities CAPABILITY_NAMED_IAM ^
  --region %REGION% ^
  --no-fail-on-empty-changeset

if errorlevel 1 exit /b 1

echo.
echo === App Runner service URL ===
aws cloudformation describe-stacks ^
  --stack-name %STACK% ^
  --query "Stacks[0].Outputs[?OutputKey=='ServiceUrl'].OutputValue" ^
  --output text ^
  --region %REGION%

echo.
echo Smoke test:
echo   powershell -File infrastructure\scripts\smoke_path_b.ps1 -BaseUrl ^<ServiceUrl above^>
echo.
endlocal
