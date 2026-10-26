#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
node scripts/check.mjs
node scripts/consumer.mjs
node scripts/downstream.mjs
node scripts/browser-check.mjs
