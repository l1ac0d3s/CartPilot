const crypto = require('crypto');
const config = require('../../config');

/**
 * Local/demo payment provider. The "hosted checkout" is a page in the CartPilot frontend
 * that lets you simulate a successful or failed payment.
 */
module.exports = {
  name: 'mock',

  async createCheckout(order) {
    const ref = `mock_${order.id}_${crypto.randomBytes(6).toString('hex')}`;
    return { ref, checkoutUrl: `${config.frontendUrl}/pay/${order.id}?ref=${ref}` };
  },

  async retrieve() {
    return null; // mock payments are confirmed explicitly via /api/payments/:orderId/mock-confirm
  },

  async refund() {
    return { ok: true };
  },
};
