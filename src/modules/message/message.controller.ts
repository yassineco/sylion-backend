/**
 * ================================
 * Message Controller - Sylion Backend
 * ================================
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { sendSuccess, sendError, sendSylionError } from '@/lib/http';
import { MessageService } from './message.service';
import { CreateMessageSchema, UpdateMessageSchema } from './message.types';

export class MessageController {
  private messageService = new MessageService();

  async createMessage(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    try {
      const { conversationId } = request.body as any;
      const data = CreateMessageSchema.parse(request.body);
      
      const message = await this.messageService.createMessage(conversationId, data);
      
      return sendSuccess(reply, message, 201);
    } catch (error) {
      return sendSylionError(reply, error as any, (request as any).requestId);
    }
  }

  async getMessage(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    try {
      const { messageId } = request.params as { messageId: string };
      
      const message = await this.messageService.getMessageById(messageId);
      
      return sendSuccess(reply, message);
    } catch (error) {
      return sendSylionError(reply, error as any, (request as any).requestId);
    }
  }

  async getMessagesByConversation(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    try {
      const { conversationId } = request.params as { conversationId: string };
      
      const messages = await this.messageService.getMessagesByConversation(conversationId);
      
      return sendSuccess(reply, messages);
    } catch (error) {
      return sendSylionError(reply, error as any, (request as any).requestId);
    }
  }

  async updateMessage(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    try {
      const { messageId } = request.params as { messageId: string };
      const data = UpdateMessageSchema.parse(request.body);
      
      const message = await this.messageService.updateMessage(messageId, data);
      
      return sendSuccess(reply, message);
    } catch (error) {
      return sendSylionError(reply, error as any, (request as any).requestId);
    }
  }
}