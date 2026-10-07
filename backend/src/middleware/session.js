const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

/** Reads the browser session id (sent by the frontend) used for funnel analytics. */
function sessionId(req, _res, next) {
  const value = req.get('x-session-id');
  req.sessionId = value && SESSION_ID_PATTERN.test(value) ? value : null;
  next();
}

module.exports = { sessionId };
