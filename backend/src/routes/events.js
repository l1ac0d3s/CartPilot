const express = require('express');
const { trackEvent } = require('../services/eventService');
const { optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { z } = require('./schemas');

const router = express.Router();

// Client-side funnel events that the API cannot observe on its own.
router.post('/', optionalAuth, validate(z.object({ type: z.enum(['checkout_started']) })), async (req, res) => {
  await trackEvent({ sessionId: req.sessionId, userId: req.user?.id, type: req.valid.body.type });
  res.status(202).json({ accepted: Boolean(req.sessionId) });
});

module.exports = router;
