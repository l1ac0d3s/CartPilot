#!/bin/sh
# Container entrypoint: optionally seed an empty database, then serve the API.
set -e
if [ "${SEED_ON_START:-false}" = "true" ]; then
  python -m cartpilot_ml.datagen --if-empty --wait-for-schema "${SEED_WAIT_SECONDS:-180}" || echo "seeding skipped"
fi
exec uvicorn cartpilot_ml.api:app --host 0.0.0.0 --port "${PORT:-8000}"
