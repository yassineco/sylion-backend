/**
 * ================================
 * Assistant Routes - Sylion Backend
 * ================================
 */

import { FastifyInstance } from 'fastify';
import { AssistantController } from './assistant.controller';

export async function registerAssistantRoutes(fastify: FastifyInstance): Promise<void> {
  const assistantController = new AssistantController();

  fastify.post('/', assistantController.createAssistant.bind(assistantController));

  fastify.get('/:assistantId', assistantController.getAssistant.bind(assistantController));

  fastify.get('/tenant/:tenantId', assistantController.getAssistantsByTenant.bind(assistantController));

  fastify.put('/:assistantId', assistantController.updateAssistant.bind(assistantController));
}