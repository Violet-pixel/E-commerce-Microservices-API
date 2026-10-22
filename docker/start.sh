#!/bin/sh
set -e
cd "/app/services/${SERVICE}"
if [ -d prisma/migrations ]; then
  attempt=1
  until node /app/node_modules/prisma/build/index.js migrate deploy; do
    if [ "$attempt" -ge 10 ]; then
      echo "migracoes falharam" >&2
      exit 1
    fi
    attempt=$((attempt + 1))
    sleep 3
  done
fi
exec node dist/main.js
