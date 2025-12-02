/**
 * ================================
 * LLM Service - Sylion Backend
 * ================================
 * 
 * Service implémentant le prompt système SYLION Assistant.
 * Assistant IA professionnel pour entreprises marocaines via WhatsApp.
 * À migrer vers Vertex AI dans une prochaine phase.
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
  /** Contexte RAG à injecter dans le prompt (optionnel) */
  ragContext?: string;
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
 * Client LLM Mock pour vertical slice
 * ================================
 */

interface MockGenerateOptions {
  assistantId: string;
  messages: LLMMessage[];
}

interface MockGenerateResult {
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
}

class LLMClient {
  
  /**
   * Génération mock pour le vertical slice
   */
  async generate(options: MockGenerateOptions): Promise<MockGenerateResult> {
    const userMessage = options.messages
      .filter(msg => msg.role === 'user')
      .pop()?.content || '';
    
    // Simulation d'un délai réaliste
    await this.simulateProcessingTime();
    
    // Génération de réponse mock intelligente
    const mockReply = this.generateMockReply(userMessage);
    
    logger.info('Mock LLM generation completed', {
      assistantId: options.assistantId,
      userMessageLength: userMessage.length,
      replyLength: mockReply.length,
    });
    
    return {
      text: mockReply,
      usage: {
        promptTokens: Math.floor(userMessage.length / 4), // Approximation
        completionTokens: Math.floor(mockReply.length / 4),
      },
    };
  }
  
  /**
   * Simuler un temps de traitement réaliste
   */
  private async simulateProcessingTime(): Promise<void> {
    const delay = Math.random() * 1000 + 500; // 500-1500ms
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  /**
   * Générer une réponse mock intelligente
   */
  private generateMockReply(userMessage: string): string {
    const lowerMsg = userMessage.toLowerCase();
    
    // Détection basique de patterns pour des réponses contextuelles
    if (lowerMsg.includes('bonjour') || lowerMsg.includes('salut') || lowerMsg.includes('salam')) {
      return `MOCK: Bonjour ! Vous avez dit "${userMessage}". Je suis l'assistant SYLION en mode démo. Comment puis-je vous aider ?`;
    }
    
    if (lowerMsg.includes('inscription') || lowerMsg.includes('école')) {
      return `MOCK: Concernant l'inscription (vous avez dit "${userMessage}"), je peux vous aider avec les niveaux disponibles et les frais. Quel âge a votre enfant ?`;
    }
    
    if (lowerMsg.includes('rendez-vous') || lowerMsg.includes('rdv')) {
      return `MOCK: Pour le rendez-vous (message: "${userMessage}"), quelle heure vous convient le mieux ? Je peux vérifier les disponibilités.`;
    }
    
    if (lowerMsg.includes('prix') || lowerMsg.includes('tarif')) {
      return `MOCK: Pour les tarifs (votre question: "${userMessage}"), je vous mets en relation avec notre équipe commerciale qui vous donnera tous les détails.`;
    }
    
    // Réponse générique
    return `MOCK: Merci pour votre message "${userMessage}". Je suis l'assistant SYLION en mode démonstration. Cette réponse est générée automatiquement pour tester le système.`;
  }
}

/**
 * Instance du client LLM
 */
export const llmClient = new LLMClient();

/**
 * ================================
 * Service LLM Stub (existant)
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
      hasRagContext: !!options.ragContext,
    });

    // Récupérer la configuration de l'assistant
    const assistant = await assistantService.getAssistantById(options.assistantId, options.tenantId);
    if (!assistant) {
      throw new Error(`Assistant not found: ${options.assistantId}`);
    }

    // Importer le prompt par défaut
    const { getDefaultSystemPrompt } = await import('@/lib/sylion-default-prompt');
    
    // S'assurer qu'il y a un prompt système (utiliser le défaut si nécessaire)
    let systemPrompt = assistant.systemPrompt && assistant.systemPrompt.length >= 10 
      ? assistant.systemPrompt 
      : getDefaultSystemPrompt();

    // ================================
    // INJECTION DU CONTEXTE RAG
    // ================================
    if (options.ragContext) {
      const ragSection = `
## Contexte Documentaire (RAG)

Les informations suivantes proviennent de la base documentaire du client.
Utilisez-les pour répondre de manière précise et factuelle.
Si la question de l'utilisateur correspond à ce contexte, basez votre réponse dessus.
Si la question ne correspond pas au contexte, répondez normalement sans mentionner ces documents.

---
${options.ragContext}
---

`;
      // Injecter le contexte RAG au début du prompt système
      systemPrompt = ragSection + systemPrompt;
      
      logger.debug('RAG context injected into system prompt', {
        ragContextLength: options.ragContext.length,
        totalPromptLength: systemPrompt.length,
      });
    }

    const assistantConfig = {
      ...assistant,
      systemPrompt
    };

    // Analyser le dernier message utilisateur
    const lastUserMessage = options.messages
      .filter(msg => msg.role === 'user')
      .pop();

    if (!lastUserMessage) {
      throw new Error('No user message found in conversation');
    }

    // Génération stub basée sur des règles simples
    const reply = await generateStubReply(lastUserMessage.content, assistantConfig, options);

    logger.info('Assistant reply generated successfully', {
      tenantId: options.tenantId,
      assistantId: options.assistantId,
      userMessageLength: lastUserMessage.content.length,
      replyLength: reply.length,
      ragUsed: !!options.ragContext,
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
  assistant: { name: string; systemPrompt?: string; temperature?: string | number },
  options: GenerateReplyOptions
): Promise<string> {
  
  const lowerMessage = userMessage.toLowerCase();
  
  // ================================
  // SYLION ASSISTANT BEHAVIOR
  // ================================
  
  // Détecter la langue du message
  const language = detectLanguage(userMessage);
  
  // Détecter le secteur d'activité si mentionné
  const businessSector = detectBusinessSector(userMessage);
  
  // Détecter l'intention du message
  const intent = detectIntent(userMessage);
  
  // ================================
  // Réponses selon l'intention détectée
  // ================================
  
  switch (intent) {
    case 'greeting':
      return generateGreetingResponse(language, assistant.name);
      
    case 'goodbye':
      return generateGoodbyeResponse(language);
      
    case 'demo_inquiry':
      return generateDemoResponse(language, businessSector);
      
    case 'business_information':
      return generateBusinessInfoResponse(language, businessSector, userMessage);
      
    case 'appointment_request':
      return generateAppointmentResponse(language, businessSector);
      
    case 'pricing_inquiry':
      return generatePricingResponse(language);
      
    case 'help_request':
      return generateHelpResponse(language, assistant.name);
      
    case 'thank_you':
      return generateThankYouResponse(language);
      
    case 'problem_report':
      return generateProblemResponse(language);
      
    case 'contact_info_request':
      return generateContactInfoRequest(language, businessSector);
      
    default:
      return generateContextualResponse(userMessage, language, businessSector, assistant.name);
  }
}

/**
 * ================================
 * Fonctions de détection
 * ================================
 */

function detectLanguage(message: string): 'fr' | 'ar' | 'darija' | 'en' {
  const lowerMsg = message.toLowerCase();
  
  // Détection basique de la langue
  if (lowerMsg.includes('hello') || lowerMsg.includes('hi') || lowerMsg.includes('thank you')) {
    return 'en';
  }
  
  // Mots en darija
  if (lowerMsg.includes('salam') || lowerMsg.includes('wakha') || lowerMsg.includes('mezyan') || 
      lowerMsg.includes('fin') || lowerMsg.includes('kifash') || lowerMsg.includes('chkoun')) {
    return 'darija';
  }
  
  // Mots en arabe
  if (lowerMsg.includes('السلام') || lowerMsg.includes('شكرا') || lowerMsg.includes('مرحبا') || 
      lowerMsg.includes('كيف') || lowerMsg.includes('ماذا')) {
    return 'ar';
  }
  
  // Par défaut français
  return 'fr';
}

function detectBusinessSector(message: string): string | null {
  const lowerMsg = message.toLowerCase();
  
  // Secteur éducation
  if (lowerMsg.includes('école') || lowerMsg.includes('étudiant') || lowerMsg.includes('inscription') ||
      lowerMsg.includes('cours') || lowerMsg.includes('programme') || lowerMsg.includes('élève') ||
      lowerMsg.includes('enseignement') || lowerMsg.includes('formation')) {
    return 'education';
  }
  
  // Secteur santé
  if (lowerMsg.includes('médecin') || lowerMsg.includes('docteur') || lowerMsg.includes('clinique') ||
      lowerMsg.includes('hôpital') || lowerMsg.includes('consultation') || lowerMsg.includes('rendez-vous médical') ||
      lowerMsg.includes('spécialiste') || lowerMsg.includes('urgence')) {
    return 'healthcare';
  }
  
  // Secteur restauration
  if (lowerMsg.includes('restaurant') || lowerMsg.includes('menu') || lowerMsg.includes('réservation') ||
      lowerMsg.includes('livraison') || lowerMsg.includes('plat') || lowerMsg.includes('cuisine') ||
      lowerMsg.includes('repas') || lowerMsg.includes('commande')) {
    return 'restaurant';
  }
  
  // Secteur immobilier
  if (lowerMsg.includes('appartement') || lowerMsg.includes('maison') || lowerMsg.includes('immobilier') ||
      lowerMsg.includes('location') || lowerMsg.includes('vente') || lowerMsg.includes('visite') ||
      lowerMsg.includes('propriété') || lowerMsg.includes('bien')) {
    return 'real_estate';
  }
  
  // Secteur e-commerce
  if (lowerMsg.includes('commande') || lowerMsg.includes('produit') || lowerMsg.includes('achat') ||
      lowerMsg.includes('paiement') || lowerMsg.includes('livraison') || lowerMsg.includes('retour') ||
      lowerMsg.includes('boutique') || lowerMsg.includes('magasin')) {
    return 'ecommerce';
  }
  
  return null;
}

function detectIntent(message: string): string {
  const lowerMsg = message.toLowerCase();
  
  // Salutations
  if (lowerMsg.includes('bonjour') || lowerMsg.includes('salut') || lowerMsg.includes('hello') ||
      lowerMsg.includes('hi') || lowerMsg.includes('bonsoir') || lowerMsg.includes('salam')) {
    return 'greeting';
  }
  
  // Au revoir
  if (lowerMsg.includes('au revoir') || lowerMsg.includes('bye') || lowerMsg.includes('à bientôt') ||
      lowerMsg.includes('tchao') || lowerMsg.includes('goodbye')) {
    return 'goodbye';
  }
  
  // Demandes sur la démo/système
  if (lowerMsg.includes('comment ça marche') || lowerMsg.includes('c\'est quoi sylion') ||
      lowerMsg.includes('votre rôle') || lowerMsg.includes('que faites-vous') ||
      lowerMsg.includes('comment fonctionne') || lowerMsg.includes('démo')) {
    return 'demo_inquiry';
  }
  
  // Demandes de rendez-vous
  if (lowerMsg.includes('rendez-vous') || lowerMsg.includes('rdv') || lowerMsg.includes('réserver') ||
      lowerMsg.includes('disponibilité') || lowerMsg.includes('prendre rendez-vous') ||
      lowerMsg.includes('consultation') || lowerMsg.includes('visite')) {
    return 'appointment_request';
  }
  
  // Demandes de prix
  if (lowerMsg.includes('prix') || lowerMsg.includes('tarif') || lowerMsg.includes('coût') ||
      lowerMsg.includes('combien') || lowerMsg.includes('frais') || lowerMsg.includes('montant')) {
    return 'pricing_inquiry';
  }
  
  // Demandes d'aide
  if (lowerMsg.includes('aide') || lowerMsg.includes('help') || lowerMsg.includes('comment') ||
      lowerMsg.includes('pouvez-vous') || lowerMsg.includes('besoin d\'aide')) {
    return 'help_request';
  }
  
  // Remerciements
  if (lowerMsg.includes('merci') || lowerMsg.includes('thank you') || lowerMsg.includes('thanks') ||
      lowerMsg.includes('شكرا')) {
    return 'thank_you';
  }
  
  // Problèmes
  if (lowerMsg.includes('problème') || lowerMsg.includes('bug') || lowerMsg.includes('erreur') ||
      lowerMsg.includes('ne marche pas') || lowerMsg.includes('panne')) {
    return 'problem_report';
  }
  
  // Demande d'informations de contact
  if (lowerMsg.includes('inscription') || lowerMsg.includes('contact') || lowerMsg.includes('téléphone') ||
      lowerMsg.includes('email') || lowerMsg.includes('adresse') || lowerMsg.includes('informations')) {
    return 'contact_info_request';
  }
  
  return 'general_inquiry';
}

/**
 * ================================
 * Générateurs de réponses par intention
 * ================================
 */

function generateGreetingResponse(language: string, assistantName: string): string {
  switch (language) {
    case 'darija':
      return `Salam! Ana ${assistantName}, l'assistant dyalek. Kifash ymken naawen?`;
    case 'ar':
      return `السلام عليكم! أنا ${assistantName}، مساعدك الذكي. كيف يمكنني مساعدتك؟`;
    case 'en':
      return `Hello! I'm ${assistantName}, your AI assistant. How can I help you today?`;
    default:
      return `Bonjour 👋 Je suis ${assistantName}, votre assistant intelligent. Comment puis-je vous aider aujourd'hui ?`;
  }
}

function generateGoodbyeResponse(language: string): string {
  switch (language) {
    case 'darija':
      return 'Bslama! Marhba bik dima ila kant 3andek chi su2al.';
    case 'ar':
      return 'مع السلامة! لا تتردد في العودة إذا كان لديك أي سؤال.';
    case 'en':
      return 'Goodbye! Feel free to come back if you have any questions.';
    default:
      return 'Au revoir ! N\'hésitez pas à revenir si vous avez d\'autres questions.';
  }
}

function generateDemoResponse(language: string, businessSector: string | null): string {
  const baseResponse = language === 'darija' ? 
    'Ana assistant dkiya dyal SYLION. Kan3ti aj2oba automatiques 3la WhatsApp, kan inform, o kan akhud les demandes.' :
    language === 'ar' ? 
    'أنا المساعد الذكي لـ SYLION. أقدم إجابات تلقائية على واتساب، أعلم، وآخذ الطلبات.' :
    language === 'en' ?
    'I\'m SYLION\'s intelligent assistant. I provide automatic WhatsApp responses, inform, and take requests.' :
    'Je suis l\'assistant intelligent de SYLION. Je peux répondre automatiquement aux messages WhatsApp, informer, prendre des demandes et utiliser vos documents.';
  
  const question = language === 'darija' ?
    ' Ay no3 dyal entreprise bghiti tsimuli f had demo?' :
    language === 'ar' ?
    ' أي نوع من الشركات تريد محاكاته في هذا العرض التوضيحي؟' :
    language === 'en' ?
    ' What type of business would you like to simulate in this demo?' :
    ' Quel type d\'entreprise souhaitez-vous simuler dans cette démo ?';
  
  return baseResponse + question;
}

function generateBusinessInfoResponse(language: string, businessSector: string | null, userMessage: string): string {
  if (!businessSector) {
    return language === 'darija' ? 
      'Wakha, gul liya 3la ay no3 dyal les informations li bghiti?' :
      language === 'ar' ?
      'حسناً، أخبرني عن نوع المعلومات التي تريدها؟' :
      language === 'en' ?
      'Sure, what kind of information are you looking for?' :
      'Bien sûr, quel type d\'informations recherchez-vous ?';
  }
  
  switch (businessSector) {
    case 'education':
      if (userMessage.includes('inscription') || userMessage.includes('admission') || userMessage.includes('inscrire')) {
        return language === 'darija' ?
          'Mezyan 👍 Wash ymken t9ul liya niveau li bghiti (maternelle, primaire, collège) o 3mer weldek?' :
          language === 'ar' ?
          'ممتاز 👍 هل يمكنك تحديد المستوى المطلوب (روضة، ابتدائي، إعدادي) وعمر طفلك؟' :
          language === 'en' ?
          'Great 👍 Could you specify the desired level (nursery, primary, middle school) and your child\'s age?' :
          'Très bien 👍 Pouvez-vous préciser le niveau souhaité (maternelle, primaire, collège) ainsi que l\'âge de votre enfant ?';
      }
      return 'Je peux vous renseigner sur nos programmes scolaires, les frais de scolarité, les horaires et le processus d\'inscription. Que souhaitez-vous savoir précisément ?';
      
    case 'healthcare':
      return 'Je peux vous aider concernant nos spécialités médicales, la prise de rendez-vous, nos horaires et les urgences. Quel type de consultation recherchez-vous ?';
      
    case 'restaurant':
      return 'Je peux vous informer sur notre menu, les options de livraison, les réservations et nos spécialités. Que souhaitez-vous savoir ?';
      
    case 'real_estate':
      return 'Je peux vous renseigner sur nos biens disponibles, organiser des visites et vous expliquer les conditions. Cherchez-vous à acheter ou louer ?';
      
    case 'ecommerce':
      return 'Je peux vous aider avec le suivi de commande, les retours, les paiements et notre catalogue. Que puis-je faire pour vous ?';
      
    default:
      return 'Je suis là pour vous aider ! Pouvez-vous me préciser le type d\'information que vous recherchez ?';
  }
}

function generateAppointmentResponse(language: string, businessSector: string | null): string {
  const timeQuestion = language === 'darija' ?
    'Quelle heure demain matin te convient le mieux ?' :
    language === 'ar' ?
    'ما هو الوقت الأنسب لك غداً صباحاً؟' :
    language === 'en' ?
    'What time tomorrow morning works best for you?' :
    'Quelle heure demain matin vous convient le mieux ?';
  
  const prefix = language === 'darija' ?
    'Avec plaisir. ' :
    language === 'ar' ?
    'بكل سرور. ' :
    language === 'en' ?
    'With pleasure. ' :
    'Avec plaisir. ';
  
  if (businessSector === 'healthcare') {
    const specialtyQuestion = language === 'fr' ?
      'Pour quelle spécialité médicale souhaitez-vous consulter ?\n' :
      'What medical specialty would you like to consult for?\n';
    return prefix + specialtyQuestion + timeQuestion;
  }
  
  return prefix + timeQuestion;
}

function generatePricingResponse(language: string): string {
  switch (language) {
    case 'darija':
      return 'Bach naaref les tarifs, khask twasal m3a équipe commerciale dyalna li ghadi taati lik kul les détails.';
    case 'ar':
      return 'لمعرفة الأسعار، أنصحك بالتواصل مع فريق المبيعات لدينا والذي سيعطيك كافة التفاصيل.';
    case 'en':
      return 'For pricing information, I recommend contacting our sales team who can give you all the details.';
    default:
      return 'Pour les informations de tarifs, je vous recommande de contacter notre équipe commerciale qui pourra vous donner tous les détails.\nSouhaitez-vous que je vous mette en relation avec un conseiller ?';
  }
}

function generateHelpResponse(language: string, assistantName: string): string {
  switch (language) {
    case 'darija':
      return `Ana ${assistantName} o kan3awen f bzzaf dyal les questions. Gul liya chnu bghiti ta3ref bzzbt?`;
    case 'ar':
      return `أنا ${assistantName} ويمكنني مساعدتك في أسئلة مختلفة. أخبرني بالضبط ماذا تريد أن تعرف؟`;
    case 'en':
      return `I'm ${assistantName} and I can help with various questions. Tell me exactly what you want to know?`;
    default:
      return `Je suis ${assistantName}, votre assistant virtuel et je peux vous aider avec diverses questions.\nPouvez-vous être plus précis sur ce dont vous avez besoin ?`;
  }
}

function generateThankYouResponse(language: string): string {
  switch (language) {
    case 'darija':
      return 'La shukr! Kan frah naawen. Ila 3andek chi su2al akhor, gul liya.';
    case 'ar':
      return 'لا شكر على واجب! كان من دواعي سروري مساعدتك. إذا كان لديك سؤال آخر، أخبرني.';
    case 'en':
      return 'You\'re welcome! It was a pleasure to help. Feel free to ask if you have other questions.';
    default:
      return 'Je vous en prie ! C\'était un plaisir de vous aider.\nAvec plaisir ! N\'hésitez pas si vous avez d\'autres questions.';
  }
}

function generateProblemResponse(language: string): string {
  switch (language) {
    case 'darija':
      return 'Smah liya 3la had l mushkil. Ymken twasaf liya chnu makhdamsh bzzbt?';
    case 'ar':
      return 'أعتذر عن هذه المشكلة. هل يمكنك أن تصف لي بالضبط ما لا يعمل؟';
    case 'en':
      return 'I\'m sorry about this problem. Can you describe exactly what\'s not working?';
    default:
      return 'Je suis désolé d\'apprendre que vous rencontrez un problème.\nPouvez-vous me décrire plus précisément ce qui ne fonctionne pas ?';
  }
}

function generateContactInfoRequest(language: string, businessSector: string | null): string {
  let fields = '';
  
  switch (businessSector) {
    case 'education':
      fields = language === 'fr' ? 'nom, âge de l\'enfant, niveau souhaité et votre numéro' :
               language === 'darija' ? 'smiya, 3mer dyal l tfl, niveau li bghiti o numero dyalek' :
               language === 'ar' ? 'الاسم، عمر الطفل، المستوى المطلوب ورقم هاتفك' :
               'name, child\'s age, desired level and your number';
      break;
    case 'healthcare':
      fields = language === 'fr' ? 'nom, type de consultation souhaitée et votre numéro' :
               language === 'darija' ? 'smiya, no3 dyal consultation li bghiti o numero dyalek' :
               language === 'ar' ? 'الاسم، نوع الاستشارة المطلوبة ورقم هاتفك' :
               'name, type of consultation needed and your number';
      break;
    default:
      fields = language === 'fr' ? 'nom, besoin spécifique et numéro de téléphone' :
               language === 'darija' ? 'smiya, chnu bghiti bzzbt o numero dyalek' :
               language === 'ar' ? 'الاسم، حاجتك المحددة ورقم الهاتف' :
               'name, specific need and phone number';
  }
  
  const prefix = language === 'fr' ? 'Parfait ! Pour mieux vous aider, j\'aurai besoin de votre : ' :
                 language === 'darija' ? 'Mezyan! Bach naawen bzzaf, khassni : ' :
                 language === 'ar' ? 'ممتاز! لمساعدتك بشكل أفضل، سأحتاج إلى: ' :
                 'Perfect! To better help you, I\'ll need your: ';
  
  return prefix + fields;
}

function generateContextualResponse(userMessage: string, language: string, businessSector: string | null, assistantName: string): string {
  // Réponses contextuelles intelligentes selon le secteur
  if (businessSector) {
    switch (businessSector) {
      case 'education':
        return language === 'fr' ? 
          'Pour notre établissement scolaire, je peux vous renseigner sur les programmes, les frais de scolarité et les inscriptions. Que souhaitez-vous savoir ?' :
          'I can help you with information about our school programs, tuition fees, and enrollment. What would you like to know?';
      case 'healthcare':
        return language === 'fr' ?
          'Pour notre clinique, je peux vous aider avec les consultations, les spécialités disponibles et la prise de rendez-vous. Comment puis-je vous assister ?' :
          'For our clinic, I can help with consultations, available specialties, and appointment booking. How can I assist you?';
      case 'restaurant':
        return language === 'fr' ?
          'Pour notre restaurant, je peux vous informer sur notre menu, les réservations et les livraisons. Que désirez-vous ?' :
          'For our restaurant, I can inform you about our menu, reservations, and delivery. What would you like?';
    }
  }
  
  // Réponse générique intelligente avec adaptation culturelle marocaine
  const responses = language === 'fr' ? [
    'C\'est une excellente question ! Permettez-moi de voir comment je peux vous aider.',
    'Je comprends votre demande. Laissez-moi vous orienter vers la meilleure solution.',
    'Merci pour votre message. Je vais faire de mon mieux pour vous donner une réponse utile.',
    'Intéressant ! Pouvez-vous me donner un peu plus de contexte ?',
  ] : language === 'darija' ? [
    'Hadi su2al mezyan! Khallini nshuf kifash ymken naawen.',
    'Fhemt chnu bghiti. Khallini nwajhek l7al li ahs.',
    'Shukran 3la message dyalek. Ghadi ndir kul ma ymken bach naawen.',
  ] : language === 'ar' ? [
    'هذا سؤال ممتاز! دعني أرى كيف يمكنني مساعدتك.',
    'أفهم طلبك. دعني أوجهك للحل الأفضل.',
    'شكراً لرسالتك. سأفعل ما بوسعي لإعطائك إجابة مفيدة.',
  ] : [
    'That\'s an excellent question! Let me see how I can help you.',
    'I understand your request. Let me guide you to the best solution.',
    'Thank you for your message. I\'ll do my best to give you a helpful answer.',
  ];

  return responses[Math.floor(Math.random() * responses.length)] || 'Je suis là pour vous aider !';
}

/**
 * ================================
 * Fonctions utilitaires
 * ================================
 */

/**
 * Valider la configuration de l'assistant pour l'IA
 */
export async function validateAssistantForLLM(assistantId: string, tenantId: string): Promise<boolean> {
  try {
    const assistant = await assistantService.getAssistantById(assistantId, tenantId);
    
    if (!assistant || !assistant.isActive) {
      return false;
    }

    // Vérifications spécifiques pour l'IA
    const config = assistant;
    
    // Si pas de prompt système, il sera remplacé par le prompt par défaut lors de la génération
    if (!config.systemPrompt || config.systemPrompt.length < 10) {
      logger.info('Assistant will use default SYLION system prompt', { assistantId });
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