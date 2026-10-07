import os

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/cartpilot")
# Seconds that loaded analytics tables / the co-purchase model are cached before reloading.
CACHE_TTL_SECONDS = int(os.environ.get("CACHE_TTL_SECONDS", "60"))
MODEL_TTL_SECONDS = int(os.environ.get("MODEL_TTL_SECONDS", "600"))
# Analytics report calendar days in the store's local timezone.
TIMEZONE = os.environ.get("STORE_TIMEZONE", "Asia/Kolkata")
