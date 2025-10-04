// src/routes/ticketRoutes.js
import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { checkIdempotency } from '../middleware/idempotency.js';
import {
  createTicket,
  listTickets,
  getTicket,
  patchTicket,
  getBreachedTickets
} from '../controllers/ticketController.js';

const router = express.Router();

// Create ticket (Idempotency-Key supported)
router.post('/', requireAuth, checkIdempotency, createTicket);

// List tickets (pagination, search, filters)
router.get('/', requireAuth, listTickets);

// Breached tickets listing for judge checks
router.get('/breached', requireAuth, getBreachedTickets);

// Get single ticket (with timeline & comments)
router.get('/:id', requireAuth, getTicket);

// Patch ticket (optimistic locking) — certain fields restricted by roles
router.patch('/:id', requireAuth, patchTicket);

export default router;
