/**
 * ================================
 * Assistant Controller - Sylion Backend
 * ================================
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { sendSuccess, sendSylionError } from '@/lib/http';
import { AssistantService } from './assistant.service';
import { CreateAssistantSchema, UpdateAssistantSchema } from './assistant.types';

export class AssistantController {
  private assistantService = new AssistantService();

  async createAssistant(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    try {
      const { tenantId } = request.params as { tenantId: string };
      const data = CreateAssistantSchema.parse(request.body);
      
      const assistant = await this.assistantService.createAssistant(tenantId, data);
      
      return sendSuccess(reply, assistant, 201);
    } catch (error) {
      return sendSylionError(reply, error as any, request.requestId);
    }
  }

  async getAssistant(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    try {
      const { assistantId } = request.params as { assistantId: string };
      
      const assistant = await this.assistantService.getAssistantById(assistantId);
      
      return sendSuccess(reply, assistant);
    } catch (error) {
      return sendSylionError(reply, error as any, request.requestId);
    }
  }

  async getAssistantsByTenant(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    try {
      const { tenantId } = request.params as { tenantId: string };
      
      const assistants = await this.assistantService.getAssistantsByTenant(tenantId);
      
      return sendSuccess(reply, assistants);
    } catch (error) {
      return sendSylionError(reply, error as any, request.requestId);
    }
  }

  async updateAssistant(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    try {
      const { assistantId } = request.params as { assistantId: string };
      const data = UpdateAssistantSchema.parse(request.body);
      
      const assistant = await this.assistantService.updateAssistant(assistantId, data);
      
      return sendSuccess(reply, assistant);
    } catch (error) {
      return sendSylionError(reply, error as any, request.requestId);
    }
  }
}