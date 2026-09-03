// ---------------------------------------------------------------------------
// Authentication gate
//
// Fails closed: every route defined below requires a valid JWT unless its exact
// path is listed in PUBLIC_PATHS. A new endpoint is therefore protected by
// default -- opting out has to be deliberate.
// ---------------------------------------------------------------------------
const jwt = require('jsonwebtoken');
const { queryDatabase } = require('../db');

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


// ---------------------------------------------------------------------------
// Administrator gate
//
// Destructive, irreversible operations (merging players) are restricted to a
// single account named by ADMIN_USERNAME. Identity is resolved from the
// database on each call rather than trusted from the token, so revoking admin
// is a matter of changing the env var -- no need to invalidate issued tokens.
//
// Unset ADMIN_USERNAME disables these routes entirely, which is the safe
// default: no configuration means no one can merge.
// ---------------------------------------------------------------------------
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;

async function isAdminUser(userId) {
  if (!ADMIN_USERNAME || !userId) return false;
  const rows = await queryDatabase('SELECT username FROM users WHERE id = $1', [userId]);
  return Array.isArray(rows) && rows.length > 0 && rows[0].username === ADMIN_USERNAME;
}

const requireAdmin = async (req, res, next) => {
  if (!ADMIN_USERNAME) {
    return res.status(403).json({
      error: 'Administrator actions are disabled because ADMIN_USERNAME is not configured.'
    });
  }
  try {
    if (!(await isAdminUser(req.user && req.user.userId))) {
      return res.status(403).json({ error: 'Administrator access required' });
    }
    next();
  } catch (error) {
    console.error('Admin check failed:', error);
    return res.status(500).json({ error: 'Could not verify administrator access' });
  }
};

module.exports = { authGate, requireAdmin, isAdminUser, JWT_SECRET, PUBLIC_PATHS };
