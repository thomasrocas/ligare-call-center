#!/usr/bin/env bash
set -euo pipefail
pushd apps/web >/dev/null
npm ci
npm run test
npm run build
popd >/dev/null

pushd apps/api >/dev/null
./mvnw -q test
popd >/dev/null
