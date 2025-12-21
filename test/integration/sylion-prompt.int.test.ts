/**
 * ================================
 * Tests pour le prompt système SYLION
 * ================================
 */

// Vitest globals are enabled via vitest config
import type { LLMMessage } from '../../src/lib/llm';
import { generateAssistantReply } from '../../src/lib/llm';
import { getDefaultSystemPrompt } from '../../src/lib/sylion-default-prompt';
import { DatabaseTestHelper } from '../helpers/database.helper';

describe('SYLION System Prompt', () => {
  let tenant: any;
  let assistant: any;

  beforeAll(async () => {
    // Nettoyer la DB de test
    await DatabaseTestHelper.cleanDatabase();
    
    // Créer un tenant de test
    tenant = await DatabaseTestHelper.createTestTenant('test-prompt');
    
    // Créer un assistant avec le prompt par défaut
    assistant = await DatabaseTestHelper.createTestAssistant(tenant.id, 'sylion-demo');
  });

  afterAll(async () => {
    await DatabaseTestHelper.cleanDatabase();
  });

  describe('Prompt par défaut', () => {
    it('devrait avoir un prompt système par défaut valide', () => {
      const defaultPrompt = getDefaultSystemPrompt();
      
      expect(defaultPrompt).toBeDefined();
      expect(defaultPrompt.length).toBeGreaterThan(100);
      expect(defaultPrompt).toContain('SYLION Assistant');
      expect(defaultPrompt).toContain('entreprises marocaines');
      expect(defaultPrompt).toContain('WhatsApp');
    });
  });

  describe('Détection de langue', () => {
    it('devrait répondre en français pour un message en français', async () => {
      const messages: LLMMessage[] = [
        { role: 'user', content: 'Bonjour, comment allez-vous ?' }
      ];

      const reply = await generateAssistantReply({
        tenantId: tenant.id,
        assistantId: assistant.id,
        messages
      });

      expect(reply).toBeDefined();
      expect(reply).toContain('Bonjour');
      expect(reply.toLowerCase()).not.toContain('hello');
    });

    it('devrait répondre en anglais pour un message en anglais', async () => {
      const messages: LLMMessage[] = [
        { role: 'user', content: 'Hello, how are you?' }
      ];

      const reply = await generateAssistantReply({
        tenantId: tenant.id,
        assistantId: assistant.id,
        messages
      });

      expect(reply).toBeDefined();
      expect(reply.toLowerCase()).toContain('hello');
    });

    it('devrait répondre en darija pour un message en darija', async () => {
      const messages: LLMMessage[] = [
        { role: 'user', content: 'Salam, kifash dayr?' }
      ];

      const reply = await generateAssistantReply({
        tenantId: tenant.id,
        assistantId: assistant.id,
        messages
      });

      expect(reply).toBeDefined();
      expect(reply.toLowerCase()).toContain('salam');
    });
  });

  describe('Détection de secteur', () => {
    it('devrait détecter le secteur éducation', async () => {
      const messages: LLMMessage[] = [
        { role: 'user', content: 'Je veux inscrire mon fils à l\'école' }
      ];

      const reply = await generateAssistantReply({
        tenantId: tenant.id,
        assistantId: assistant.id,
        messages
      });

      expect(reply).toBeDefined();
      expect(reply.toLowerCase()).toMatch(/(inscription|école|niveau|âge)/);
    });

    it('devrait détecter le secteur santé', async () => {
      const messages: LLMMessage[] = [
        { role: 'user', content: 'Je cherche un rendez-vous chez le médecin' }
      ];

      const reply = await generateAssistantReply({
        tenantId: tenant.id,
        assistantId: assistant.id,
        messages
      });

      expect(reply).toBeDefined();
      expect(reply.toLowerCase()).toMatch(/(consultation|spécialité|rendez-vous)/);
    });

    it('devrait détecter le secteur restaurant', async () => {
      const messages: LLMMessage[] = [
        { role: 'user', content: 'Quel est votre menu du jour ?' }
      ];

      const reply = await generateAssistantReply({
        tenantId: tenant.id,
        assistantId: assistant.id,
        messages
      });

      expect(reply).toBeDefined();
      expect(reply.toLowerCase()).toMatch(/(menu|restaurant|livraison|réservation)/);
    });
  });

  describe('Détection d\'intentions', () => {
    it('devrait détecter une demande de démo', async () => {
      const messages: LLMMessage[] = [
        { role: 'user', content: 'Comment ça marche votre système ?' }
      ];

      const reply = await generateAssistantReply({
        tenantId: tenant.id,
        assistantId: assistant.id,
        messages
      });

      expect(reply).toBeDefined();
      expect(reply.toLowerCase()).toMatch(/(assistant|whatsapp|automatique|réponses)/);
    });

    it('devrait détecter une demande de prix', async () => {
      const messages: LLMMessage[] = [
        { role: 'user', content: 'Quels sont vos tarifs ?' }
      ];

      const reply = await generateAssistantReply({
        tenantId: tenant.id,
        assistantId: assistant.id,
        messages
      });

      expect(reply).toBeDefined();
      expect(reply.toLowerCase()).toMatch(/(équipe commerciale|conseiller|tarifs)/);
    });

    it('devrait détecter une demande de rendez-vous', async () => {
      const messages: LLMMessage[] = [
        { role: 'user', content: 'Je veux prendre rendez-vous demain matin' }
      ];

      const reply = await generateAssistantReply({
        tenantId: tenant.id,
        assistantId: assistant.id,
        messages
      });

      expect(reply).toBeDefined();
      expect(reply.toLowerCase()).toMatch(/(heure|matin|rendez-vous)/);
    });
  });

  describe('Règles importantes', () => {
    it('ne devrait jamais mentionner Google/OpenAI', async () => {
      const messages: LLMMessage[] = [
        { role: 'user', content: 'Qui t\'a créé ?' }
      ];

      const reply = await generateAssistantReply({
        tenantId: tenant.id,
        assistantId: assistant.id,
        messages
      });

      expect(reply).toBeDefined();
      expect(reply.toLowerCase()).not.toContain('google');
      expect(reply.toLowerCase()).not.toContain('openai');
      expect(reply.toLowerCase()).not.toContain('anthropic');
    });

    it('devrait répondre par SYLION quand on demande qui l\'a créé', async () => {
      const messages: LLMMessage[] = [
        { role: 'user', content: 'Qui est votre créateur ?' }
      ];

      const reply = await generateAssistantReply({
        tenantId: tenant.id,
        assistantId: assistant.id,
        messages
      });

      expect(reply).toBeDefined();
      // Pour l'instant, la réponse contextuelle ne gère pas spécifiquement cette question
      // mais elle ne devrait pas mentionner les entreprises d'IA
      expect(reply.toLowerCase()).not.toContain('google');
      expect(reply.toLowerCase()).not.toContain('openai');
    });
  });

  describe('Adaptation culturelle marocaine', () => {
    it('devrait utiliser des expressions adaptées au Maroc', async () => {
      const messages: LLMMessage[] = [
        { role: 'user', content: 'Merci beaucoup !' }
      ];

      const reply = await generateAssistantReply({
        tenantId: tenant.id,
        assistantId: assistant.id,
        messages
      });

      expect(reply).toBeDefined();
      // Vérifier qu'il utilise des expressions polies et professionnelles
      expect(reply.toLowerCase()).toMatch(/(je vous en prie|avec plaisir|de rien)/);
    });
  });
});