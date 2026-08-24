// ---------------------------------------------------------------------------
// Authentication gate
//
// Fails closed: every route defined below requires a valid JWT unless its exact
// path is listed in PUBLIC_PATHS. A new endpoint is therefore protected by
// default -- opting out has to be deliberate.
// ---------------------------------------------------------------------------
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  // Deliberately no fallback value. This repo is public, so a hardcoded default
  // would let anyone forge a valid token and defeat the gate below.
  throw new Error('JWT_SECRET is not set; refusing to serve an unauthenticated API.');
}

const PUBLIC_PATHS = new Set([
  '/api/health',
  '/api/auth/login',
  '/api/auth/verify'
]);

const authGate = (req, res, next) => {
  if (PUBLIC_PATHS.has(req.path)) return next();

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    req.user = jwt.verify(authHeader.substring(7), JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = { authGate, JWT_SECRET, PUBLIC_PATHS };
