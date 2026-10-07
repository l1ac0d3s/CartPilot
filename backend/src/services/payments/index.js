const config = require('../../config');
const mockProvider = require('./mockProvider');
const stripeProvider = require('./stripeProvider');

const providers = { mock: mockProvider, stripe: stripeProvider };

/** Stripe is used whenever STRIPE_SECRET_KEY is configured; otherwise the mock provider. */
function activeProvider() {
  return config.stripe.secretKey ? stripeProvider : mockProvider;
}

function getProvider(name) {
  return providers[name];
}

module.exports = { activeProvider, getProvider };
