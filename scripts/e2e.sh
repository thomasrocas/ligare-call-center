#!/usr/bin/env bash
set -euo pipefail
pushd apps/web >/dev/null
npm run e2e
popd >/dev/null
