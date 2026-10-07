const express = require('express');
const recommendationService = require('../services/recommendationService');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { z } = require('./schemas');

const router = express.Router();

router.get(
  '/',
  requireAuth,
  validate(z.object({ k: z.coerce.number().int().min(1).max(20).optional() }), 'query'),
  async (req, res) => {
    res.json(await recommendationService.getRecommendations(req.user.id, req.valid.query));
  },
);

module.exports = router;
