#!/usr/bin/env bash
# Upload ML artifacts to S3 for Lambda / App Runner.
# Usage: ./upload_models.sh fleetguard-models-YOURACCOUNT [fleetguard-model] [us-east-1]

set -euo pipefail

BUCKET="${1:?Usage: $0 <bucket> [prefix] [region]}"
PREFIX="${2:-fleetguard-model}"
REGION="${3:-us-east-1}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MODELS_DIR="$REPO_ROOT/ml/models"

for key in fleetguard_anomaly_model.pkl fleetguard_scaler.pkl fleetguard_feature_cols.json; do
  local_path="$MODELS_DIR/$key"
  if [[ ! -f "$local_path" ]]; then
    echo "Missing $local_path — run: python ml/scripts/train.py" >&2
    exit 1
  fi
  echo "Uploading $local_path -> s3://$BUCKET/$PREFIX/$key"
  aws s3 cp "$local_path" "s3://$BUCKET/$PREFIX/$key" --region "$REGION"
done

echo "Done. Lambda env: MODEL_BUCKET=$BUCKET MODEL_PREFIX=$PREFIX"
