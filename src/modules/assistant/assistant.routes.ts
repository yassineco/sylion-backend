/**
 * ================================
 * Assistant Routes - Sylion Backend
 * ================================
 */

import { FastifyInstance } from 'fastify';
import { AssistantController } from './assistant.controller';

export async function registerAssistantRoutes(fastify: FastifyInstance): Promise<void> {
  const assistantController = new AssistantController();

  fastify.post('/', {
    schema: {
      tags: ['Assistants'],
      summary: 'Create a new assistant',
    },
  }, assistantController.createAssistant.bind(assistantController));

  fastify.get('/:assistantId', {
    schema: {
      tags: ['Assistants'],
      summary: 'Get an assistant by ID',
    },
  }, assistantController.getAssistant.bind(assistantController));

  fastify.get('/tenant/:tenantId', {
    schema: {
      tags: ['Assistants'],
      summary: 'Get assistants by tenant',
    },
  }, assistantController.getAssistantsByTenant.bind(assistantController));

  fastify.put('/:assistantId', {
    schema: {
      tags: ['Assistants'],
      summary: 'Update an assistant',
    },
  }, assistantController.updateAssistant.bind(assistantController));
}