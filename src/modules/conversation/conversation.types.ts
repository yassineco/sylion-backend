/**
 * ================================
 * Conversation Types - Sylion Backend
 * ================================
 */

import { z } from 'zod';
import type { Conversation, NewConversation } from '@/db/schema';

export const CreateConversationSchema = z.object({
  userIdentifier: z.string().min(1),
  userName: z.string().optional(),
  userMetadata: z.record(z.any()).default({}),
  status: z.enum(['active', 'ended', 'paused']).default('active'),
  title: z.string().optional(),
  context: z.record(z.any()).default({}),
});

export const UpdateConversationSchema = CreateConversationSchema.partial();

export type CreateConversationInput = z.infer<typeof CreateConversationSchema>;
export type UpdateConversationInput = z.infer<typeof UpdateConversationSchema>;