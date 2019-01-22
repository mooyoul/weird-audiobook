#!/bin/bash

# Variables
DIRNAME="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
CLOUDFRONT_DISTRIBUTION_ID="YOUR_DISTRIBUTION_ID"
BUCKET_NAME="YOUR_BUCKET_NAME"

# Check required dependencies
# aws-cli
command -v aws >/dev/null 2>&1 || { echo >&2 "aws-cli is not found on \$PATH. Please refer aws-cli installation guide: https://docs.aws.amazon.com/cli/latest/userguide/installing.html Aborting."; exit 1; }

# If any command exited without code 0, Fire ERR signal and stop executing remaining lines
set -e

# Setup signal traps
trap 'echo "Line ${BASH_LINENO}: ${BASH_COMMAND} failed with exit code $?"; cleanup failed; exit 1' ERR
trap 'echo "received signal to stop"; cleanup interrupted; exit 1' SIGQUIT SIGTERM SIGINT
function cleanup() {
  echo "Failed to deploy website!"
}


pushd "${DIRNAME}/.."

echo "Copying built files to s3..."
cd client
aws s3 cp index.html s3://${BUCKET_NAME}/index.html

echo "Invalidating cache..."
INVALIDATION_ID=$(aws cloudfront create-invalidation --distribution-id ${CLOUDFRONT_DISTRIBUTION_ID} --paths / /index.html --query Invalidation.Id --output text)

echo "Waiting for cache invalidation complete..."
aws cloudfront wait invalidation-completed --distribution-id ${CLOUDFRONT_DISTRIBUTION_ID} --id ${INVALIDATION_ID} --output text

echo "Done!"
popd
