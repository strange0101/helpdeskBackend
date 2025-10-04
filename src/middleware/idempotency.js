// src/middleware/idempotency.js
import { pool } from '../config/db.js';

/**
 * For POST endpoints that create resources.
 * If Idempotency-Key exists, return stored response.
 * Otherwise, proceed and expect controller to save the response via idempotencySave(req, resBody, status)
 */

export const checkIdempotency = async (req, res, next) => {
  try {
    const key = req.header('Idempotency-Key');
    if (!key) return next();

    const userId = req.user?.id ?? null;
    const row = await pool.query('SELECT response, status_code FROM idempotency_keys WHERE key=$1', [key]);
    if (row.rows.length) {
      const { response, status_code } = row.rows[0];
      return res.status(status_code).json(response);
    }

    // attach key to req so controller can store after successful create
    req.idempotencyKey = { key, userId };
    next();
  } catch (err) {
    next(err);
  }
};

// helper used by controller to persist response
export const idempotencySave = async ({ key, userId }, responseBody, statusCode = 201) => {
  if (!key) return;
  await pool.query(
    'INSERT INTO idempotency_keys(key, user_id, response, status_code) VALUES ($1,$2,$3,$4) ON CONFLICT (key) DO NOTHING',
    [key, userId, responseBody, statusCode]
  );
};
