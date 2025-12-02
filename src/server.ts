/**
 * ================================
 * Server Entry Point - Sylion Backend
 * ================================
 * 
 * Point d'entrée principal du serveur avec fonction createApp() pour tests.
 */

import { config } from '@/config/env';
import { logger } from '@/lib/logger';
import fastify, { FastifyInstance } from 'fastify';
import { registerRoutes } from './app/routes';

/**
 * Crée une instance Fastify configurée pour l'application
 */
export function createApp(): FastifyInstance {
  const app = fastify({
    logger: false, // On utilise notre logger custom
    trustProxy: config.isProd,
    bodyLimit: 10 * 1024 * 1024, // 10MB max
    disableRequestLogging: true,
    requestTimeout: 30000,
  });

  // Middleware pour les IDs de requête
  app.addHook('onRequest', async (request) => {
    const requestId = request.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    (request as any).requestId = requestId;
  });

  // Middleware de logging des requêtes
  app.addHook('onResponse', async (request, reply) => {
    const duration = reply.getResponseTime();
    logger.info('Request completed', {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      duration: `${duration.toFixed(2)}ms`,
      requestId: (request as any).requestId,
    });
  });

  // Middleware de gestion d'erreurs
  app.setErrorHandler(async (error, request, reply) => {
    const requestId = (request as any).requestId || 'unknown';
    
    logger.error('Request error', {
      error: error.message,
      stack: error.stack,
      method: request.method,
      url: request.url,
      requestId,
    });

    // Gestion des erreurs de validation (JSON Schema)
    if (error.validation) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation error',
          validationErrors: error.validation,
          requestId,
        },
      });
    }

    // Erreur avec statusCode spécifique
    if (error.statusCode && error.statusCode !== 500) {
      return reply.status(error.statusCode).send({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: error.message,
          requestId,
        },
      });
    }

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
        requestId,
      },
    });
  });

  // Enregistrement des routes
  app.register(registerRoutes);

  return app;
}

/**
 * Démarrage du serveur si ce fichier est exécuté directement
 */
if (require.main === module) {
  async function start() {
    try {
      const app = createApp();
      
      // Démarrer le serveur
      await app.listen({ 
        port: config.server.port, 
        host: config.server.host 
      });
      
      logger.info(`🚀 Sylion Backend started on ${config.server.host}:${config.server.port}`);
      logger.info(`Environment: ${config.isDev ? 'development' : config.isProd ? 'production' : 'test'}`);
      
    } catch (error) {
      logger.error('Failed to start server', { error });
      process.exit(1);
    }
  }

  start();
}