// src/controllers/commentController.js
import { pool } from '../config/db.js';

export const postComment = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const ticketId = parseInt(req.params.id, 10);
    const { body, parent_id } = req.body;
    if (!body) return res.status(400).json({ error: { code: 'FIELD_REQUIRED', field: 'body', message: 'Comment body required' } });

    await client.query('BEGIN');

    // ensure ticket exists
    const t = await client.query('SELECT id FROM tickets WHERE id=$1', [ticketId]);
    if (!t.rows.length) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ticket not found' } });
    }

    const insert = await client.query(
      `INSERT INTO comments (ticket_id, parent_id, author_id, body) VALUES ($1,$2,$3,$4) RETURNING *`,
      [ticketId, parent_id || null, req.user.id, body]
    );

    // update ticket updated_at
    await client.query('UPDATE tickets SET updated_at = NOW() WHERE id=$1', [ticketId]);

    // timeline log
    await client.query(
      'INSERT INTO timeline_logs (ticket_id, actor_id, action, meta) VALUES ($1,$2,$3,$4)',
      [ticketId, req.user.id, 'comment_added', JSON.stringify({ comment_id: insert.rows[0].id })]
    );

    await client.query('COMMIT');

    res.status(201).json(insert.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(()=>{});
    next(err);
  } finally {
    client.release();
  }
};
