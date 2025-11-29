/**
 * ================================
 * Channel Routes - Sylion Backend
 * ================================
 */

import { FastifyInstance } from 'fastify';
import { ChannelController } from './channel.controller';

/**
 * Enregistrement des routes pour les channels
 */
export async function registerChannelRoutes(fastify: FastifyInstance): Promise<void> {
  const channelController = new ChannelController();

  // Créer un channel
  fastify.post('/', channelController.createChannel.bind(channelController));

  // Récupérer un channel par ID
  fastify.get('/:channelId', channelController.getChannel.bind(channelController));

  // Lister les channels d'un tenant
  fastify.get('/tenant/:tenantId', channelController.getChannelsByTenant.bind(channelController));

  // Mettre à jour un channel
  fastify.put('/:channelId', channelController.updateChannel.bind(channelController));
}