/**
 * ================================
 * Channel Controller - Sylion Backend
 * ================================
 * 
 * Controller pour la gestion des channels.
 */

import { ErrorCodes, sendSuccess, sendSylionError, SylionError } from '@/lib/http';
import { FastifyReply, FastifyRequest } from 'fastify';
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
      return sendSylionError(reply, error as any, (request as any).requestId);
    }
  }

  async getChannel(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    try {
      const { channelId } = request.params as { channelId: string };
      const { tenantId } = request.query as { tenantId: string };
      
      if (!tenantId) {
        throw new SylionError(ErrorCodes.BAD_REQUEST, 'TenantId requis dans query parameter');
      }
      
      const channel = await this.channelService.getChannelById(channelId, tenantId);
      
      return sendSuccess(reply, channel);
    } catch (error) {
      return sendSylionError(reply, error as any, (request as any).requestId);
    }
  }

  async getChannelsByTenant(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    try {
      const { tenantId } = request.params as { tenantId: string };
      
      const channels = await this.channelService.getChannelsByTenant(tenantId);
      
      return sendSuccess(reply, channels);
    } catch (error) {
      return sendSylionError(reply, error as any, (request as any).requestId);
    }
  }

  async updateChannel(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    try {
      const { channelId } = request.params as { channelId: string };
      const { tenantId } = request.query as { tenantId: string };
      const data = UpdateChannelSchema.parse(request.body);
      
      if (!tenantId) {
        throw new SylionError(ErrorCodes.BAD_REQUEST, 'TenantId requis dans query parameter');
      }
      
      const channel = await this.channelService.updateChannel(channelId, tenantId, data);
      
      return sendSuccess(reply, channel);
    } catch (error) {
      return sendSylionError(reply, error as any, (request as any).requestId);
    }
  }
}