/**
 * ================================
 * WhatsApp Service - Sylion Backend (Boss 1)
 * ================================
 *
 * Service métier pour le traitement des messages WhatsApp.
 * Résolution tenant/channel/conversation + enqueue jobs.
 */

import { schema, withTransaction } from '@/db/index';
import type { Conversation } from '@/db/schema';
import { addJob } from '@/jobs/index';
import { ErrorCodes, SylionError } from '@/lib/http';
import { logger } from '@/lib/logger';
import { and, desc, eq } from 'drizzle-orm';
import type { NormalizedIncomingMessage } from './types';

/**
 * Résultat du traitement d'un message WhatsApp entrant
 */
export interface HandleIncomingWhatsAppResult {
  tenantId: string;
  channelId: string;
  conversationId: string;
  messageId: string;
}

/**
 * Traiter un message WhatsApp entrant complet
 * 1. Résoudre le channel par toPhone
 * 2. Extraire tenantId depuis le channel
 * 3. Trouver ou créer la conversation
 * 4. Créer le message utilisateur
 *
 * @param normalized - Message normalisé depuis le gateway
 * @returns Résultat avec les IDs créés/trouvés
 */
export async function handleIncomingWhatsAppMessage(
  normalized: NormalizedIncomingMessage,
): Promise<HandleIncomingWhatsAppResult> {
  logger.info('Handling incoming WhatsApp message', {
    provider: normalized.provider,
    providerMessageId: normalized.providerMessageId,
    toPhone: normalized.toPhone,
    fromPhone: normalized.fromPhone.substring(0, 8) + '***',
  });

  return await withTransaction(async (tx) => {
    // 1. Résoudre le channel par toPhone et type = 'whatsapp'
    const channelResults = await tx
      .select()
      .from(schema.channels)
      .where(
        and(
          eq(schema.channels.whatsappPhoneNumber, normalized.toPhone),
          eq(schema.channels.type, 'whatsapp'),
          eq(schema.channels.isActive, true),
        ),
      )
      .limit(1);

    if (channelResults.length === 0) {
      logger.warn('No active WhatsApp channel found for toPhone', {
        toPhone: normalized.toPhone,
        provider: normalized.provider,
      });

      throw new SylionError(
        ErrorCodes.CHANNEL_NOT_FOUND,
        'Aucun canal WhatsApp actif trouvé pour ce numéro',
        {
          details: { toPhone: normalized.toPhone, provider: normalized.provider },
        },
      );
    }

    const channel = channelResults[0]!;
    const tenantId = channel.tenantId;

    logger.debug('Channel resolved', {
      channelId: channel.id,
      tenantId,
      channelName: channel.name,
    });

    // 2. Trouver une conversation existante ouverte pour ce tenant/channel/user
    const existingConversationResults = await tx
      .select()
      .from(schema.conversations)
      .where(
        and(
          eq(schema.conversations.tenantId, tenantId),
          eq(schema.conversations.channelId, channel.id),
          eq(schema.conversations.userIdentifier, normalized.fromPhone),
          eq(schema.conversations.status, 'active'),
        ),
      )
      .orderBy(desc(schema.conversations.lastMessageAt))
      .limit(1);

    let conversation: Conversation | undefined;

    if (existingConversationResults.length > 0) {
      conversation = existingConversationResults[0]!;
      logger.debug('Existing conversation found', {
        conversationId: conversation.id,
        userIdentifier: conversation.userIdentifier,
      });
    } else {
      logger.debug('Creating new conversation', {
        tenantId,
        channelId: channel.id,
        userIdentifier: normalized.fromPhone,
      });

      // Trouver l'assistant par défaut du tenant
      const assistantResults = await tx
        .select()
        .from(schema.assistants)
        .where(
          and(
            eq(schema.assistants.tenantId, tenantId),
            eq(schema.assistants.isActive, true),
            eq(schema.assistants.isDefault, true),
          ),
        )
        .limit(1);

      if (assistantResults.length === 0) {
        throw new SylionError(
          ErrorCodes.ASSISTANT_NOT_FOUND,
          'Aucun assistant par défaut trouvé pour ce tenant',
          { details: { tenantId } },
        );
      }

      const assistant = assistantResults[0]!;

      // Créer la conversation
      const newConversationResults = await tx
        .insert(schema.conversations)
        .values({
          tenantId,
          channelId: channel.id,
          assistantId: assistant.id,
          userIdentifier: normalized.fromPhone,
          userName: undefined,
          userMetadata: {},
          status: 'active',
          title: `WhatsApp - ${normalized.fromPhone}`,
        })
        .returning();

      conversation = newConversationResults[0];

      if (!conversation) {
        throw new SylionError(
          ErrorCodes.INTERNAL_SERVER_ERROR,
          'Erreur lors de la création de la conversation',
        );
      }

      logger.info('New conversation created', {
        conversationId: conversation.id,
        tenantId,
        assistantId: assistant.id,
      });
    }

    const conversationId = conversation!.id;

    // 3. Créer le message utilisateur
    const messageResults = await tx
      .insert(schema.messages)
      .values({
        conversationId,
        type: 'text',
        direction: 'inbound',
        content: normalized.text,
        metadata: {
          provider: normalized.provider,
          providerMessageId: normalized.providerMessageId,
          fromPhone: normalized.fromPhone,
          toPhone: normalized.toPhone,
          timestamp: normalized.timestamp.toISOString(),
        },
        externalId: normalized.providerMessageId,
        externalTimestamp: normalized.timestamp,
        status: 'processed',
      })
      .returning();

    const message = messageResults[0];

    if (!message) {
      throw new SylionError(
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Erreur lors de la création du message',
      );
    }

    // 4. Mettre à jour la conversation avec le nouveau message
    await tx
      .update(schema.conversations)
      .set({
        lastMessageAt: normalized.timestamp,
        updatedAt: new Date(),
        messageCount: (conversation!.messageCount ?? 0) + 1,
      })
      .where(eq(schema.conversations.id, conversationId));

    logger.info('WhatsApp message processed successfully', {
      messageId: message.id,
      conversationId,
      tenantId,
      channelId: channel.id,
    });

    return {
      tenantId,
      channelId: channel.id,
      conversationId,
      messageId: message.id,
    };
  });
}

/**
 * Enqueue job pour traitement IA du message WhatsApp
 *
 * @param normalized - Message normalisé depuis le gateway
 * @param coreResult - Résultat du traitement core (tenant, channel, conversation, message)
 * @param requestId - Optional HTTP request correlation ID (A4)
 */
export async function enqueueIncomingWhatsAppJob(
  normalized: NormalizedIncomingMessage,
  coreResult: HandleIncomingWhatsAppResult,
  requestId?: string,
): Promise<void> {
  logger.info('Enqueuing WhatsApp message processing job', {
    tenantId: coreResult.tenantId,
    conversationId: coreResult.conversationId,
    messageId: coreResult.messageId,
    provider: normalized.provider,
  });

  try {
    const job = await addJob(
      'whatsapp:process-incoming',
      {
        tenantId: coreResult.tenantId,
        channelId: coreResult.channelId,
        conversationId: coreResult.conversationId,
        messageId: coreResult.messageId,
        from: normalized.fromPhone,
        message: {
          type: 'text',
          content: normalized.text,
        },
        timestamp: normalized.timestamp.toISOString(),
        providerMessageId: normalized.providerMessageId,
        requestId,
      },
      {
        priority: 10,
        attempts: 3,
      },
    );

    // Structured event: job_added (with jobId for A4 correlation)
    logger.info('WhatsApp processing job enqueued successfully', {
      event: 'job_added',
      queue: 'whatsapp:process-incoming',
      jobId: job.id,
      tenantId: coreResult.tenantId,
      channelId: coreResult.channelId,
      conversationId: coreResult.conversationId,
      messageId: coreResult.messageId,
      providerMessageId: normalized.providerMessageId,
      requestId,
    });
  } catch (error) {
    logger.error('Failed to enqueue WhatsApp processing job', {
      error: error instanceof Error ? error.message : String(error),
      tenantId: coreResult.tenantId,
      conversationId: coreResult.conversationId,
      messageId: coreResult.messageId,
    });

    throw new SylionError(
      ErrorCodes.INTERNAL_SERVER_ERROR,
      "Échec de l'enqueue du job de traitement",
      {
        details: {
          originalError: error instanceof Error ? error.message : String(error),
          tenantId: coreResult.tenantId,
          messageId: coreResult.messageId,
        },
      },
    );
  }
}
