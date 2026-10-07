const { AppError } = require('../utils/errors');
const config = require('../config');

function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` } });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'BAD_JSON', message: 'Malformed JSON body' } });
  }
  // PostgreSQL constraint violations that slipped past validation.
  if (err.code === '23505') {
    return res.status(409).json({ error: { code: 'CONFLICT', message: 'Resource already exists' } });
  }
  if (err.code === '23503') {
    return res.status(409).json({ error: { code: 'CONFLICT', message: 'Referenced resource does not exist' } });
  }
  if (err.code === '23514') {
    return res.status(400).json({ error: { code: 'CONSTRAINT_VIOLATION', message: 'Value violates a constraint' } });
  }

  if (!config.isTest) console.error(err);
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
}

module.exports = { notFoundHandler, errorHandler };
