/**
 * ================================
 * Message Processor Worker - Sylion Backend
 * ================================
 * 
 * Worker BullMQ pour traiter les messages WhatsApp entrants.
 * Pipeline : Résolution tenant/channel -> IDEMPOTENCE -> RATE LIMIT -> Conversation -> Message -> QUOTA CHECK -> RAG -> IA -> Réponse
 */

import { db, schema } from '@/db/index';
import { generateAssistantReply } from '@/lib/llm';
import { logger } from '@/lib/logger';
import { QUOTA_EXCEEDED_USER_MESSAGE } from '@/lib/messages/quota';
import { RATE_LIMITED_USER_MESSAGE } from '@/lib/messages/rateLimit';
import { checkIdempotence, checkRateLimit } from '@/lib/rateLimit';
import { assistantService } from '@/modules/assistant/assistant.service';
import { conversationService } from '@/modules/conversation/conversation.service';
import { messageService } from '@/modules/message/message.service';
import { quotaService, type QuotaCheckResult } from '@/modules/quota';
import type { RagContext } from '@/modules/rag';
import { formatContextForPrompt, ragService } from '@/modules/rag';
import { tenantService } from '@/modules/tenant/tenant.service';
import type { NormalizedIncomingMessage } from '@/modules/whatsapp/types';
import { maskPhoneNumber } from '@/modules/whatsapp/types';
import { getWhatsAppProvider, sendWhatsAppMessage } from '@/modules/whatsapp/whatsapp.provider.factory';
import { Job } from 'bullmq';
import { and, eq } from 'drizzle-orm';
import type { JobTypes } from './index';

/**
 * ================================
 * Echo Handler - WhatsApp Process Incoming (MVP)
 * ================================
 * 
 * Handler minimal pour le pipeline echo.
 * Reçoit le job → envoie un echo → termine.
 * Pas de DB, pas d'IA, pas de logique conversationnelle.
 */
export async function processWhatsAppIncoming(
  job: Job<JobTypes['whatsapp:process-incoming']>
): Promise<{ success: boolean; messageId?: string }> {
  const { tenantId, channelId, conversationId, messageId, from, message } = job.data;

  logger.info('[Worker] Processing WhatsApp incoming message (echo mode)', {
    jobId: job.id,
    tenantId,
    channelId,
    conversationId,
    messageId,
    from: maskPhoneNumber(from),
  });

  // Defensive validation
  if (!tenantId || !channelId || !from) {
    logger.error('[Worker] Missing required job data fields', {
      jobId: job.id,
      hasTenantId: !!tenantId,
      hasChannelId: !!channelId,
      hasFrom: !!from,
    });
    throw new Error('Missing required job data: tenantId, channelId, or from');
  }

  if (!message?.content) {
    logger.warn('[Worker] Message content is empty or undefined', {
      jobId: job.id,
      messageId,
    });
  }

  try {
    // Construire le message echo
    const echoText = `Echo: ${message?.content || '[empty message]'}`;

    logger.debug('[Worker] Preparing echo response', {
      jobId: job.id,
      echoTextLength: echoText.length,
    });

    // Envoyer via le provider (mock ou réel selon l'environnement)
    const provider = getWhatsAppProvider();
    const sendResult = await provider.sendTextMessage(from, echoText, {
      tenantId,
      conversationId,
    });

    const providerMessageId = sendResult.messages[0]?.id;

    logger.info('[Worker] Echo message sent successfully', {
      jobId: job.id,
      tenantId,
      channelId,
      conversationId,
      messageId,
      providerMessageId,
    });

    // Persist outbound message in DB
    if (!conversationId) {
      logger.warn('[Worker] No conversationId, skipping outbound message DB insert', {
        jobId: job.id,
        tenantId,
        channelId,
      });
    } else {
      const outboundExternalId = providerMessageId ?? `mock_${Date.now()}`;
      await messageService.createMessage(conversationId, {
        direction: 'outbound',
        type: 'text',
        content: echoText,
        status: 'processed',
        externalId: outboundExternalId,
        externalTimestamp: new Date(),
        metadata: {
          mode: 'echo',
          senderType: 'assistant',
          sourceMessageId: messageId,
          provider: provider.name ?? 'mock',
          tenantId,
          channelId,
        },
      });
      logger.debug('[Worker] Outbound echo message persisted', {
        jobId: job.id,
        conversationId,
        externalId: outboundExternalId,
      });
    }

    return {
      success: true,
      messageId: providerMessageId,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;

    logger.error('[Worker] Echo message processing failed', {
      jobId: job.id,
      tenantId,
      channelId,
      conversationId,
      messageId,
      from: maskPhoneNumber(from),
      error: errorMessage,
      stack: errorStack,
    });

    // Remonter l'erreur pour que BullMQ marque le job en failed
    throw err;
  }
}

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

    // ================================
    // 1.5 IDEMPOTENCE CHECK - Détection des doublons
    // ================================
    const idempotenceResult = await checkIdempotence(
      messageData.providerMessageId,
      context.tenantId
    );

    if (idempotenceResult.isDuplicate) {
      logger.info('[Worker] Duplicate message detected - dropping silently', {
        jobId: job.id,
        providerMessageId: messageData.providerMessageId,
        requestId: job.data.requestId,
        tenantId: context.tenantId,
        conversationId: context.conversationId,
        event: 'duplicate_message_dropped',
      });
      // Pas de traitement, pas de réponse - drop silencieux
      return;
    }

    // ================================
    // 1.6 RATE LIMIT CHECK - Protection anti-abus
    // ================================
    const rateLimitResult = await checkRateLimit(
      context.conversationId,
      messageData.from.phoneNumber,
      context.tenantId
    );

    if (rateLimitResult.isLimited) {
      logger.warn('[Worker] Rate limit exceeded - LLM call blocked', {
        jobId: job.id,
        requestId: job.data.requestId,
        tenantId: context.tenantId,
        channelId: context.channelId,
        conversationId: context.conversationId,
        senderId: maskPhoneNumber(messageData.from.phoneNumber),
        currentCount: rateLimitResult.currentCount,
        limit: rateLimitResult.limit,
        windowSeconds: rateLimitResult.windowSeconds,
        alreadyNotified: rateLimitResult.alreadyNotified,
        event: 'rate_limited',
      });

      // Répondre une seule fois par fenêtre (éviter le spam)
      if (!rateLimitResult.alreadyNotified) {
        // Envoyer le message de rate limit à l'utilisateur
        await sendRateLimitReplyToWhatsApp(messageData, RATE_LIMITED_USER_MESSAGE);
      }

      // Pas de saveUserMessage, pas de LLM, pas de recordUsage
      return;
    }
    // ================================
    
    // 2. Enregistrement du message utilisateur
    const userMessage = await saveUserMessage(context);
    
    // ================================
    // 2.5 QUOTA CHECK - BLOQUANT AVANT LLM
    // ================================
    // First, check if conversation is already marked as quota-blocked (conversational flag)
    const alreadyBlocked = await conversationService.isQuotaBlocked(
      context.conversationId,
      context.tenantId
    );

    if (alreadyBlocked) {
      // Conversation already blocked: skip quota service check, send fallback immediately
      logger.info('[Worker] Conversation already quota-blocked - skipping quota service check', {
        jobId: job.id,
        requestId: job.data.requestId,
        tenantId: context.tenantId,
        conversationId: context.conversationId,
        event: 'quota_blocked_cached',
      });

      // Create fallback message and send
      const fallbackMessage = await saveQuotaExceededMessage(context, {
        allowed: false,
        reason: 'quota_blocked_cached',
        currentUsage: -1, // Unknown, we didn't call quota service
        limit: -1,
      });
      await sendReplyToWhatsApp(context, QUOTA_EXCEEDED_USER_MESSAGE);

      logger.info('[Worker] Quota exceeded message sent (cached block, no quota check)', {
        jobId: job.id,
        requestId: job.data.requestId,
        tenantId: context.tenantId,
        conversationId: context.conversationId,
        fallbackMessageId: fallbackMessage.id,
        event: 'quota_exceeded_handled',
      });

      return;
    }

    // If not already blocked, check with quota service
    const quotaResult = await checkQuotaBeforeLLM(context);
    
    if (!quotaResult.allowed) {
      // Quota dépassé : créer un message fallback SANS appeler le LLM
      logger.warn('[Worker] Quota exceeded - LLM call blocked', {
        jobId: job.id,
        requestId: job.data.requestId,
        tenantId: context.tenantId,
        conversationId: context.conversationId,
        reason: quotaResult.reason,
        currentUsage: quotaResult.currentUsage,
        limit: quotaResult.limit,
        event: 'quota_exceeded',
      });

      // Mark conversation as quota-blocked for subsequent messages
      await conversationService.setQuotaBlocked(
        context.conversationId,
        context.tenantId,
        true
      );

      // Créer le message assistant de fallback
      const fallbackMessage = await saveQuotaExceededMessage(context, quotaResult);
      
      // Envoyer la réponse fallback à l'utilisateur via WhatsApp
      await sendReplyToWhatsApp(context, QUOTA_EXCEEDED_USER_MESSAGE);
      
      logger.info('[Worker] Quota exceeded message sent (no LLM call)', {
        jobId: job.id,
        requestId: job.data.requestId,
        tenantId: context.tenantId,
        conversationId: context.conversationId,
        fallbackMessageId: fallbackMessage.id,
        quotaBlocked: true,
        event: 'quota_exceeded_handled',
      });

      // Terminer le job avec succès (le message a été traité, même sans LLM)
      return;
    }
    // ================================
    
    // 3. Génération de la réponse IA (avec RAG si activé)
    // Structured event: llm_request (only when not blocked by quota/rate-limit/idempotence)
    logger.info('Initiating LLM request for message processing', {
      event: 'llm_request',
      jobId: job.id,
      requestId: job.data.requestId,
      providerMessageId: messageData.providerMessageId,
      conversationId: context.conversationId,
      tenantId: context.tenantId,
      channelId: context.channelId,
      reason: 'normal',
    });

    const llmStartTime = Date.now();
    const { reply: assistantReply, ragContext } = await generateReply(context);
    const llmDurationMs = Date.now() - llmStartTime;

    // Structured event: llm_request_completed (L1 confirmation - only on success)
    logger.info('LLM request completed successfully', {
      event: 'llm_request_completed',
      jobId: job.id,
      requestId: job.data.requestId,
      providerMessageId: messageData.providerMessageId,
      conversationId: context.conversationId,
      tenantId: context.tenantId,
      channelId: context.channelId,
      durationMs: llmDurationMs,
      replyLength: assistantReply.length,
      ragUsed: !!ragContext,
    });
    
    // 4. Enregistrement du message assistant (avec info RAG)
    const assistantMessage = await saveAssistantMessage(context, assistantReply, ragContext);
    
    // 5. Envoi de la réponse WhatsApp
    await sendReplyToWhatsApp(context, assistantReply);

    // Structured event: message_sent (AFTER persistence + send - Invariant L4)
    // Note: context.message.from is the inbound sender, but for the outbound reply,
    // this becomes the recipient (to), and channelPhoneNumber is the bot phone (botPhone).
    logger.info('Reply sent and persisted successfully', {
      event: 'message_sent',
      direction: 'outbound',
      jobId: job.id,
      requestId: job.data.requestId,
      providerMessageId: messageData.externalId,
      conversationId: context.conversationId,
      tenantId: context.tenantId,
      channelId: context.channelId,
      messageId: assistantMessage.id,
      botPhone: maskPhoneNumber(context.message.channelPhoneNumber),
      to: maskPhoneNumber(context.message.from.phoneNumber),
      replyLength: assistantReply.length,
    });
    
    // 6. Mise à jour des statistiques
    await updateStats(context);

    logger.info('Message processing completed successfully', {
      jobId: job.id,
      messageId: messageData.externalId,
      userMessageId: userMessage.id,
      assistantMessageId: assistantMessage.id,
      replyLength: assistantReply.length,
      ragUsed: !!ragContext,
      ragChunksUsed: ragContext?.chunks.length || 0,
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
  const normalize = (value: unknown): string =>
    typeof value === 'string' ? value.trim() : '';

  const normalizedInput = normalize(phoneNumber);

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

    for (const channel of channels) {
      const config = channel.config as any;
      const candidates = [
        (channel as any).whatsappPhoneNumber,
        (channel as any).whatsapp_phone_number,
        config?.phoneNumber,
        config?.businessPhoneNumber,
      ];

      for (const candidate of candidates) {
        if (normalize(candidate) === normalizedInput) {
          return channel;
        }
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
      const assistant = await assistantService.getAssistantById(conversationAssistantId, tenantId);
      if (assistant && assistant.isActive) {
        return assistant;
      }
    }

    // Priorité 2 : Assistant par défaut du channel
    if (channelAssistantId) {
      const assistant = await assistantService.getAssistantById(channelAssistantId, tenantId);
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
 * Étape 3 : Génération de la réponse IA (avec RAG)
 * ================================
 */
async function generateReply(context: MessageProcessorContext): Promise<{
  reply: string;
  ragContext: RagContext | null;
}> {
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

    // ================================
    // RAG : Récupération du contexte documentaire
    // ================================
    let ragContext: RagContext | null = null;
    let ragContextText: string | undefined;

    // Récupérer la configuration de l'assistant
    const assistant = await assistantService.getAssistantById(context.assistantId, context.tenantId);
    
    if (assistant?.enableRag) {
      logger.info('RAG enabled for assistant, searching relevant context', {
        conversationId: context.conversationId,
        assistantId: context.assistantId,
        ragThreshold: assistant.ragThreshold,
        ragMaxResults: assistant.ragMaxResults,
      });

      // Récupérer le contexte RAG
      ragContext = await ragService.getRelevantContext(
        context.tenantId,
        context.assistantId,
        context.message.text || '',
        {
          enabled: true,
          threshold: parseFloat(String(assistant.ragThreshold || '0.7')),
          maxResults: assistant.ragMaxResults || 5,
        }
      );

      if (ragContext && ragContext.chunks.length > 0) {
        ragContextText = formatContextForPrompt(ragContext, {
          includeDocumentName: true,
          includeScore: false,
          format: 'simple',
        });

        logger.info('RAG context found and formatted', {
          conversationId: context.conversationId,
          chunksUsed: ragContext.chunks.length,
          documentsUsed: ragContext.documentsUsed.length,
          totalTokens: ragContext.totalTokens,
        });
      } else {
        logger.debug('No relevant RAG context found', {
          conversationId: context.conversationId,
          assistantId: context.assistantId,
        });
      }
    }

    // Générer la réponse avec contexte RAG si disponible
    const reply = await generateAssistantReply({
      tenantId: context.tenantId,
      assistantId: context.assistantId,
      messages,
      ragContext: ragContextText,
    });

    logger.debug('Assistant reply generated', {
      conversationId: context.conversationId,
      assistantId: context.assistantId,
      replyLength: reply.length,
      contextMessages: messages.length,
      ragUsed: !!ragContext,
    });

    return { reply, ragContext };

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
 * Étape 4 : Sauvegarde du message assistant (avec info RAG)
 * ================================
 */
async function saveAssistantMessage(
  context: MessageProcessorContext,
  reply: string,
  ragContext: RagContext | null
) {
  try {
    // Préparer les résultats RAG si disponibles
    const ragResults = ragContext ? {
      chunksUsed: ragContext.chunks.map(chunk => ({
        chunkId: chunk.chunkId,
        documentId: chunk.documentId,
        documentName: chunk.documentName,
        score: chunk.score,
        tokenCount: chunk.tokenCount,
      })),
      documentsUsed: ragContext.documentsUsed,
      totalTokens: ragContext.totalTokens,
      searchQuery: ragContext.searchQuery,
    } : null;

    const assistantMessage = await messageService.createMessage(context.conversationId, {
      type: 'text',
      direction: 'outbound',
      content: reply,
      status: 'processed',
      ragUsed: !!ragContext,
      ragResults: ragResults,
      metadata: {
        generation: {
          assistantId: context.assistantId,
          tenantId: context.tenantId,
          timestamp: new Date().toISOString(),
          ragEnabled: !!ragContext,
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
      ragUsed: !!ragContext,
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
    await sendWhatsAppMessage(
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

    logger.debug('WhatsApp message sent to provider', {
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
    await conversationService.updateLastMessageTime(context.conversationId, context.tenantId);

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

/**
 * ================================
 * Quota Check BEFORE LLM
 * ================================
 * BLOCKING: If quota exhausted, LLM is NOT called
 */
async function checkQuotaBeforeLLM(context: MessageProcessorContext): Promise<QuotaCheckResult> {
  try {
    const result = await quotaService.checkQuota(context.tenantId, 'message');
    
    logger.debug('Quota check result', {
      tenantId: context.tenantId,
      conversationId: context.conversationId,
      allowed: result.allowed,
      currentUsage: result.currentUsage,
      limit: result.limit,
      reason: result.reason,
    });

    return result;
  } catch (error) {
    logger.error('Error checking quota (failing safe: blocking)', {
      tenantId: context.tenantId,
      conversationId: context.conversationId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Fail-safe: block if quota check fails
    return {
      allowed: false,
      reason: 'quota_check_error',
      currentUsage: 0,
      limit: 0,
    };
  }
}

/**
 * ================================
 * Save Quota Exceeded Fallback Message
 * ================================
 * Saves the fallback message as an outbound message without calling LLM
 */
async function saveQuotaExceededMessage(
  context: MessageProcessorContext,
  quotaResult: QuotaCheckResult
) {
  try {
    const message = await messageService.createMessage(context.conversationId, {
      type: 'text',
      direction: 'outbound',
      content: QUOTA_EXCEEDED_USER_MESSAGE,
      status: 'processed',
      metadata: {
        quotaExceeded: true,
        quotaReason: quotaResult.reason,
        currentUsage: quotaResult.currentUsage,
        limit: quotaResult.limit,
        llmSkipped: true,
      },
    });

    logger.info('Quota exceeded fallback message saved', {
      messageId: message.id,
      tenantId: context.tenantId,
      conversationId: context.conversationId,
      reason: quotaResult.reason,
      currentUsage: quotaResult.currentUsage,
      limit: quotaResult.limit,
    });

    return message;
  } catch (error) {
    logger.error('Error saving quota exceeded message', {
      tenantId: context.tenantId,
      conversationId: context.conversationId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * ================================
 * Send Rate Limit Reply to WhatsApp
 * ================================
 * Sends rate limit message without requiring full context
 * (used early in pipeline before message is saved)
 */
async function sendRateLimitReplyToWhatsApp(
  messageData: NormalizedIncomingMessage,
  reply: string
): Promise<void> {
  try {
    await sendWhatsAppMessage(
      messageData.from.phoneNumber,
      reply,
      {
        metadata: {
          rateLimited: true,
          replyToMessage: messageData.externalId,
        },
        previewUrl: false,
        replyToMessageId: messageData.externalId,
      }
    );

    logger.info('Rate limit reply sent via WhatsApp', {
      to: maskPhoneNumber(messageData.from.phoneNumber),
      replyLength: reply.length,
      event: 'rate_limit_reply_sent',
    });

  } catch (error) {
    logger.error('Error sending rate limit WhatsApp reply', {
      to: maskPhoneNumber(messageData.from.phoneNumber),
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't throw - rate limit reply is best-effort
  }
}