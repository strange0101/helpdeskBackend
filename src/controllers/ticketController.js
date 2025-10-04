// src/controllers/ticketController.js
import { pool } from '../config/db.js';
import { idempotencySave } from '../middleware/idempotency.js';
import { parseIfMatch } from '../middleware/ifmatch.js';

/**
 * Create ticket
 * Body: { title, description, priority, assignee_id?, sla_minutes? }
 * Headers: Idempotency-Key (optional)
 */
export const createTicket = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { title, description, priority, assignee_id, sla_minutes } = req.body;
    if (!title) return res.status(400).json({ error: { code: 'FIELD_REQUIRED', field: 'title', message: 'Title is required' } });

    await client.query('BEGIN');

    const createdAtQuery = 'NOW()';
    let dueAtSQL = 'NULL';
    if (sla_minutes) dueAtSQL = `NOW() + INTERVAL '${parseInt(sla_minutes,10)} minutes'`;

    const insertQuery = `
      INSERT INTO tickets (title, description, priority, requester_id, assignee_id, sla_minutes, due_at)
      VALUES ($1,$2,$3,$4,$5,$6, ${dueAtSQL})
      RETURNING id, title, status, requester_id as requester, assignee_id as assignee, sla_minutes, due_at, version, created_at;
    `;

    const result = await client.query(insertQuery, [title, description || null, priority || null, req.user.id, assignee_id || null, sla_minutes || null]);
    const ticket = result.rows[0];

    // timeline log
    await client.query(
      `INSERT INTO timeline_logs (ticket_id, actor_id, action, meta) VALUES ($1,$2,$3,$4)`,
      [ticket.id, req.user.id, 'ticket_created', JSON.stringify({ title })]
    );

    await client.query('COMMIT');

    // save idempotency response if key present
    if (req.idempotencyKey) {
      await idempotencySave(req.idempotencyKey, ticket, 201);
    }

    res.status(201).json(ticket);
  } catch (err) {
    await client.query('ROLLBACK').catch(()=>{});
    next(err);
  } finally {
    client.release();
  }
};


/**
 * GET /api/tickets
 * query: query, status, assignee, limit, offset, breached
 */
export const listTickets = async (req, res, next) => {
  try {
    const { query: q, status, assignee, limit = 25, offset = 0, breached } = req.query;
    const l = Math.min(parseInt(limit, 10) || 25, 100);
    const off = parseInt(offset, 10) || 0;

    // We'll fetch latest comment body via lateral join to allow searching in latest comment
    const baseParams = [];
    let where = 'WHERE 1=1';
    if (status) { baseParams.push(status); where += ` AND t.status = $${baseParams.length}`; }
    if (assignee) { baseParams.push(parseInt(assignee,10)); where += ` AND t.assignee_id = $${baseParams.length}`; }
    if (breached === 'true') { where += ` AND t.status != 'closed' AND t.due_at <= NOW()`; }

    // search across title, description, latest_comment
    let searchJoin = '';
    if (q) {
      baseParams.push(`%${q}%`);
      const pIdx = baseParams.length;
      searchJoin = ` AND (t.title ILIKE $${pIdx} OR t.description ILIKE $${pIdx} OR COALESCE(lc.body,'') ILIKE $${pIdx})`;
    }

    const paramsWithLimit = [...baseParams, l, off];

    const sql = `
      SELECT t.*, lc.body as latest_comment
      FROM tickets t
      LEFT JOIN LATERAL (
        SELECT body FROM comments c WHERE c.ticket_id=t.id ORDER BY created_at DESC LIMIT 1
      ) lc ON true
      ${where}
      ${searchJoin}
      ORDER BY t.updated_at DESC
      LIMIT $${paramsWithLimit.length - 1} OFFSET $${paramsWithLimit.length};
    `;

    const rows = await pool.query(sql, paramsWithLimit);
    // get total rows count for next_offset logic indirectly by checking returned count < limit
    const items = rows.rows;
    const next_offset = items.length < l ? null : off + l;

    res.json({ items, next_offset });
  } catch (err) {
    next(err);
  }
};


/**
 * GET /api/tickets/:id
 * returns ticket + comments + timeline (ordered)
 */
export const getTicket = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const ticketRes = await pool.query('SELECT * FROM tickets WHERE id=$1', [id]);
    if (!ticketRes.rows.length) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ticket not found' } });
    const ticket = ticketRes.rows[0];

    const comments = (await pool.query('SELECT * FROM comments WHERE ticket_id=$1 ORDER BY created_at ASC', [id])).rows;
    const timeline = (await pool.query('SELECT * FROM timeline_logs WHERE ticket_id=$1 ORDER BY created_at ASC', [id])).rows;

    res.json({ ticket, comments, timeline });
  } catch (err) {
    next(err);
  }
};


/**
 * PATCH /api/tickets/:id
 * Uses optimistic locking via If-Match header (version)
 * Allowed updates:
 * - status, title, description, priority, assignee_id, sla_minutes
 */
export const patchTicket = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id = parseInt(req.params.id, 10);
    const ifMatchVer = parseIfMatch(req);
    if (ifMatchVer == null) {
      return res.status(400).json({ error: { code: 'FIELD_REQUIRED', field: 'If-Match', message: 'If-Match header with version required' } });
    }

    // read current version & ticket
    const cur = await client.query('SELECT * FROM tickets WHERE id=$1 FOR UPDATE', [id]);
    if (!cur.rows.length) {
      client.release();
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ticket not found' } });
    }
    const ticket = cur.rows[0];

    if (ticket.version !== ifMatchVer) {
      client.release();
      return res.status(409).json({ error: { code: 'OPTIMISTIC_LOCK', message: 'Stale version' } });
    }

    // build update
    // const fields = [];
    // const vals = [];
    // let idx = 1;
    // const allowed = ['status', 'title', 'description', 'priority', 'assignee_id', 'sla_minutes'];
    // for (const f of allowed) {
    //   if (req.body[f] !== undefined && req.body[f] !== null) {
    //     fields.push(`${f} = $${idx}`);
    //     vals.push(req.body[f]);
    //     idx++;
    //   }
    // }

    const role = req.user.role;
const isOwner = ticket.requester_id === req.user.id;
const isAssignee = ticket.assignee_id === req.user.id;

let allowedFields = [];
if (role === 'user' && isOwner) {
  allowedFields = ['title', 'description']; // user can only update own ticket's content
} else if (role === 'agent' && isAssignee) {
  allowedFields = ['status', 'assignee_id', 'priority']; // agent can update assigned tickets
} else if (role === 'admin') {
  allowedFields = ['title', 'description', 'status', 'assignee_id', 'priority', 'sla_minutes']; // admin can update everything
} else {
  client.release();
  return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
}

// Build update fields only from allowedFields
const fields = [];
const vals = [];
let idx = 1;
for (const f of allowedFields) {
  if (req.body[f] !== undefined && req.body[f] !== null) {
    fields.push(`${f} = $${idx}`);
    vals.push(req.body[f]);
    idx++;
  }
}
if (fields.length === 0) {
  client.release();
  return res.status(400).json({ error: { code: 'NO_FIELDS', message: 'No updatable fields provided' } });
}


    // if (fields.length === 0) {
    //   client.release();
    //   return res.status(400).json({ error: { code: 'NO_FIELDS', message: 'No updatable fields provided' } });
    // }

    // handle sla_minutes => recompute due_at
    let dueAtSQL = '';
    if (req.body.sla_minutes !== undefined) {
      dueAtSQL = `, due_at = NOW() + INTERVAL '${parseInt(req.body.sla_minutes,10)} minutes'`;
    }

    // increment version and update updated_at
    const setClause = fields.join(', ');
    const updateSql = `
      UPDATE tickets SET ${setClause} ${dueAtSQL}, version = version + 1, updated_at = NOW()
      WHERE id = $${idx}
      RETURNING *;
    `;
    vals.push(id);

    await client.query('BEGIN');
    const updateRes = await client.query(updateSql, vals);
    const updatedTicket = updateRes.rows[0];

    // timeline meta
    await client.query(
      'INSERT INTO timeline_logs (ticket_id, actor_id, action, meta) VALUES ($1,$2,$3,$4)',
      [id, req.user.id, 'ticket_updated', JSON.stringify({ changed: Object.keys(req.body) })]
    );

    await client.query('COMMIT');

    res.json(updatedTicket);
  } catch (err) {
    await client.query('ROLLBACK').catch(()=>{});
    next(err);
  } finally {
    client.release();
  }
};


/**
 * GET /api/tickets/breached
 * Returns tickets with due_at <= now() and status != closed
 */
export const getBreachedTickets = async (req, res, next) => {
  try {
    const rows = (await pool.query(
      `SELECT t.*, COALESCE(lc.body,'') AS latest_comment
       FROM tickets t
       LEFT JOIN LATERAL (SELECT body FROM comments c WHERE c.ticket_id=t.id ORDER BY created_at DESC LIMIT 1) lc ON true
       WHERE t.status != 'closed' AND t.due_at <= NOW()
       ORDER BY t.due_at ASC
      `
    )).rows;

    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
};
