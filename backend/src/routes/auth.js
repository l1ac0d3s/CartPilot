const express = require('express');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const authService = require('../services/authService');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { z } = require('./schemas');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => config.isTest,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts, please try again in a minute' } },
});

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(200),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

router.post('/register', authLimiter, validate(registerSchema), async (req, res) => {
  res.status(201).json(await authService.register(req.valid.body));
});

router.post('/login', authLimiter, validate(loginSchema), async (req, res) => {
  res.json(await authService.login(req.valid.body));
});

router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: await authService.getUser(req.user.id) });
});

module.exports = router;
