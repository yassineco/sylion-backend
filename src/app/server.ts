/**
 * ================================
 * Fastify Server - Sylion Backend
 * ================================
 * 
 * Serveur principal avec middlewares, plugins et configuration.
 * Architecture multi-tenant avec sécurité renforcée.
 */

import fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '@/config/env';
import { logger } from '@/lib/logger';
import { 
  sendError, 
  sendSuccess, 
  generateRequestId, 
  extractRequestId,
  ErrorCodes 
} from '@/lib/http';
import { initializeDatabase, closeDatabaseConnection } from '@/db/index';
import { testRedisConnection, closeRedisConnections } from '@/lib/redis';
import { startWorkers, stopWorkers, getQueueStats } from '@/jobs/index';
import { registerRoutes } from './routes';
import type { Worker } from 'bullmq';

/**
 * Interface pour étendre la requête Fastify avec des propriétés custom
 */
declare module 'fastify' {
  interface FastifyRequest {
    requestId: string;
    tenantId?: string;
    userId?: string;
  }
}

/**
 * Classe principale du serveur Sylion
 */
class SylionServer {
  private app: FastifyInstance;
  private workers: Worker[] = [];

  constructor() {
    this.app = fastify({
      logger: false, // On utilise notre logger custom
      trustProxy: config.isProd, // Trust proxy en production
      bodyLimit: 10 * 1024 * 1024, // 10MB max pour uploads
      disableRequestLogging: true, // On gère le logging nous-mêmes
      requestTimeout: 30000, // 30s timeout
    });

    this.setupMiddlewares();
    this.setupPlugins();
    this.setupHooks();
    this.setupErrorHandlers();
  }

  /**
   * Configuration des middlewares de base
   */
  private async setupMiddlewares(): Promise<void> {
    // Request ID middleware
    this.app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
      request.requestId = extractRequestId(request.headers) || generateRequestId();
      reply.header('X-Request-ID', request.requestId);
    });

    // Security headers (Helmet)
    if (config.server.helmet) {
      await this.app.register(import('@fastify/helmet'), {
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
          },
        },
        crossOriginEmbedderPolicy: false, // Pour permettre les uploads
      });
    }

    // CORS
    if (config.server.cors) {
      await this.app.register(import('@fastify/cors'), {
        origin: config.isProd 
          ? ['https://app.sylion.tech', 'https://dashboard.sylion.tech']
          : true,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-ID'],
      });
    }

    // Rate limiting
    await this.app.register(import('@fastify/rate-limit'), {
      max: config.rateLimit.max,
      timeWindow: config.rateLimit.window,
      addHeaders: {
        'x-ratelimit-limit': true,
        'x-ratelimit-remaining': true,
        'x-ratelimit-reset': true,
      },
      keyGenerator: (request: FastifyRequest) => {
        return request.ip || 'anonymous';
      },
      errorResponseBuilder: (request: FastifyRequest, context) => {
        return sendError(
          {} as FastifyReply, // Workaround pour le type
          ErrorCodes.TOO_MANY_REQUESTS,
          'Too many requests',
          429,
          {
            limit: context.max,
            remaining: context.ttl,
            resetTime: new Date(Date.now() + context.ttl * 1000),
          },
          request.requestId
        );
      },
    });

    // Body parsers
    await this.app.register(import('@fastify/formbody'));
    await this.app.register(import('@fastify/multipart'), {
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB pour les documents RAG
      },
    });

    // Swagger en développement
    if (config.server.swagger && config.isDev) {
      await this.app.register(import('@fastify/swagger'), {
        swagger: {
          info: {
            title: 'Sylion Backend API',
            description: 'API multi-tenant pour la plateforme SylionAI',
            version: process.env['npm_package_version'] || '0.1.0',
          },
          host: `${config.server.host}:${config.server.port}`,
          schemes: ['http', 'https'],
          consumes: ['application/json'],
          produces: ['application/json'],
          tags: [
            { name: 'Health', description: 'Health check endpoints' },
            { name: 'Tenants', description: 'Tenant management' },
            { name: 'Channels', description: 'Channel management' },
            { name: 'Assistants', description: 'AI Assistant management' },
            { name: 'Conversations', description: 'Conversation management' },
            { name: 'Messages', description: 'Message management' },
            { name: 'WhatsApp', description: 'WhatsApp webhooks' },
          ],
        },
      });

      await this.app.register(import('@fastify/swagger-ui'), {
        routePrefix: '/docs',
        uiConfig: {
          docExpansion: 'list',
          deepLinking: false,
        },
      });
    }
  }

  /**
   * Configuration des plugins spécifiques
   */
  private async setupPlugins(): Promise<void> {
    // Plugin pour ajouter les utilitaires à l'instance Fastify
    this.app.decorate('sendSuccess', sendSuccess);
    this.app.decorate('sendError', sendError);
    
    // Plugin pour ajouter le logger
    this.app.decorate('logger', logger);
  }

  /**
   * Configuration des hooks du cycle de vie
   */
  private setupHooks(): void {
    // Hook de logging des requêtes
    this.app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
      const startTime = Date.now();
      
      // Stocker l'heure de début pour calculer la durée
      (request as any).startTime = startTime;
    });

    // Hook de logging des réponses
    this.app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
      const duration = Date.now() - ((request as any).startTime || Date.now());
      
      logger.httpRequest(
        request.method,
        request.url,
        reply.statusCode,
        duration,
        {
          requestId: request.requestId,
          userAgent: request.headers['user-agent'],
          ip: request.ip,
          tenantId: request.tenantId,
        }
      );
    });

    // Hook pour validation des données sensibles
    this.app.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, payload) => {
      // Ne jamais exposer de données sensibles dans les réponses
      if (typeof payload === 'string') {
        try {
          const data = JSON.parse(payload);
          if (data && typeof data === 'object') {
            // Supprimer les champs sensibles si présents
            delete data.apiKey;
            delete data.token;
            delete data.secret;
            delete data.password;
            
            return JSON.stringify(data);
          }
        } catch {
          // Ignore si ce n'est pas du JSON
        }
      }
      return payload;
    });
  }

  /**
   * Configuration de la gestion d'erreurs
   */
  private setupErrorHandlers(): void {
    // Gestionnaire d'erreur global
    this.app.setErrorHandler(async (error, request: FastifyRequest, reply: FastifyReply) => {
      const context = {
        requestId: request.requestId,
        method: request.method,
        url: request.url,
        tenantId: request.tenantId,
      };

      // Log de l'erreur
      logger.error('Unhandled error in request', error, context);

      // Déterminer le code d'erreur et la réponse
      if (error.validation) {
        return sendError(
          reply,
          ErrorCodes.VALIDATION_ERROR,
          'Validation error',
          400,
          {
            validationErrors: error.validation,
          },
          request.requestId
        );
      }

      if (error.statusCode) {
        return sendError(
          reply,
          ErrorCodes.BAD_REQUEST,
          error.message,
          error.statusCode,
          undefined,
          request.requestId
        );
      }

      // Erreur interne par défaut
      return sendError(
        reply,
        ErrorCodes.INTERNAL_SERVER_ERROR,
        config.isProd ? 'Internal server error' : error.message,
        500,
        config.isDev ? { stack: error.stack } : undefined,
        request.requestId
      );
    });

    // Gestionnaire de route non trouvée
    this.app.setNotFoundHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      return sendError(
        reply,
        ErrorCodes.NOT_FOUND,
        `Route ${request.method} ${request.url} not found`,
        404,
        undefined,
        request.requestId
      );
    });
  }

  /**
   * Initialisation des services externes
   */
  private async initializeServices(): Promise<void> {
    logger.info('Initializing external services...');

    // Initialiser la base de données
    const dbOk = await initializeDatabase();
    if (!dbOk) {
      throw new Error('Database initialization failed');
    }

    // Tester Redis
    const redisOk = await testRedisConnection();
    if (!redisOk) {
      throw new Error('Redis connection failed');
    }

    // Démarrer les workers BullMQ
    this.workers = await startWorkers();

    logger.info('All external services initialized successfully');
  }

  /**
   * Configuration des routes
   */
  private setupRoutes(): void {
    // Health check route (avant les autres)
    this.app.get('/health', {
      schema: {
        tags: ['Health'],
        summary: 'Health check endpoint',
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  status: { type: 'string' },
                  timestamp: { type: 'string' },
                  version: { type: 'string' },
                  environment: { type: 'string' },
                  services: { type: 'object' },
                  queues: { type: 'object' },
                },
              },
            },
          },
        },
      },
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      const queueStats = await getQueueStats();
      
      return sendSuccess(reply, {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env['npm_package_version'] || '0.1.0',
        environment: config.isDev ? 'development' : config.isProd ? 'production' : 'test',
        services: {
          database: 'connected',
          redis: 'connected',
          workers: this.workers.length > 0 ? 'running' : 'stopped',
        },
        queues: queueStats,
      });
    });

    // Enregistrer toutes les routes des modules
    registerRoutes(this.app);
  }

  /**
   * Démarrage du serveur
   */
  public async start(): Promise<void> {
    try {
      logger.info('Starting Sylion Backend server...');

      // Initialiser les services externes
      await this.initializeServices();

      // Configurer les routes
      this.setupRoutes();

      // Démarrer le serveur HTTP
      const address = await this.app.listen({
        host: config.server.host,
        port: config.server.port,
      });

      logger.info(`Server listening at ${address}`, {
        port: config.server.port,
        host: config.server.host,
        environment: config.isDev ? 'development' : config.isProd ? 'production' : 'test',
        workers: this.workers.length,
      });

      if (config.server.swagger && config.isDev) {
        logger.info(`Swagger documentation available at ${address}/docs`);
      }

    } catch (error) {
      logger.fatal('Failed to start server', error);
      await this.shutdown();
      process.exit(1);
    }
  }

  /**
   * Arrêt gracieux du serveur
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down server gracefully...');

    try {
      // Arrêter les workers
      if (this.workers.length > 0) {
        await stopWorkers(this.workers);
      }

      // Fermer les connexions Redis
      await closeRedisConnections();

      // Fermer la connexion DB
      await closeDatabaseConnection();

      // Fermer le serveur HTTP
      await this.app.close();

      logger.info('Server shutdown completed');
    } catch (error) {
      logger.error('Error during shutdown', error);
    }
  }
}

/**
 * Fonction pour démarrer le serveur si le fichier est exécuté directement
 */
async function bootstrap(): Promise<void> {
  const server = new SylionServer();

  // Gestion des signaux pour arrêt gracieux
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    await server.shutdown();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGUSR2', () => shutdown('SIGUSR2')); // Nodemon

  // Gestion des erreurs non capturées
  process.on('uncaughtException', (error) => {
    logger.fatal('Uncaught exception', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.fatal('Unhandled rejection', new Error(String(reason)), {
      promise: promise.toString(),
    });
    process.exit(1);
  });

  // Démarrer le serveur
  await server.start();
}

// Démarrer si exécuté directement
if (require.main === module) {
  bootstrap().catch((error) => {
    logger.fatal('Bootstrap failed', error);
    process.exit(1);
  });
}

export default SylionServer;