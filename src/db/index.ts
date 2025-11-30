/**
 * ================================
 * Database Connection - Sylion Backend
 * ================================
 * 
 * Configuration de la connexion PostgreSQL avec Drizzle ORM.
 * Support pour Supabase et connexions locales.
 */

import { config } from '@/config/env';
import { logger } from '@/lib/logger';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Configuration de la connexion PostgreSQL
 */
const connectionConfig = {
  // Configuration SSL pour production (Supabase)
  ssl: config.database.ssl ? 'require' as const : false,
  
  // Pool de connexions
  max: config.isProd ? 20 : 5,
  idle_timeout: 20,
  connect_timeout: 10,
  
  // Transform pour les colonnes snake_case vers camelCase
  transform: {
    undefined: null,
  },
  
  // Configuration des types PostgreSQL
  types: {
    // Support pour pgvector
    vector: {
      to: 1043,
      from: [1043],
      serialize: (x: number[]) => '[' + x.join(',') + ']',
      parse: (x: string) => x.slice(1, -1).split(',').map(Number),
    },
  },
  
  // Logging des requêtes en développement
  debug: config.isDev ? (connection: any, query: any, parameters: any) => {
    logger.debug('SQL Query', {
      query: query.slice(0, 200) + (query.length > 200 ? '...' : ''),
      parameters: parameters?.slice(0, 5), // Limite pour éviter les logs trop longs
    });
  } : false,
};

/**
 * Client PostgreSQL
 */
export const client = postgres(config.database.url, connectionConfig);

/**
 * Instance Drizzle avec schéma complet
 */
export const db = drizzle(client, { 
  schema,
  logger: config.isDev ? {
    logQuery(query: string, params: unknown[]) {
      logger.debug('Drizzle Query', {
        query: query.slice(0, 200) + (query.length > 200 ? '...' : ''),
        paramsCount: params.length,
      });
    },
  } : false,
});

/**
 * Type pour l'instance de base de données
 */
export type Database = typeof db;

/**
 * Test de connexion à la base de données
 */
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    // Test simple avec une requête
    await client`SELECT 1 as test`;
    
    logger.info('Database connection test successful');
    return true;
  } catch (error) {
    logger.error('Database connection test failed', error);
    return false;
  }
}

/**
 * Vérification des extensions requises
 */
export async function checkDatabaseExtensions(): Promise<{
  uuid: boolean;
  vector: boolean;
  pg_trgm: boolean;
}> {
  try {
    const extensions = await client`
      SELECT extname 
      FROM pg_extension 
      WHERE extname IN ('uuid-ossp', 'vector', 'pg_trgm')
    `;
    
    const extensionNames = extensions.map((ext: any) => ext.extname);
    
    const status = {
      uuid: extensionNames.includes('uuid-ossp'),
      vector: extensionNames.includes('vector'),
      pg_trgm: extensionNames.includes('pg_trgm'),
    };
    
    logger.info('Database extensions check', status);
    
    // Vérifier que toutes les extensions requises sont présentes
    const allPresent = Object.values(status).every(Boolean);
    if (!allPresent) {
      logger.error('Missing required database extensions', {
        missing: Object.entries(status)
          .filter(([, present]) => !present)
          .map(([name]) => name),
      });
    }
    
    return status;
  } catch (error) {
    logger.error('Failed to check database extensions', error);
    return { uuid: false, vector: false, pg_trgm: false };
  }
}

/**
 * Fonction pour fermer proprement la connexion
 */
export async function closeDatabaseConnection(): Promise<void> {
  try {
    await client.end();
    logger.info('Database connection closed gracefully');
  } catch (error) {
    logger.error('Error closing database connection', error);
  }
}

/**
 * Fonction d'initialisation de la base de données
 */
export async function initializeDatabase(): Promise<boolean> {
  try {
    logger.info('Initializing database connection...');
    
    // Test de connexion
    const connectionOk = await testDatabaseConnection();
    if (!connectionOk) {
      throw new Error('Database connection failed');
    }
    
    // Vérification des extensions
    const extensions = await checkDatabaseExtensions();
    if (!extensions.uuid || !extensions.vector || !extensions.pg_trgm) {
      logger.warn('Some database extensions are missing. Please run the init script.');
    }
    
    logger.info('Database initialized successfully');
    return true;
  } catch (error) {
    logger.error('Database initialization failed', error);
    return false;
  }
}

/**
 * Helper pour les transactions
 */
export async function withTransaction<T>(
  callback: (tx: Database) => Promise<T>
): Promise<T> {
  return await db.transaction(callback);
}

/**
 * Export du schéma pour utilisation dans les modules
 */
export { schema };

/**
 * Types utilitaires pour les requêtes
 */
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];