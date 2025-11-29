/**
 * ================================
 * Channel Controller - Sylion Backend
 * ================================
 * 
 * Controller pour la gestion des channels.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { sendSuccess, sendSylionError, ErrorCodes } from '@/lib/http';
import { ChannelService } from './channel.service';
import { CreateChannelSchema, UpdateChannelSchema } from './channel.types';

/**
 * Controller pour la gestion des channels
 */
export class ChannelController {
  private channelService = new ChannelService();

  async createChannel(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    try {
      const { tenantId } = request.params as { tenantId: string };
      const data = CreateChannelSchema.parse(request.body);
      
      const channel = await this.channelService.createChannel(tenantId, data);
      
      return sendSuccess(reply, channel, 201);
    } catch (error) {
      return sendSylionError(reply, error as any, request.requestId);
    }
  }

  async getChannel(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    try {
      const { channelId } = request.params as { channelId: string };
      
      const channel = await this.channelService.getChannelById(channelId);
      
      return sendSuccess(reply, channel);
    } catch (error) {
      return sendSylionError(reply, error as any, request.requestId);
    }
  }

  async getChannelsByTenant(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    try {
      const { tenantId } = request.params as { tenantId: string };
      
      const channels = await this.channelService.getChannelsByTenant(tenantId);
      
      return sendSuccess(reply, channels);
    } catch (error) {
      return sendSylionError(reply, error as any, request.requestId);
    }
  }

  async updateChannel(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    try {
      const { channelId } = request.params as { channelId: string };
      const data = UpdateChannelSchema.parse(request.body);
      
      const channel = await this.channelService.updateChannel(channelId, data);
      
      return sendSuccess(reply, channel);
    } catch (error) {
      return sendSylionError(reply, error as any, request.requestId);
    }
  }
}