import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import ticketRoutes from './routes/ticketRoutes.js';
import commentRoutes from './routes/commentRoutes.js';
import { startSlaChecker } from './slaChecker.js';

dotenv.config();

const app = express();

// Start SLA checker
const slaInterval = startSlaChecker(60 * 1000);

// Enable CORS for all origins (development + future frontends)
app.use(
  cors({
    origin: '*', // allow requests from any domain
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Optional: handle preflight requests for all routes
app.options('*', cors());

// JSON body parser
app.use(express.json());

// Rate limiting — 60 requests/min per user
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

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
