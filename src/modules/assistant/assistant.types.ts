/**
 * ================================
 * Assistant Types - Sylion Backend
 * ================================
 */

import { z } from 'zod';
import type { Assistant, NewAssistant } from '@/db/schema';

export const CreateAssistantSchema = z.object({
  name: z.string().min(2).max(255),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  model: z.string().default('gemini-1.5-pro'),
  systemPrompt: z.string().min(10),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().min(1).max(8192).default(1024),
  enableRag: z.boolean().default(false),
  ragThreshold: z.number().min(0).max(1).default(0.7),
  ragMaxResults: z.number().min(1).max(20).default(5),
});

export const UpdateAssistantSchema = CreateAssistantSchema.partial();

export type CreateAssistantInput = z.infer<typeof CreateAssistantSchema>;
export type UpdateAssistantInput = z.infer<typeof UpdateAssistantSchema>;