import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pkg;

export const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

pool.connect()
  .then(() => console.log('Connected to Supabase DB'))
  .catch((err) => console.error('Supabase DB connection error:', err));
