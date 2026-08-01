#!/usr/bin/env bash
# Fast local gate before opening a PR.
set -euo pipefail
cd "$(dirname "$0")/.."

npm run lint
npm run format:check
npm test
npm run audit
npm run build

echo "All checks passed."
