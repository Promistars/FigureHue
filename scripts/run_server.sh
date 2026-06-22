#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${FIGUREHUE_PORT:-8080}"

cd "$ROOT"
exec python3 -m http.server "$PORT" --bind 0.0.0.0
