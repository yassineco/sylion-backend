/**
 * ================================
 * Drizzle Configuration - Sylion Backend
 * ================================
 * 
 * Configuration pour Drizzle Kit (migrations, studio, etc.)
 */

import type { Config } from 'drizzle-kit';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
  // Configuration pour pgvector
  schemaFilter: ['public'],
} satisfies Config;