/**
 * ================================
 * Routes Configuration - Sylion Backend
 * ================================
 * 
 * Orchestration centrale des routes de tous les modules.
 * Structure modulaire suivant les règles d'ingénierie.
 */

import { FastifyInstance } from 'fastify';
import { logger } from '@/lib/logger';

// Import des routes des modules
import { registerTenantRoutes } from '@/modules/tenant/tenant.routes';
import { registerChannelRoutes } from '@/modules/channel/channel.routes';
import { registerAssistantRoutes } from '@/modules/assistant/assistant.routes';
import { registerConversationRoutes } from '@/modules/conversation/conversation.routes';
import { registerMessageRoutes } from '@/modules/message/message.routes';
import { registerWhatsAppRoutes } from '@/modules/whatsapp/whatsapp.routes';

/**
 * Enregistrement de toutes les routes avec préfixes API versionnés
 */
export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  logger.info('Registering API routes...');

  try {
    // ================================
    // API Version 1 - Routes principales
    // ================================
    await fastify.register(async function apiV1(fastify: FastifyInstance) {
      // Routes pour la gestion des tenants
      await fastify.register(registerTenantRoutes, { prefix: '/tenants' });
      
      // Routes pour la gestion des channels
      await fastify.register(registerChannelRoutes, { prefix: '/channels' });
      
      // Routes pour la gestion des assistants
      await fastify.register(registerAssistantRoutes, { prefix: '/assistants' });
      
      // Routes pour la gestion des conversations
      await fastify.register(registerConversationRoutes, { prefix: '/conversations' });
      
      // Routes pour la gestion des messages
      await fastify.register(registerMessageRoutes, { prefix: '/messages' });
      
    }, { prefix: '/api/v1' });

    // ================================
    // Webhooks (sans versioning)
    // ================================
    await fastify.register(async function webhooks(fastify: FastifyInstance) {
      // Routes WhatsApp (webhook + gestion)
      await fastify.register(registerWhatsAppRoutes, { prefix: '/whatsapp' });
      
    }, { prefix: '/webhooks' });

    // ================================
    // Routes administratives
    // ================================
    await fastify.register(async function admin(fastify: FastifyInstance) {
      // Statistiques des queues
      fastify.get('/queues/stats', {
        schema: {
          tags: ['Admin'],
          summary: 'Get queue statistics',
          response: {
            200: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                data: { type: 'object' },
              },
            },
          },
        },
      }, async (request, reply) => {
        const { getQueueStats } = await import('@/jobs/index');
        const stats = await getQueueStats();
        
        return reply.send({
          success: true,
          data: stats,
        });
      });

      // Informations système
      fastify.get('/system/info', {
        schema: {
          tags: ['Admin'],
          summary: 'Get system information',
          response: {
            200: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                data: { type: 'object' },
              },
            },
          },
        },
      }, async (request, reply) => {
        return reply.send({
          success: true,
          data: {
            version: process.env['npm_package_version'] || '0.1.0',
            node: process.version,
            platform: process.platform,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            pid: process.pid,
          },
        });
      });

    }, { prefix: '/admin' });

    logger.info('All routes registered successfully');
    
  } catch (error) {
    logger.error('Failed to register routes', error);
    throw error;
  }
}

/**
 * Helper pour logger les routes enregistrées (développement)
 */
export function logRegisteredRoutes(fastify: FastifyInstance): void {
  if (process.env['NODE_ENV'] !== 'development') return;

  const routes = fastify.printRoutes({ 
    includeMeta: true,
    includeHooks: false 
  });
  
  logger.debug('Registered routes:', { routes });
}

/**
 * Middleware d'authentification pour les routes admin (à implémenter)
 */
export async function adminAuthMiddleware(request: any, reply: any): Promise<void> {
  // TODO: Implémenter l'authentification pour les routes admin
  // Pour l'instant, on accepte toutes les requêtes en développement
  if (process.env['NODE_ENV'] === 'development') {
    return;
  }
  
  // En production, vérifier l'authentification
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw reply.status(401).send({ error: 'Unauthorized' });
  }
  
  // TODO: Valider le JWT token
}

/**
 * Middleware pour extraire et valider le tenant ID
 */
export async function tenantMiddleware(request: any, reply: any): Promise<void> {
  const tenantId = request.headers['x-tenant-id'] as string;
  
  if (!tenantId) {
    throw reply.status(400).send({ 
      error: 'Missing X-Tenant-ID header' 
    });
  }
  
  // TODO: Valider que le tenant existe et est actif
  request.tenantId = tenantId;
}

/**
 * Middleware pour les routes nécessitant un channel
 */
export async function channelMiddleware(request: any, reply: any): Promise<void> {
  const channelId = request.params.channelId || request.headers['x-channel-id'];
  
  if (!channelId) {
    throw reply.status(400).send({ 
      error: 'Missing channel ID' 
    });
  }
  
  // TODO: Valider que le channel existe et appartient au tenant
  request.channelId = channelId;
}

/**
 * Configuration des hooks globaux pour toutes les routes API
 */
export async function setupGlobalHooks(fastify: FastifyInstance): Promise<void> {
  // Hook pour ajouter CORS headers spécifiques aux APIs
  fastify.addHook('onRequest', async (request, reply) => {
    if (request.url.startsWith('/api/')) {
      reply.header('X-API-Version', 'v1');
      reply.header('X-Service', 'sylion-backend');
    }
  });

  // Hook pour validation des headers requis sur les routes API
  fastify.addHook('preHandler', async (request, reply) => {
    if (request.url.startsWith('/api/v1/')) {
      // Vérifier les headers Content-Type pour POST/PUT/PATCH
      if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
        const contentType = request.headers['content-type'];
        if (contentType && !contentType.includes('application/json') && !contentType.includes('multipart/form-data')) {
          throw reply.status(415).send({
            error: 'Unsupported Media Type. Use application/json or multipart/form-data',
          });
        }
      }
    }
  });

  logger.debug('Global hooks configured');
}