/**
 * ================================
 * Conversation Routes - Sylion Backend
 * ================================
 */

import { FastifyInstance } from 'fastify';
import { ConversationController } from './conversation.controller';

export async function registerConversationRoutes(fastify: FastifyInstance): Promise<void> {
  const conversationController = new ConversationController();

  fastify.post('/', {
    schema: {
      tags: ['Conversations'],
      summary: 'Create a new conversation',
    },
  }, conversationController.createConversation.bind(conversationController));

  fastify.get('/:conversationId', {
    schema: {
      tags: ['Conversations'],
      summary: 'Get a conversation by ID',
    },
  }, conversationController.getConversation.bind(conversationController));

  fastify.get('/tenant/:tenantId', {
    schema: {
      tags: ['Conversations'],
      summary: 'Get conversations by tenant',
    },
  }, conversationController.getConversationsByTenant.bind(conversationController));

  fastify.put('/:conversationId', {
    schema: {
      tags: ['Conversations'],
      summary: 'Update a conversation',
    },
  }, conversationController.updateConversation.bind(conversationController));
}