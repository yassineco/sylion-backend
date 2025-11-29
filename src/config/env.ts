/**
 * ================================
 * Configuration Environnement - Sylion Backend
 * ================================
 * 
 * Gestion stricte et sécurisée des variables d'environnement
 * avec validation Zod et types TypeScript.
 * 
 * SÉCURITÉ: Aucun secret ne doit être hardcodé dans ce fichier.
 * Toutes les valeurs sensibles doivent être dans .env.local (non versionné).
 */

import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

/**
 * Schema de validation des variables d'environnement
 */
const envSchema = z.object({
  // ================================
  // Application
  // ================================
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().min(1000).max(65535).default(3000),
  HOST: z.string().default('0.0.0.0'),
  
  // ================================
  // Database (Supabase PostgreSQL)
  // ================================
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection string'),
  
  // ================================
  // Redis (Cache & BullMQ)
  // ================================
  REDIS_URL: z.string().url('REDIS_URL must be a valid Redis connection string'),
  
  // ================================
  // WhatsApp API (360dialog)
  // ================================
  WHATSAPP_API_URL: z.string().url('WHATSAPP_API_URL must be a valid URL').default('https://waba-v2.360dialog.io'),
  WHATSAPP_API_KEY: z.string().min(20, 'WHATSAPP_API_KEY is required and must be valid'),
  WHATSAPP_VERIFY_TOKEN: z.string().min(8, 'WHATSAPP_VERIFY_TOKEN must be at least 8 characters'),
  WHATSAPP_WEBHOOK_URL: z.string().url('WHATSAPP_WEBHOOK_URL must be a valid URL').optional(),
  
  // ================================
  // Google Cloud Platform
  // ================================
  GCP_PROJECT_ID: z.string().min(1, 'GCP_PROJECT_ID is required'),
  GCP_SERVICE_ACCOUNT_KEY: z.string().min(100, 'GCP_SERVICE_ACCOUNT_KEY must be a valid JSON string'),
  GCS_BUCKET_NAME: z.string().min(3, 'GCS_BUCKET_NAME is required'),
  
  // ================================
  // Vertex AI
  // ================================
  VERTEX_AI_LOCATION: z.string().default('us-central1'),
  VERTEX_AI_MODEL: z.string().default('gemini-1.5-pro'),
  VERTEX_EMBEDDING_MODEL: z.string().default('text-embedding-004'),
  
  // ================================
  // Queue Configuration
  // ================================
  INCOMING_MESSAGES_QUEUE_NAME: z.string().default('incomingMessages'),
  
  // ================================
  // Authentication & Security
  // ================================
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  
  // ================================
  // Rate Limiting
  // ================================
  RATE_LIMIT_MAX: z.coerce.number().min(1).default(100),
  RATE_LIMIT_WINDOW: z.string().default('1m'),
  
  // ================================
  // Logging
  // ================================
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: z.coerce.boolean().default(false),
  
  // ================================
  // Features Flags
  // ================================
  ENABLE_SWAGGER: z.coerce.boolean().default(false),
  ENABLE_CORS: z.coerce.boolean().default(true),
  ENABLE_HELMET: z.coerce.boolean().default(true),
});

/**
 * Type pour les variables d'environnement validées
 */
export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validation et export de la configuration
 */
function validateEnv(): EnvConfig {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    console.error('❌ Erreur de configuration environnement:', error);
    console.error('📝 Vérifiez votre fichier .env.local');
    process.exit(1);
  }
}

// Export de la configuration validée
export const env = validateEnv();

/**
 * Utilitaires de configuration
 */
export const config = {
  /**
   * Vérifie si l'environnement est en développement
   */
  isDev: env.NODE_ENV === 'development',
  
  /**
   * Vérifie si l'environnement est en production
   */
  isProd: env.NODE_ENV === 'production',
  
  /**
   * Vérifie si l'environnement est en test
   */
  isTest: env.NODE_ENV === 'test',
  
  /**
   * Configuration base de données
   */
  database: {
    url: env.DATABASE_URL,
    ssl: env.NODE_ENV === 'production',
  },
  
  /**
   * Configuration Redis
   */
  redis: {
    url: env.REDIS_URL,
    maxRetries: 3,
    retryDelayMs: 2000,
  },
  
  /**
   * Configuration serveur
   */
  server: {
    host: env.HOST,
    port: env.PORT,
    cors: env.ENABLE_CORS,
    helmet: env.ENABLE_HELMET,
    swagger: env.ENABLE_SWAGGER,
  },
  
  /**
   * Configuration logging
   */
  logging: {
    level: env.LOG_LEVEL,
    pretty: env.LOG_PRETTY,
  },
  
  /**
   * Configuration WhatsApp
   */
  whatsapp: {
    apiUrl: env.WHATSAPP_API_URL,
    apiKey: env.WHATSAPP_API_KEY,
    verifyToken: env.WHATSAPP_VERIFY_TOKEN,
    webhookUrl: env.WHATSAPP_WEBHOOK_URL,
  },
  
  /**
   * Configuration GCP
   */
  gcp: {
    projectId: env.GCP_PROJECT_ID,
    serviceAccountKey: env.GCP_SERVICE_ACCOUNT_KEY,
    bucketName: env.GCS_BUCKET_NAME,
  },
  
  /**
   * Configuration Vertex AI
   */
  vertex: {
    location: env.VERTEX_AI_LOCATION,
    model: env.VERTEX_AI_MODEL,
    embeddingModel: env.VERTEX_EMBEDDING_MODEL,
  },
  
  /**
   * Configuration JWT
   */
  auth: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
  },
  
  /**
   * Configuration Rate Limiting
   */
  rateLimit: {
    max: env.RATE_LIMIT_MAX,
    window: env.RATE_LIMIT_WINDOW,
  },
} as const;

/**
 * Fonction pour masquer les données sensibles dans les logs
 */
export function maskSensitiveData(data: string): string {
  if (!data) return '';
  
  // Masquer les numéros de téléphone WhatsApp
  if (data.startsWith('+')) {
    return data.substring(0, 4) + 'x'.repeat(Math.max(0, data.length - 8)) + data.slice(-4);
  }
  
  // Masquer les clés/tokens
  if (data.length > 16) {
    return data.substring(0, 8) + '***' + data.slice(-4);
  }
  
  return data;
}