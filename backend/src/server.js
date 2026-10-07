const config = require('./config');
const { createApp } = require('./app');
const { migrate } = require('./db/migrate');
const { pool } = require('./db/pool');
const { expireUnpaidOrders } = require('./services/orderService');

async function main() {
  if (process.env.RUN_MIGRATIONS !== 'false') await migrate();

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`CartPilot API listening on http://localhost:${config.port}`);
  });

  // Release stock held by online orders that were never paid.
  const sweeper = setInterval(() => {
    expireUnpaidOrders()
      .then((count) => count && console.log(`expired ${count} unpaid order(s)`))
      .catch((err) => console.error('order expiry sweep failed', err));
  }, config.orders.sweepIntervalSeconds * 1000);

  const shutdown = () => {
    clearInterval(sweeper);
    server.close(() => pool.end().finally(() => process.exit(0)));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('failed to start server', err);
  process.exit(1);
});
