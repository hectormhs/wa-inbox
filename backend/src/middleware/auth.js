import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'wa-inbox-secret-change-me';

export function generateToken(agent) {
  return jwt.sign({ id: agent.id, email: agent.email, role: agent.role }, SECRET, { expiresIn: '7d' });
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  const token = header ? header.replace('Bearer ', '') : req.query.token;
  if (!token) return res.status(401).json({ error: 'Token required' });
  try {
    req.agent = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}
