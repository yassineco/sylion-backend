/**
 * ================================
 * Message Types - Sylion Backend
 * ================================
 */

import { z } from 'zod';
import type { Message, NewMessage } from '@/db/schema';

export const CreateMessageSchema = z.object({
  type: z.enum(['text', 'image', 'audio', 'document', 'system']),
  direction: z.enum(['inbound', 'outbound']),
  content: z.string().min(1),
  metadata: z.record(z.any()).default({}),
  externalId: z.string().optional(),
  externalTimestamp: z.date().optional(),
  status: z.enum(['pending', 'processed', 'failed', 'delivered']).default('pending'),
});

export const UpdateMessageSchema = CreateMessageSchema.partial();

export type CreateMessageInput = z.infer<typeof CreateMessageSchema>;
export type UpdateMessageInput = z.infer<typeof UpdateMessageSchema>;