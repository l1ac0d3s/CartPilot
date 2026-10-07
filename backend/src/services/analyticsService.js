const { mlGet } = require('./mlClient');

const SECTIONS = ['business', 'products', 'customers', 'inventory'];

/** Analytics are computed by the Python (pandas) service; the API layer only enforces auth. */
async function getAnalytics(section, { days } = {}) {
  return mlGet(`/analytics/${section}`, { days });
}

module.exports = { SECTIONS, getAnalytics };
