/**
 * ================================
 * Conversation Controller - Sylion Backend
 * ================================
 */

import { ErrorCodes, sendSuccess, sendSylionError, SylionError } from '@/lib/http';
import { FastifyReply, FastifyRequest } from 'fastify';
import { ConversationService } from './conversation.service';
import { CreateConversationSchema, UpdateConversationSchema } from './conversation.types';

export class ConversationController {
  private conversationService = new ConversationService();

  async createConversation(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    try {
      const { tenantId, channelId, assistantId } = request.body as any;
      const data = CreateConversationSchema.parse(request.body);
      
      const conversation = await this.conversationService.createConversation(
        tenantId, channelId, assistantId, data
      );
      
      return sendSuccess(reply, conversation, 201);
    } catch (error) {
      return sendSylionError(reply, error as any, (request as any).requestId);
    }
  }

  async getConversation(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    try {
      const { conversationId } = request.params as { conversationId: string };
      const { tenantId } = request.query as { tenantId: string };
      
      if (!tenantId) {
        throw new SylionError(ErrorCodes.BAD_REQUEST, 'TenantId requis dans query parameter');
      }
      
      const conversation = await this.conversationService.getConversationById(conversationId, tenantId);
      
      return sendSuccess(reply, conversation);
    } catch (error) {
      return sendSylionError(reply, error as any, (request as any).requestId);
    }
  }

  async getConversationsByTenant(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    try {
      const { tenantId } = request.params as { tenantId: string };
      
      const conversations = await this.conversationService.getConversationsByTenant(tenantId);
      
      return sendSuccess(reply, conversations);
    } catch (error) {
      return sendSylionError(reply, error as any, (request as any).requestId);
    }
  }

  async updateConversation(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    try {
      const { conversationId } = request.params as { conversationId: string };
      const { tenantId } = request.query as { tenantId: string };
      const data = UpdateConversationSchema.parse(request.body);
      
      if (!tenantId) {
        throw new SylionError(ErrorCodes.BAD_REQUEST, 'TenantId requis dans query parameter');
      }
      
      const conversation = await this.conversationService.updateConversation(conversationId, tenantId, data);
      
      return sendSuccess(reply, conversation);
    } catch (error) {
      return sendSylionError(reply, error as any, (request as any).requestId);
    }
  }
}