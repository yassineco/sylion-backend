/**
 * ================================
 * Message Processor Worker - Sylion Backend
 * ================================
 * 
 * Worker BullMQ pour traiter les messages WhatsApp entrants.
 * Pipeline : Résolution tenant/channel -> Conversation -> Message -> IA -> Réponse
 */

import { Job } from 'bullmq';
import { logger } from '@/lib/logger';
import { db } from '@/db/index';
import { schema } from '@/db/index';
import { eq, and } from 'drizzle-orm';
import { channelService } from '@/modules/channel/channel.service';
import { conversationService } from '@/modules/conversation/conversation.service';
import { messageService } from '@/modules/message/message.service';
import { assistantService } from '@/modules/assistant/assistant.service';
import { tenantService } from '@/modules/tenant/tenant.service';
import { sendWhatsAppTextMessage } from '@/modules/whatsapp/whatsapp.provider';
import { generateAssistantReply } from '@/lib/llm';
import type { NormalizedIncomingMessage } from '@/modules/whatsapp/whatsapp.types';
import type { JobTypes } from './index';
import { maskPhoneNumber } from '@/modules/whatsapp/whatsapp.types';

/**
 * ================================
 * Types pour le worker
 * ================================
 */

interface MessageProcessorContext {
  message: NormalizedIncomingMessage;
  tenantId: string;
  channelId: string;
  conversationId: string;
  assistantId: string;
}

/**
 * ================================
 * Worker Principal
 * ================================
 */
export async function processIncomingMessage(
  job: Job<JobTypes['incoming-message']>
): Promise<void> {
  const { messageData } = job.data;
  
  logger.info('Processing incoming message', {
    jobId: job.id,
    messageId: messageData.externalId,
    from: maskPhoneNumber(messageData.from.phoneNumber),
    channelPhone: maskPhoneNumber(messageData.channelPhoneNumber),
  });

  try {
    // 1. Résolution du contexte (tenant, channel, conversation, assistant)
    const context = await resolveMessageContext(messageData);
    
    // 2. Enregistrement du message utilisateur
    const userMessage = await saveUserMessage(context);
    
    // 3. Génération de la réponse IA
    const assistantReply = await generateReply(context);
    
    // 4. Enregistrement du message assistant
    const assistantMessage = await saveAssistantMessage(context, assistantReply);
    
    // 5. Envoi de la réponse WhatsApp
    await sendReplyToWhatsApp(context, assistantReply);
    
    // 6. Mise à jour des statistiques
    await updateStats(context);

    logger.info('Message processing completed successfully', {
      jobId: job.id,
      messageId: messageData.externalId,
      userMessageId: userMessage.id,
      assistantMessageId: assistantMessage.id,
      replyLength: assistantReply.length,
    });

  } catch (error) {
    logger.error('Message processing failed', {
      jobId: job.id,
      messageId: messageData.externalId,
      from: maskPhoneNumber(messageData.from.phoneNumber),
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    throw error; // BullMQ gérera les retry automatiquement
  }
}

/**
 * ================================
 * Étape 1 : Résolution du contexte
 * ================================
 */
async function resolveMessageContext(
  message: NormalizedIncomingMessage
): Promise<MessageProcessorContext> {
  
  // 1. Trouver le channel par numéro de téléphone
  const channel = await findChannelByPhoneNumber(message.channelPhoneNumber);
  if (!channel) {
    throw new Error(`No channel found for phone number: ${maskPhoneNumber(message.channelPhoneNumber)}`);
  }

  // 2. Vérifier que le tenant est actif
  const tenant = await tenantService.getTenantById(channel.tenantId);
  if (!tenant || !tenant.isActive) {
    throw new Error(`Tenant not found or inactive: ${channel.tenantId}`);
  }

  // 3. Obtenir ou créer la conversation
  const conversation = await findOrCreateConversation(
    channel.tenantId,
    channel.id,
    message.from.phoneNumber
  );

  // 4. Résoudre l'assistant (priorité : conversation > channel > tenant default)
  const assistant = await resolveAssistant(
    channel.tenantId,
    conversation?.assistantId,
    undefined // Pas de defaultAssistantId dans la structure channel
  );

  return {
    message,
    tenantId: channel.tenantId,
    channelId: channel.id,
    conversationId: conversation?.id || '',
    assistantId: assistant.id,
  };
}

/**
 * Trouver un channel par numéro de téléphone
 */
async function findChannelByPhoneNumber(phoneNumber: string) {
  try {
    const channels = await db
      .select()
      .from(schema.channels)
      .where(
        and(
          eq(schema.channels.type, 'whatsapp'),
          eq(schema.channels.isActive, true)
        )
      );

    // Recherche dans la configuration des channels
    for (const channel of channels) {
      const config = channel.config as any;
      if (config?.phoneNumber === phoneNumber || config?.businessPhoneNumber === phoneNumber) {
        return channel;
      }
    }

    return null;
  } catch (error) {
    logger.error('Error finding channel by phone number', {
      phoneNumber: maskPhoneNumber(phoneNumber),
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Trouver ou créer une conversation
 */
async function findOrCreateConversation(
  tenantId: string,
  channelId: string,
  userPhoneNumber: string
) {
  try {
    // Chercher une conversation existante active pour cet utilisateur
    const existingConversations = await db
      .select()
      .from(schema.conversations)
      .where(
        and(
          eq(schema.conversations.tenantId, tenantId),
          eq(schema.conversations.channelId, channelId),
          eq(schema.conversations.userIdentifier, userPhoneNumber),
          eq(schema.conversations.status, 'active')
        )
      )
      .limit(1);

    if (existingConversations.length > 0) {
      return existingConversations[0];
    }

    // Créer une nouvelle conversation
    logger.info('Creating new conversation', {
      tenantId,
      channelId,
      userPhone: maskPhoneNumber(userPhoneNumber),
    });

    // Obtenir l'assistant par défaut du tenant
    const defaultAssistant = await assistantService.getDefaultAssistant(tenantId);
    
    const newConversation = await conversationService.createConversation(
      tenantId,
      channelId,
      defaultAssistant?.id || '', // Fallback si pas d'assistant par défaut
      {
        status: 'active',
        userIdentifier: userPhoneNumber,
        userMetadata: {
          phoneNumber: userPhoneNumber,
          firstName: 'Utilisateur WhatsApp',
          platform: 'whatsapp',
          initialMessage: '',
        },
        context: {
          source: 'whatsapp',
          channel: 'whatsapp',
          provider: '360dialog',
          createdByWorker: true,
        },
        userName: 'Utilisateur WhatsApp',
      }
    );

    return newConversation;

  } catch (error) {
    logger.error('Error finding or creating conversation', {
      tenantId,
      channelId,
      userPhone: maskPhoneNumber(userPhoneNumber),
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Résoudre l'assistant à utiliser
 */
async function resolveAssistant(
  tenantId: string,
  conversationAssistantId?: string | null,
  channelAssistantId?: string | null
) {
  try {
    // Priorité 1 : Assistant de la conversation
    if (conversationAssistantId) {
      const assistant = await assistantService.getAssistantById(conversationAssistantId);
      if (assistant && assistant.isActive) {
        return assistant;
      }
    }

    // Priorité 2 : Assistant par défaut du channel
    if (channelAssistantId) {
      const assistant = await assistantService.getAssistantById(channelAssistantId);
      if (assistant && assistant.isActive) {
        return assistant;
      }
    }

    // Priorité 3 : Assistant par défaut du tenant
    const defaultAssistant = await assistantService.getDefaultAssistant(tenantId);
    if (defaultAssistant) {
      return defaultAssistant;
    }

    throw new Error(`No active assistant found for tenant: ${tenantId}`);

  } catch (error) {
    logger.error('Error resolving assistant', {
      tenantId,
      conversationAssistantId,
      channelAssistantId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * ================================
 * Étape 2 : Sauvegarde du message utilisateur
 * ================================
 */
async function saveUserMessage(context: MessageProcessorContext) {
  try {
    const userMessage = await messageService.createMessage(context.conversationId, {
      type: 'text',
      direction: 'inbound',
      content: context.message.text || '',
      status: 'processed',
      externalId: context.message.externalId,
      metadata: {
        whatsapp: {
          from: context.message.from,
          timestamp: context.message.timestamp,
          isReply: context.message.isReply,
          replyToMessageId: context.message.replyToMessageId,
        },
        originalMessage: context.message,
      },
    });

    logger.debug('User message saved', {
      messageId: userMessage.id,
      conversationId: context.conversationId,
      contentLength: userMessage.content.length,
    });

    return userMessage;

  } catch (error) {
    logger.error('Error saving user message', {
      conversationId: context.conversationId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * ================================
 * Étape 3 : Génération de la réponse IA
 * ================================
 */
async function generateReply(context: MessageProcessorContext): Promise<string> {
  try {
    // Récupérer l'historique récent de la conversation
    const recentMessages = await messageService.getMessagesByConversation(context.conversationId);
    
    // Préparer le contexte pour l'IA
    const messages = recentMessages
      .slice(-10) // Derniers 10 messages pour le contexte
      .map(msg => ({
        role: (msg.direction === 'inbound' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: msg.content,
      }));

    // Ajouter le message actuel
    messages.push({
      role: 'user',
      content: context.message.text || '',
    });

    // Générer la réponse
    const reply = await generateAssistantReply({
      tenantId: context.tenantId,
      assistantId: context.assistantId,
      messages,
    });

    logger.debug('Assistant reply generated', {
      conversationId: context.conversationId,
      assistantId: context.assistantId,
      replyLength: reply.length,
      contextMessages: messages.length,
    });

    return reply;

  } catch (error) {
    logger.error('Error generating assistant reply', {
      conversationId: context.conversationId,
      assistantId: context.assistantId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * ================================
 * Étape 4 : Sauvegarde du message assistant
 * ================================
 */
async function saveAssistantMessage(
  context: MessageProcessorContext,
  reply: string
) {
  try {
    const assistantMessage = await messageService.createMessage(context.conversationId, {
      type: 'text',
      direction: 'outbound',
      content: reply,
      status: 'processed',
      metadata: {
        generation: {
          assistantId: context.assistantId,
          tenantId: context.tenantId,
          timestamp: new Date().toISOString(),
        },
        whatsapp: {
          willSendTo: context.message.from.phoneNumber,
        },
      },
    });

    logger.debug('Assistant message saved', {
      messageId: assistantMessage.id,
      conversationId: context.conversationId,
      contentLength: assistantMessage.content.length,
    });

    return assistantMessage;

  } catch (error) {
    logger.error('Error saving assistant message', {
      conversationId: context.conversationId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * ================================
 * Étape 5 : Envoi WhatsApp
 * ================================
 */
async function sendReplyToWhatsApp(
  context: MessageProcessorContext,
  reply: string
): Promise<void> {
  try {
    await sendWhatsAppTextMessage(
      context.message.from.phoneNumber,
      reply,
      {
        metadata: {
          conversationId: context.conversationId,
          assistantId: context.assistantId,
          replyToMessage: context.message.externalId,
        },
        previewUrl: false,
        tenantId: context.tenantId,
        conversationId: context.conversationId,
        replyToMessageId: context.message.externalId,
      }
    );

    logger.info('Reply sent via WhatsApp', {
      to: maskPhoneNumber(context.message.from.phoneNumber),
      conversationId: context.conversationId,
      replyLength: reply.length,
    });

  } catch (error) {
    logger.error('Error sending WhatsApp reply', {
      to: maskPhoneNumber(context.message.from.phoneNumber),
      conversationId: context.conversationId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * ================================
 * Étape 6 : Mise à jour des statistiques
 * ================================
 */
async function updateStats(context: MessageProcessorContext): Promise<void> {
  try {
    // Mettre à jour le lastActiveAt de la conversation
    await conversationService.updateLastMessageTime(context.conversationId);

    // TODO: Incrémenter les compteurs de quotas tenant (messages, AI requests)
    // Sera implémenté dans une prochaine phase

    logger.debug('Stats updated', {
      conversationId: context.conversationId,
      tenantId: context.tenantId,
    });

  } catch (error) {
    logger.warn('Error updating stats (non-critical)', {
      conversationId: context.conversationId,
      tenantId: context.tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Ne pas faire échouer le job pour des erreurs de stats
  }
}