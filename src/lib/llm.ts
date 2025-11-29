/**
 * ================================
 * LLM Service - Sylion Backend
 * ================================
 * 
 * Service stub pour la génération de réponses IA.
 * À remplacer par Vertex AI dans une prochaine phase.
 */

import { logger } from '@/lib/logger';
import { assistantService } from '@/modules/assistant/assistant.service';

/**
 * ================================
 * Interface du service LLM
 * ================================
 */

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface GenerateReplyOptions {
  tenantId: string;
  assistantId: string;
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface LLMResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  timestamp: string;
}

/**
 * ================================
 * Service LLM Stub
 * ================================
 */

/**
 * Générer une réponse d'assistant IA (version stub)
 */
export async function generateAssistantReply(
  options: GenerateReplyOptions
): Promise<string> {
  try {
    logger.info('Generating assistant reply', {
      tenantId: options.tenantId,
      assistantId: options.assistantId,
      messagesCount: options.messages.length,
    });

    // Récupérer la configuration de l'assistant
    const assistant = await assistantService.getAssistantById(options.assistantId);
    if (!assistant) {
      throw new Error(`Assistant not found: ${options.assistantId}`);
    }

    // Analyser le dernier message utilisateur
    const lastUserMessage = options.messages
      .filter(msg => msg.role === 'user')
      .pop();

    if (!lastUserMessage) {
      throw new Error('No user message found in conversation');
    }

    // Génération stub basée sur des règles simples
    const reply = await generateStubReply(lastUserMessage.content, assistant, options);

    logger.info('Assistant reply generated successfully', {
      tenantId: options.tenantId,
      assistantId: options.assistantId,
      userMessageLength: lastUserMessage.content.length,
      replyLength: reply.length,
    });

    return reply;

  } catch (error) {
    logger.error('Error generating assistant reply', {
      tenantId: options.tenantId,
      assistantId: options.assistantId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * ================================
 * Générateur Stub
 * ================================
 */

async function generateStubReply(
  userMessage: string,
  assistant: any,
  options: GenerateReplyOptions
): Promise<string> {
  
  const lowerMessage = userMessage.toLowerCase();

  // Réponses prédéfinies pour certains motifs courants
  const patterns = [
    {
      keywords: ['bonjour', 'salut', 'hello', 'hi', 'bonsoir'],
      responses: [
        `Bonjour ! Je suis ${assistant.name}, votre assistant virtuel. Comment puis-je vous aider aujourd'hui ?`,
        `Salut ! C'est ${assistant.name}. En quoi puis-je vous être utile ?`,
        `Hello ! Je suis là pour vous aider. Que puis-je faire pour vous ?`,
      ]
    },
    {
      keywords: ['au revoir', 'bye', 'à bientôt', 'tchao'],
      responses: [
        'Au revoir ! N\'hésitez pas à revenir si vous avez d\'autres questions.',
        'À bientôt ! J\'espère avoir pu vous aider.',
        'Bonne journée ! Je reste à votre disposition.',
      ]
    },
    {
      keywords: ['merci', 'thank you', 'thanks'],
      responses: [
        'Je vous en prie ! C\'était un plaisir de vous aider.',
        'Avec plaisir ! N\'hésitez pas si vous avez d\'autres questions.',
        'De rien ! Je suis là pour ça.',
      ]
    },
    {
      keywords: ['aide', 'help', 'comment', 'que faire'],
      responses: [
        'Je suis votre assistant virtuel et je peux vous aider avec diverses questions. Pouvez-vous être plus précis sur ce dont vous avez besoin ?',
        'Je suis là pour vous accompagner ! Dites-moi ce que vous cherchez et je ferai de mon mieux pour vous aider.',
        'Bien sûr, je peux vous aider ! Pouvez-vous me dire exactement ce que vous souhaitez savoir ?',
      ]
    },
    {
      keywords: ['prix', 'tarif', 'coût', 'combien'],
      responses: [
        'Pour les informations de tarifs, je vous recommande de contacter notre équipe commerciale qui pourra vous donner tous les détails.',
        'Les tarifs varient selon vos besoins spécifiques. Souhaitez-vous que je vous mette en relation avec un conseiller ?',
        'Je n\'ai pas accès aux tarifs exacts, mais notre équipe peut vous fournir un devis personnalisé.',
      ]
    },
    {
      keywords: ['problème', 'bug', 'erreur', 'ne marche pas'],
      responses: [
        'Je suis désolé d\'apprendre que vous rencontrez un problème. Pouvez-vous me décrire plus précisément ce qui ne fonctionne pas ?',
        'C\'est ennuyeux ! Pourriez-vous me donner plus de détails sur le problème que vous rencontrez ?',
        'Je vais essayer de vous aider. Pouvez-vous me décrire étape par étape ce qui s\'est passé ?',
      ]
    }
  ];

  // Recherche de motifs correspondants
  for (const pattern of patterns) {
    const hasKeyword = pattern.keywords.some(keyword => 
      lowerMessage.includes(keyword)
    );
    
    if (hasKeyword) {
      const randomResponse = pattern.responses[
        Math.floor(Math.random() * pattern.responses.length)
      ];
      return randomResponse || 'Merci pour votre message, je vais vous aider !';
    }
  }

  // Réponses par défaut basées sur la longueur du message
  if (userMessage.length > 200) {
    return 'Merci pour votre message détaillé. J\'ai bien pris note de vos informations. Un membre de notre équipe reviendra vers vous avec une réponse complète sous peu.';
  }

  if (userMessage.length < 10) {
    return 'Pourriez-vous me donner un peu plus de détails ? Je suis là pour vous aider de mon mieux !';
  }

  // Réponse générique intelligente
  const genericResponses = [
    'C\'est une excellente question ! Laissez-moi voir comment je peux vous aider avec cela.',
    'Je comprends votre demande. Permettez-moi de vous orienter vers la meilleure solution.',
    'Merci pour votre question. Je vais faire de mon mieux pour vous donner une réponse utile.',
    'Intéressant ! Pouvez-vous me donner un peu plus de contexte pour que je puisse mieux vous aider ?',
    'Je prends note de votre demande. Voici ce que je peux vous dire à ce sujet...',
  ];

  const randomGeneric = genericResponses[
    Math.floor(Math.random() * genericResponses.length)
  ];

  // Ajouter une note sur le fait que c'est un assistant en développement
  const devNote = '\n\n💡 *Note: Je suis encore en développement et mes capacités s\'amélioreront bientôt avec l\'IA avancée !*';
  
  return randomGeneric + devNote;
}

/**
 * ================================
 * Fonctions utilitaires
 * ================================
 */

/**
 * Valider la configuration de l'assistant pour l'IA
 */
export async function validateAssistantForLLM(assistantId: string): Promise<boolean> {
  try {
    const assistant = await assistantService.getAssistantById(assistantId);
    
    if (!assistant || !assistant.isActive) {
      return false;
    }

    // Vérifications spécifiques pour l'IA
    const config = assistant;
    
    if (!config.systemPrompt || config.systemPrompt.length < 10) {
      logger.warn('Assistant has insufficient system prompt', { assistantId });
      // Ne pas faire échouer, utiliser un prompt par défaut
    }

    const temperature = typeof config.temperature === 'string' 
      ? parseFloat(config.temperature) 
      : config.temperature;
      
    if (temperature && (temperature < 0 || temperature > 2)) {
      logger.warn('Assistant has invalid temperature setting', { 
        assistantId, 
        temperature: config.temperature 
      });
    }

    return true;

  } catch (error) {
    logger.error('Error validating assistant for LLM', {
      assistantId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Obtenir les métriques d'utilisation LLM (stub)
 */
export async function getLLMUsageStats(tenantId: string): Promise<{
  requestsToday: number;
  tokensUsedToday: number;
  averageResponseTime: number;
}> {
  // TODO: Implémenter les vraies métriques avec Redis ou DB
  return {
    requestsToday: Math.floor(Math.random() * 100),
    tokensUsedToday: Math.floor(Math.random() * 10000),
    averageResponseTime: Math.floor(Math.random() * 2000) + 500, // 500-2500ms
  };
}

/**
 * Préparation pour l'intégration future Vertex AI
 */
export interface VertexAIConfig {
  projectId: string;
  location: string;
  model: string;
  maxTokens: number;
  temperature: number;
  topK?: number;
  topP?: number;
}

/**
 * Stub pour la future intégration Vertex AI
 */
export async function generateWithVertexAI(
  config: VertexAIConfig,
  messages: LLMMessage[]
): Promise<LLMResponse> {
  // TODO: Implémenter l'appel réel à Vertex AI
  throw new Error('Vertex AI integration not implemented yet. Use generateAssistantReply() for now.');
}

/**
 * Fonction de migration pour passer du stub vers Vertex AI
 */
export async function migrateToVertexAI(): Promise<void> {
  logger.info('Vertex AI migration not yet implemented. Current: stub mode.');
  // TODO: Logique de migration progressive stub -> Vertex AI
}