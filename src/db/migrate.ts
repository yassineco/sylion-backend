/**
 * ================================
 * Database Migration Runner - Sylion Backend
 * ================================
 * 
 * Script pour exécuter les migrations Drizzle.
 */

import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, client } from './index';
import { logger } from '../lib/logger';

async function runMigrations() {
  try {
    logger.info('Starting database migrations...');
    
    await migrate(db, { migrationsFolder: './src/db/migrations' });
    
    logger.info('Database migrations completed successfully');
    
    await client.end();
    process.exit(0);
  } catch (error) {
    logger.error('Database migration failed', error);
    await client.end();
    process.exit(1);
  }
}

// Exécuter si le script est appelé directement
if (require.main === module) {
  runMigrations();
}