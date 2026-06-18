#!/bin/sh
set -e

echo "[entrypoint] Applying database migrations (prisma migrate deploy)..."
npx prisma migrate deploy

echo "[entrypoint] Starting DVLA IDP backend..."
exec node dist/index.js
