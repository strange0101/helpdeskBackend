// src/middleware/auth.js
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

export const requireAuth = (req, res, next) => {
  const auth = req.header('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'Authorization required' } });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.id, role: payload.role };
    next();
  } catch (err) {
    return res.status(401).json({ error: { code: 'INVALID_TOKEN' } });
  }
};

export const requireRole = (...allowed) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
  if (!allowed.includes(req.user.role))
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient role' } });
  next();
};
