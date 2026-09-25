#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
branch=$(git branch --show-current)
if [ "$branch" = production ]; then
  echo "Use the reviewed develop-to-production promotion workflow; this helper never pushes production." >&2
  exit 1
fi
npm run build
git push -u origin "$branch"
