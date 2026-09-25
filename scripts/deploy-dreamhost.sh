#!/usr/bin/env bash
set -euo pipefail
: "DREAMHOST_HOST:?Set the SSH host}"
: "DREAMHOST_USER:?Set the SSH user}"
: "DREAMHOST_PATH:?Set the document root for this environment}"
npm run build
# Do not delete remote content or use production targets by default.
# Preserve .htaccess so direct React Router links resolve to index.html.
rsync -az --delay-updates build/ "${DREAMHOST_USER}@${DREAMHOST_HOST}:${DREAMHOST_PATH%/}/"
