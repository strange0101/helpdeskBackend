// src/routes/commentRoutes.js
import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { postComment } from '../controllers/commentController.js';

const router = express.Router({ mergeParams: true });

// POST /api/tickets/:id/comments
router.post('/:id/comments', requireAuth, postComment);

export default router;
