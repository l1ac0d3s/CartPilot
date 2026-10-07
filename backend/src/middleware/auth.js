const jwt = require('jsonwebtoken');
const config = require('../config');
const { unauthorized, forbidden } = require('../utils/errors');

function signToken(user) {
  return jwt.sign({ sub: String(user.id), role: user.role, name: user.name, email: user.email }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

function decode(req) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    return { id: Number(payload.sub), role: payload.role, name: payload.name, email: payload.email };
  } catch {
    throw unauthorized('Invalid or expired token');
  }
}

function requireAuth(req, _res, next) {
  const user = decode(req);
  if (!user) throw unauthorized();
  req.user = user;
  next();
}

/** Attaches req.user when a valid token is present but never rejects anonymous requests. */
function optionalAuth(req, _res, next) {
  try {
    req.user = decode(req) || null;
  } catch {
    req.user = null;
  }
  next();
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') throw forbidden('Admin access required');
    next();
  });
}

module.exports = { signToken, requireAuth, optionalAuth, requireAdmin };
