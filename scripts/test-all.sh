#!/usr/bin/env bash
set -euo pipefail
pushd apps/web >/dev/null
npm ci
npm run test
npm run build
popd >/dev/null

pushd apps/api >/dev/null
if command -v mvn >/dev/null 2>&1; then
  mvn -q test
else
  docker run --rm -v "$PWD":/workspace -w /workspace maven:3.9-eclipse-temurin-21 mvn -q test
fi
popd >/dev/null
