const express = require('express');
const analyticsService = require('../services/analyticsService');
const { requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { z } = require('./schemas');

const router = express.Router();
router.use(requireAdmin);

const querySchema = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) });

router.get('/', validate(querySchema, 'query'), async (req, res) => {
  res.json(await analyticsService.getAnalytics('business', req.valid.query));
});

router.get(
  '/:section',
  validate(z.object({ section: z.enum(analyticsService.SECTIONS) }), 'params'),
  validate(querySchema, 'query'),
  async (req, res) => {
    res.json(await analyticsService.getAnalytics(req.valid.params.section, req.valid.query));
  },
);

module.exports = router;
