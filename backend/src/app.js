const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const db = require('./db/pool');
const { sessionId } = require('./middleware/session');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { router: paymentRoutes, stripeWebhook } = require('./routes/payments');

function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Id'],
    }),
  );

  // Stripe signs the raw payload, so the webhook must see the body before JSON parsing.
  app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

  app.use(express.json({ limit: '100kb' }));
  if (!config.isTest) app.use(morgan(config.isProduction ? 'combined' : 'dev'));
  app.use(sessionId);

  app.get('/api/health', async (_req, res) => {
    try {
      await db.query('SELECT 1');
      res.json({ status: 'ok', database: 'up' });
    } catch {
      res.status(503).json({ status: 'degraded', database: 'down' });
    }
  });

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api', require('./routes/products')); // /products, /categories, /coupons
  app.use('/api/cart', require('./routes/cart'));
  app.use('/api/orders', require('./routes/orders'));
  app.use('/api/payments', paymentRoutes);
  app.use('/api/recommendations', require('./routes/recommendations'));
  app.use('/api/analytics', require('./routes/analytics'));
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api/events', require('./routes/events'));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
