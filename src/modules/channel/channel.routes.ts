/**
 * ================================
 * Channel Routes - Sylion Backend
 * ================================
 * 
 * Définition des routes pour la gestion des channels.
 */

import { FastifyInstance } from 'fastify';
import { ChannelController } from './channel.controller';

/**
 * Enregistrement des routes pour les channels
 */
export async function registerChannelRoutes(fastify: FastifyInstance): Promise<void> {
  const channelController = new ChannelController();

  // Créer un channel
  fastify.post('/', {
    schema: {
      tags: ['Channels'],
      summary: 'Create a new channel',
      body: {
        type: 'object',
        required: ['name', 'type'],
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: ['whatsapp', 'web', 'voice'] },
          isActive: { type: 'boolean' },
          config: { type: 'object' },
        },
      },
    },
  }, channelController.createChannel.bind(channelController));

  // Récupérer un channel
  fastify.get('/:channelId', {
    schema: {
      tags: ['Channels'],
      summary: 'Get a channel by ID',
      params: {
        type: 'object',
        properties: {
          channelId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, channelController.getChannel.bind(channelController));

  // Lister les channels d'un tenant
  fastify.get('/tenant/:tenantId', {
    schema: {
      tags: ['Channels'],
      summary: 'Get channels by tenant',
      params: {
        type: 'object',
        properties: {
          tenantId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, channelController.getChannelsByTenant.bind(channelController));

  // Mettre à jour un channel
  fastify.put('/:channelId', {
    schema: {
      tags: ['Channels'],
      summary: 'Update a channel',
      params: {
        type: 'object',
        properties: {
          channelId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, channelController.updateChannel.bind(channelController));
}