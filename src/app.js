import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import ticketRoutes from './routes/ticketRoutes.js';
import commentRoutes from './routes/commentRoutes.js';

import { startSlaChecker } from './slaChecker.js';
const slaInterval = startSlaChecker(60 * 1000);
// optionally store slaInterval to clear on shutdown


dotenv.config();
const app = express();

// CORS open for judging
app.use(cors({ origin: '*' }));
app.use(express.json());

// Rate limit — 60 req/min/user
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    handler: (req, res) =>
      res.status(429).json({ error: { code: 'RATE_LIMIT' } }),
  })
);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/tickets', commentRoutes); // nested

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
