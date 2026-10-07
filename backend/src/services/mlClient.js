const config = require('../config');
const { serviceUnavailable } = require('../utils/errors');

/** Minimal REST client for the Python intelligence service (recommendations + analytics). */
async function mlGet(path, params = {}) {
  const url = new URL(`${config.mlServiceUrl}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(config.mlTimeoutMs) });
  } catch (err) {
    throw serviceUnavailable('Intelligence service is unreachable', { details: { cause: err.message } });
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw serviceUnavailable(`Intelligence service returned ${response.status}`, { details: { body: body.slice(0, 300) } });
  }
  return response.json();
}

module.exports = { mlGet };
