// src/slaChecker.js
import { pool } from './config/db.js';

export const startSlaChecker = (intervalMs = 60 * 1000) => {
  // run once immediately, then at interval
  const check = async () => {
    try {
      // find unclosed tickets that are due and where no SLA_BREACHED timeline exists yet (to avoid duplicates)
      const sql = `
        SELECT t.id FROM tickets t
        WHERE t.status != 'closed' AND t.due_at IS NOT NULL AND t.due_at <= NOW()
        AND NOT EXISTS (
          SELECT 1 FROM timeline_logs tl WHERE tl.ticket_id = t.id AND tl.action = 'SLA_BREACHED'
        )
        LIMIT 100;
      `;
      const rows = (await pool.query(sql)).rows;
      for (const r of rows) {
        await pool.query(
          `INSERT INTO timeline_logs (ticket_id, actor_id, action, meta) VALUES ($1, NULL, 'SLA_BREACHED', $2)`,
          [r.id, JSON.stringify({ breached_at: new Date().toISOString() })]
        );
      }
      // optional: return how many breached logged
      return rows.length;
    } catch (err) {
      console.error('SLA checker error', err);
    }
  };

  check(); // immediate
  return setInterval(check, intervalMs);
};
