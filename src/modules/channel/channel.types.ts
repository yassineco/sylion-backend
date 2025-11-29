/**
 * ================================
 * Channel Types - Sylion Backend
 * ================================
 * 
 * Types et interfaces pour la gestion des channels.
 */

import { z } from 'zod';
import type { Channel, NewChannel } from '@/db/schema';

/**
 * Schema de validation pour création d'un channel
 */
export const CreateChannelSchema = z.object({
  name: z.string().min(2).max(255),
  type: z.enum(['whatsapp', 'web', 'voice']),
  isActive: z.boolean().default(true),
  config: z.record(z.any()).default({}),
  whatsappPhoneNumber: z.string().optional(),
  whatsappApiKey: z.string().optional(),
  whatsappVerifyToken: z.string().optional(),
});

/**
 * Schema de validation pour mise à jour d'un channel
 */
export const UpdateChannelSchema = CreateChannelSchema.partial();

export type CreateChannelInput = z.infer<typeof CreateChannelSchema>;
export type UpdateChannelInput = z.infer<typeof UpdateChannelSchema>;