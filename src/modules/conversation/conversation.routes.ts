/**
 * ================================
 * Conversation Routes - Sylion Backend
 * ================================
 */

import { FastifyInstance } from 'fastify';
import { ConversationController } from './conversation.controller';

export async function registerConversationRoutes(fastify: FastifyInstance): Promise<void> {
  const conversationController = new ConversationController();

  fastify.post('/', conversationController.createConversation.bind(conversationController));

  fastify.get('/:conversationId', conversationController.getConversation.bind(conversationController));

  fastify.get('/tenant/:tenantId', conversationController.getConversationsByTenant.bind(conversationController));

  fastify.put('/:conversationId', conversationController.updateConversation.bind(conversationController));
}