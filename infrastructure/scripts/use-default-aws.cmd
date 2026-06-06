@echo off
REM Use default AWS CLI credentials (clear hackathon profile) + us-west-2 for FleetGuard deploy.
set AWS_PROFILE=
set AWS_DEFAULT_REGION=us-west-2
echo AWS_PROFILE=(default)
echo AWS_DEFAULT_REGION=%AWS_DEFAULT_REGION%
aws sts get-caller-identity
aws configure get region
