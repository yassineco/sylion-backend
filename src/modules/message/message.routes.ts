/**
 * ================================
 * Message Routes - Sylion Backend
 * ================================
 */

import { FastifyInstance } from 'fastify';
import { MessageController } from './message.controller';

export async function registerMessageRoutes(fastify: FastifyInstance): Promise<void> {
  const messageController = new MessageController();

  fastify.post('/', {
    schema: {
      tags: ['Messages'],
      summary: 'Create a new message',
    },
  }, messageController.createMessage.bind(messageController));

  fastify.get('/:messageId', {
    schema: {
      tags: ['Messages'],
      summary: 'Get a message by ID',
    },
  }, messageController.getMessage.bind(messageController));

  fastify.get('/conversation/:conversationId', {
    schema: {
      tags: ['Messages'],
      summary: 'Get messages by conversation',
    },
  }, messageController.getMessagesByConversation.bind(messageController));

  fastify.put('/:messageId', {
    schema: {
      tags: ['Messages'],
      summary: 'Update a message',
    },
  }, messageController.updateMessage.bind(messageController));
}