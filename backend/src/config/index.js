require('dotenv').config({ quiet: true });

const env = process.env;
const nodeEnv = env.NODE_ENV || 'development';

const config = {
  env: nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  port: Number(env.PORT) || 4000,

  databaseUrl: env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/cartpilot',
  databaseSsl: env.DATABASE_SSL === 'true',

  jwtSecret: env.JWT_SECRET || 'dev-only-insecure-secret',
  jwtExpiresIn: env.JWT_EXPIRES_IN || '7d',

  corsOrigins: (env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  frontendUrl: env.FRONTEND_URL || 'http://localhost:5173',

  mlServiceUrl: (env.ML_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, ''),
  mlTimeoutMs: Number(env.ML_TIMEOUT_MS) || 4000,

  stripe: {
    secretKey: env.STRIPE_SECRET_KEY || '',
    webhookSecret: env.STRIPE_WEBHOOK_SECRET || '',
    currency: 'inr',
  },

  billing: {
    deliveryFee: 30, // ₹ charged below the free-delivery threshold
    freeDeliveryThreshold: 199,
    maxQuantityPerItem: 10,
  },

  orders: {
    // Unpaid online orders are cancelled (and stock released) after this window.
    paymentTimeoutMinutes: Number(env.PAYMENT_TIMEOUT_MINUTES) || 30,
    sweepIntervalSeconds: 60,
  },
};

if (config.isProduction && config.jwtSecret === 'dev-only-insecure-secret') {
  throw new Error('JWT_SECRET must be set in production');
}

module.exports = config;
