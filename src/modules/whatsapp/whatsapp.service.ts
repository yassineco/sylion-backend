/**
 * ================================
 * WhatsApp Service - Sylion Backend  
 * ================================
 * 
 * Service pour le vertical slice WhatsApp.
 * Gère le flow complet : webhook → conversation → assistant → réponse.
 */

import type { LLMMessage } from '@/lib/llm';
import { llmClient } from '@/lib/llm';
import { logger } from '@/lib/logger';

/**
 * ================================
 * Types du service
 * ================================
 */

interface WebhookPayload {
  from: string;
  to: string;
  text: string;
  timestamp?: string;
}

interface MessageEnvelope {
  from: string;
  to: string;
  text: string;
  timestamp: Date;
  messageId: string;
}

interface OutgoingMessage {
  to: string;
  text: {
    body: string;
  };
  timestamp: string;
}

interface ProcessingResult {
  status: string;
  processingTime: number;
  webhook: {
    from: string;
    to: string;
    receivedText: string;
  };
  conversation: {
    id?: string;
    isNew?: boolean;
    channel?: string;
    direction?: string;
    from?: string;
    to?: string;
    demo?: boolean;
  };
  assistant: {
    id: string;
    name: string;
    mode?: string;
  };
  outgoingMessage: OutgoingMessage;
}

/**
 * ================================
 * Service principal
 * ================================
 */

export class WhatsAppService {
  
  /**
   * Traiter un webhook WhatsApp entrant
   */
  async handleIncomingWebhook(rawPayload: WebhookPayload): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      // 1. Parser et normaliser le payload
      const messageEnvelope = this.parseProviderPayload(rawPayload);
      
      // 2. Résoudre tenant et channel
      const { tenantId, channelId } = await this.resolveTenantAndChannel(messageEnvelope.to);
      
      // 3. Traiter le message via conversation service
      const result = await this.processIncomingMessage(tenantId, channelId, messageEnvelope);
      
      // 4. Construire la réponse WhatsApp
      const outgoingMessage = this.buildOutgoingWhatsAppMessage(messageEnvelope.from, result.assistantReply);
      
      const processingTime = Date.now() - startTime;
      
      logger.info('WhatsApp webhook processed successfully', {
        from: messageEnvelope.from,
        to: messageEnvelope.to,
        tenantId,
        channelId,
        conversationId: result.conversation.id,
        assistantId: result.assistant.id,
        processingTime,
      });
      
      return {
        status: 'processed',
        processingTime,
        webhook: {
          from: messageEnvelope.from,
          to: messageEnvelope.to,
          receivedText: messageEnvelope.text,
        },
        conversation: {
          channel: 'whatsapp',
          direction: 'inbound',
          from: messageEnvelope.from,
          to: messageEnvelope.to,
          demo: true,
        },
        assistant: {
          id: 'demo-whatsapp-assistant',
          name: 'SYLION Assistant – Démo WhatsApp',
          mode: 'demo',
        },
        outgoingMessage: {
          to: messageEnvelope.from,
          timestamp: new Date().toISOString(),
          text: {
            body: result.assistantReply,
          },
        },
      };
      
    } catch (error) {
      logger.error('Error processing WhatsApp webhook', {
        error: error instanceof Error ? error.message : String(error),
        from: rawPayload.from,
        to: rawPayload.to,
        processingTime: Date.now() - startTime,
      });
      throw error;
    }
  }
  
  /**
   * Parser le payload du provider en format normalisé
   */
  private parseProviderPayload(rawPayload: WebhookPayload): MessageEnvelope {
    return {
      from: rawPayload.from,
      to: rawPayload.to,
      text: rawPayload.text,
      timestamp: new Date(rawPayload.timestamp || Date.now()),
      messageId: `wamid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }
  
  /**
   * Résoudre le tenant et channel à partir du numéro WhatsApp
   */
  private async resolveTenantAndChannel(phoneNumber: string): Promise<{
    tenantId: string;
    channelId: string;
  }> {
    // Pour le vertical slice, on hardcode un tenant demo
    // En production, on ferait une requête DB sur les channels
    
    const DEMO_TENANT_ID = 'demo-tenant-uuid';
    const DEMO_CHANNEL_ID = 'demo-channel-uuid';
    
    logger.debug('Resolved tenant and channel', {
      phoneNumber,
      tenantId: DEMO_TENANT_ID,
      channelId: DEMO_CHANNEL_ID,
      note: 'Hardcoded for vertical slice',
    });
    
    return {
      tenantId: DEMO_TENANT_ID,
      channelId: DEMO_CHANNEL_ID,
    };
  }
  
  /**
   * Traiter le message entrant via les services de conversation
   */
  private async processIncomingMessage(
    tenantId: string,
    channelId: string,
    messageEnvelope: MessageEnvelope
  ): Promise<{
    conversation: { id: string; userIdentifier: string };
    assistant: { id: string; name: string };
    userMessage: { id: string; content: string };
    assistantReply: string;
    isNewConversation: boolean;
  }> {
    
    // 1. Obtenir ou créer la conversation
    // Pour le slice, on mock la conversation
    const mockConversation = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      userIdentifier: messageEnvelope.from,
    };
    
    // 2. Obtenir l'assistant (mock)
    const mockAssistant = {
      id: `asst_demo_${tenantId}`,
      name: 'SYLION Assistant – Démo Officielle',
    };
    
    // 3. Enregistrer le message utilisateur (mock)
    const mockUserMessage = {
      id: `msg_user_${Date.now()}`,
      content: messageEnvelope.text,
    };
    
    // 4. Générer la réponse de l'assistant
    const assistantReply = await this.generateAssistantReply(
      mockAssistant,
      messageEnvelope.text
    );
    
    return {
      conversation: mockConversation,
      assistant: mockAssistant,
      userMessage: mockUserMessage,
      assistantReply,
      isNewConversation: true, // Pour le slice, toujours nouvelle
    };
  }
  
  /**
   * Générer une réponse d'assistant
   */
  private async generateAssistantReply(
    assistant: { id: string; name: string },
    userMessage: string
  ): Promise<string> {
    
    // Préparer les messages pour l'IA
    const messages: LLMMessage[] = [
      {
        role: 'user',
        content: userMessage,
      },
    ];
    
    // Appeler le client LLM mock
    const result = await llmClient.generate({
      assistantId: assistant.id,
      messages,
    });
    
    return result.text;
  }
  
  /**
   * Construire le message sortant pour WhatsApp
   */
  private buildOutgoingWhatsAppMessage(to: string, text: string): OutgoingMessage {
    return {
      to,
      text: {
        body: text,
      },
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Instance singleton du service
 */
export const whatsappService = new WhatsAppService();