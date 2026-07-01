#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v graphify >/dev/null 2>&1; then
  if command -v uv >/dev/null 2>&1; then
    uv tool install --upgrade graphifyy
  else
    echo "graphify not found and uv is unavailable. Install with: pipx install graphifyy" >&2
    exit 1
  fi
fi

GRAPHIFY_PY=""
if [ -x /root/.local/share/uv/tools/graphifyy/bin/python ]; then
  GRAPHIFY_PY=/root/.local/share/uv/tools/graphifyy/bin/python
else
  GRAPHIFY_BIN=$(command -v graphify)
  SHEBANG=$(head -1 "$GRAPHIFY_BIN" | sed 's/^#!//')
  if [ -x "$SHEBANG" ]; then
    GRAPHIFY_PY="$SHEBANG"
  fi
fi

if [ -z "$GRAPHIFY_PY" ]; then
  echo "Could not find the Python interpreter behind graphify." >&2
  exit 1
fi

"$GRAPHIFY_PY" scripts/build_hmc_graphify_graph.py
graphify cluster-only . --graph graphify-out/graph.json --no-label --no-viz
graphify benchmark graphify-out/graph.json
