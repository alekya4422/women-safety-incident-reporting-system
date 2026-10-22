import crypto from 'crypto';

const SESSION_SECRET = process.env.SESSION_SECRET || 'safesignal_dev_session_secret_key_32chars';
const SESSION_COOKIE_NAME = 'safesignal_admin_session';

/**
 * Creates a signed session token.
 */
export function createSessionToken(user) {
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role || 'admin',
    exp: Date.now() + 8 * 60 * 60 * 1000 // 8 hours
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${signature}`;
}

/**
 * Verifies session token and returns decoded payload.
 */
export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [data, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  if (signature !== expectedSig) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8'));
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * Middleware requiring valid administrator session.
 */
export function requireAdminAuth(req, res, next) {
  let token = req.cookies ? req.cookies[SESSION_COOKIE_NAME] : null;

  // Also allow Authorization: Bearer <token>
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.slice(7).trim();
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in as an administrator.' });
  }

  const session = verifySessionToken(token);
  if (!session) {
    res.clearCookie(SESSION_COOKIE_NAME);
    return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
  }

  req.admin = session;
  next();
}

/**
 * Middleware requiring superadmin role.
 */
export function requireSuperAdmin(req, res, next) {
  if (!req.admin || req.admin.role !== 'superadmin') {
    return res.status(403).json({ error: 'Forbidden. Superadmin privileges required.' });
  }
  next();
}

export { SESSION_COOKIE_NAME };
