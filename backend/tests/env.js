// Loaded by Jest before every test file (see "setupFiles" in package.json).
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/cartpilot_test';
process.env.ML_SERVICE_URL = process.env.TEST_ML_SERVICE_URL || 'http://127.0.0.1:9'; // closed port -> fallback path
process.env.ML_TIMEOUT_MS = '500';
process.env.STRIPE_SECRET_KEY = '';
process.env.JWT_SECRET = 'test-secret';
