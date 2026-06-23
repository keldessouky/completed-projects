#!/bin/sh
set -e

# Apply migrations, then optionally load the demo data (idempotent), then start.
npx prisma migrate deploy

if [ "${SEED_ON_START:-true}" = "true" ]; then
  npx prisma db seed
fi

exec node dist/main.js
