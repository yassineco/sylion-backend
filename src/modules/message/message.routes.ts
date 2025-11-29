/**
 * ================================
 * Message Routes - Sylion Backend
 * ================================
 */

import { FastifyInstance } from 'fastify';
import { MessageController } from './message.controller';

export async function registerMessageRoutes(fastify: FastifyInstance): Promise<void> {
  const messageController = new MessageController();

  fastify.post('/', messageController.createMessage.bind(messageController));

  fastify.get('/:messageId', messageController.getMessage.bind(messageController));

  fastify.get('/conversation/:conversationId', messageController.getMessagesByConversation.bind(messageController));

  fastify.put('/:messageId', messageController.updateMessage.bind(messageController));
}