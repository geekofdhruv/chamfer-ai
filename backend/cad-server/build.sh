#!/usr/bin/env bash
set -euo pipefail

echo "Building vibecad-cad-executor Docker image..."
cd "$(dirname "$0")"
docker build -t vibecad-cad-executor .
echo "Done. Image vibecad-cad-executor is ready."
