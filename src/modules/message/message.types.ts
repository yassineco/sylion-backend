/**
 * ================================
 * Message Types - Sylion Backend
 * ================================
 */

import { z } from 'zod';

export const CreateMessageSchema = z.object({
  type: z.enum(['text', 'image', 'audio', 'document', 'system']),
  direction: z.enum(['inbound', 'outbound']),
  content: z.string().min(1),
  metadata: z.record(z.any()).default({}),
  externalId: z.string().optional(),
  externalTimestamp: z.date().optional(),
  status: z.enum(['pending', 'processed', 'failed', 'delivered']).default('pending'),
  ragUsed: z.boolean().default(false),
  ragResults: z.record(z.any()).nullable().optional(),
});

export const UpdateMessageSchema = CreateMessageSchema.partial();

// Type pour l'entrée (avant transformation par zod - les champs avec defaults sont optionnels)
export type CreateMessageInput = z.input<typeof CreateMessageSchema>;
// Type pour la sortie (après transformation par zod)
export type CreateMessageOutput = z.infer<typeof CreateMessageSchema>;
export type UpdateMessageInput = z.infer<typeof UpdateMessageSchema>;