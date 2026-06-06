@echo off
REM FleetGuard — set AWS profile for this cmd.exe session (hackathon account, us-west-2)
set AWS_PROFILE=fleetguard
set AWS_DEFAULT_REGION=us-west-2
echo AWS_PROFILE=%AWS_PROFILE%
echo AWS_DEFAULT_REGION=%AWS_DEFAULT_REGION%
aws sts get-caller-identity
aws configure get region
