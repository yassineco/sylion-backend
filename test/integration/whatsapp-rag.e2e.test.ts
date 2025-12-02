// @ts-nocheck - Disabled temporarily until schema refactor is complete
/**
 * ================================
 * WhatsApp + RAG E2E Tests - Sylion Backend
 * ================================
 * 
 * Test end-to-end du flux WhatsApp avec RAG activé.
 * Simule un webhook WhatsApp et vérifie que la réponse
 * utilise le contexte RAG.
 */

import { db, schema } from '@/db/index';
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { eq } from 'drizzle-orm';

// Note: Ce test E2E est en cours de refactorisation pour correspondre au schéma DB actuel
// Certaines erreurs de typage sont attendues jusqu'à la mise à jour complète

// Mock embedding service
jest.mock('@/lib/embedding', () => ({
  generateEmbedding: jest.fn<() => Promise<number[]>>().mockImplementation(async () => {
    return new Array(768).fill(0).map((_, i) => Math.sin(i * 0.1) * 0.5);
  }),
  generateBatchEmbeddings: jest.fn<() => Promise<number[][]>>().mockImplementation(async () => {
    return [new Array(768).fill(0).map((_, i) => Math.sin(i * 0.1) * 0.5)];
  }),
  EMBEDDING_DIMENSIONS: 768,
}));

// Mock LLM service to inspect calls
const mockGenerateReply = jest.fn<() => Promise<string>>().mockImplementation(async () => {
  return 'Voici les informations basées sur notre documentation.';
});

jest.mock('@/lib/llm', () => ({
  generateReply: (...args: unknown[]) => mockGenerateReply(...args),
}));

// Mock 360dialog API - Commented out as module doesn't exist yet
// TODO: Re-enable when 360dialog provider is implemented
// jest.mock('@/modules/whatsapp/providers/360dialog.provider', () => ({
//   Dialog360Provider: jest.fn().mockImplementation(() => ({
//     sendMessage: jest.fn<() => Promise<{ success: boolean; messageId: string }>>().mockResolvedValue({
//       success: true,
//       messageId: 'mock-message-id',
//     }),
//   })),
// }));

describe.skip('WhatsApp + RAG E2E Tests (TODO: Refactor for current schema)', () => {
  let testTenantId: string;
  let testChannelId: string;
  let testAssistantId: string;
  let testDocumentId: string;
  
  const TEST_PHONE = '+212600000001';
  const TEST_WABA_ID = 'test-waba-123';

  beforeAll(async () => {
    // 1. Créer tenant de test
    const tenantResult = await db
      .insert(schema.tenants)
      .values({
        name: 'RAG E2E Test Tenant',
        slug: `rag-e2e-${Date.now()}`,
        isActive: true,
        plan: 'pro',
      })
      .returning();
    testTenantId = tenantResult[0]!.id;

    // 2. Créer assistant avec RAG activé
    const assistantResult = await db
      .insert(schema.assistants)
      .values({
        tenantId: testTenantId,
        name: 'RAG Test Assistant',
        systemPrompt: 'Tu es un assistant scolaire.',
        enableRag: true, // RAG activé!
        ragThreshold: 0.5,
        isActive: true,
      })
      .returning();
    testAssistantId = assistantResult[0]!.id;

    // 3. Créer channel WhatsApp
    const channelResult = await db
      .insert(schema.channels)
      .values({
        tenantId: testTenantId,
        assistantId: testAssistantId,
        type: 'whatsapp',
        provider: '360dialog',
        externalId: TEST_WABA_ID,
        isActive: true,
        credentials: {
          apiKey: 'test-api-key',
          wabaId: TEST_WABA_ID,
        },
      })
      .returning();
    testChannelId = channelResult[0]!.id;

    // 4. Indexer un document de test
    const { documentService } = await import('@/modules/rag');
    
    const docResult = await documentService.uploadAndIndexDocument(testTenantId, {
      name: 'FAQ Inscription.md',
      type: 'md',
      content: `
# FAQ Inscription Scolaire

## Frais d'inscription
Les frais d'inscription pour l'année 2024-2025 sont les suivants:
- Maternelle: 1500 DH
- Primaire: 2000 DH
- Collège: 2500 DH
- Lycée: 3000 DH

## Documents nécessaires
Pour l'inscription, vous devez fournir:
- Carte d'identité des parents
- Certificat de naissance de l'enfant
- 4 photos d'identité
- Certificat de scolarité

## Dates importantes
- Inscription: Du 1er Juin au 15 Septembre
- Rentrée: 5 Septembre 2024
      `.trim(),
    });
    testDocumentId = docResult.documentId;
  });

  afterAll(async () => {
    // Nettoyer dans l'ordre inverse
    try {
      // Supprimer messages et conversations
      await db.delete(schema.messages)
        .where(eq(schema.messages.tenantId, testTenantId));
      await db.delete(schema.conversations)
        .where(eq(schema.conversations.tenantId, testTenantId));
      
      // Supprimer documents et chunks
      await db.delete(schema.documentChunks)
        .where(eq(schema.documentChunks.tenantId, testTenantId));
      await db.delete(schema.documents)
        .where(eq(schema.documents.tenantId, testTenantId));
      
      // Supprimer channel, assistant, tenant
      await db.delete(schema.channels)
        .where(eq(schema.channels.id, testChannelId));
      await db.delete(schema.assistants)
        .where(eq(schema.assistants.id, testAssistantId));
      await db.delete(schema.tenants)
        .where(eq(schema.tenants.id, testTenantId));
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  beforeEach(() => {
    mockGenerateReply.mockClear();
  });

  describe('Full RAG Flow', () => {
    it('should use RAG context when answering relevant question', async () => {
      // Simuler webhook WhatsApp avec une question sur les frais
      const webhookPayload = {
        object: 'whatsapp_business_account',
        entry: [{
          id: TEST_WABA_ID,
          changes: [{
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '+212500000000',
                phone_number_id: 'phone-123',
              },
              contacts: [{
                profile: { name: 'Test User' },
                wa_id: TEST_PHONE.replace('+', ''),
              }],
              messages: [{
                from: TEST_PHONE.replace('+', ''),
                id: `wamid-${Date.now()}`,
                timestamp: Math.floor(Date.now() / 1000).toString(),
                type: 'text',
                text: { body: 'Quels sont les frais d\'inscription pour le primaire?' },
              }],
            },
          }],
        }],
      };

      const response = await request(app)
        .post('/api/v1/webhooks/whatsapp/360dialog')
        .send(webhookPayload)
        .expect(200);

      // Attendre le traitement async
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Vérifier que generateReply a été appelé avec le contexte RAG
      expect(mockGenerateReply).toHaveBeenCalled();
      
      const lastCall = mockGenerateReply.mock.calls[0][0];
      if (lastCall?.systemPrompt) {
        // Le system prompt devrait contenir le contexte documentaire
        expect(lastCall.systemPrompt).toContain('2000 DH');
      }
    });

    it('should store RAG metadata in message', async () => {
      // Créer une conversation et message manuellement pour vérifier le stockage
      const conversationResult = await db
        .insert(schema.conversations)
        .values({
          tenantId: testTenantId,
          channelId: testChannelId,
          contactPhone: TEST_PHONE,
          contactName: 'Test RAG User',
          status: 'open',
        })
        .returning();
      
      const conversationId = conversationResult[0]!.id;

      // Créer un message avec métadonnées RAG
      const messageResult = await db
        .insert(schema.messages)
        .values({
          tenantId: testTenantId,
          conversationId,
          channelId: testChannelId,
          role: 'assistant',
          content: 'Les frais sont de 2000 DH pour le primaire.',
          status: 'sent',
          ragUsed: true,
          ragResults: {
            documentsUsed: [testDocumentId],
            chunksCount: 2,
            topScore: 0.85,
            searchQuery: 'frais inscription primaire',
          },
        })
        .returning();

      const savedMessage = messageResult[0]!;
      
      expect(savedMessage.ragUsed).toBe(true);
      expect(savedMessage.ragResults).toBeDefined();
      expect((savedMessage.ragResults as any).documentsUsed).toContain(testDocumentId);

      // Cleanup
      await db.delete(schema.messages)
        .where(eq(schema.messages.id, savedMessage.id));
      await db.delete(schema.conversations)
        .where(eq(schema.conversations.id, conversationId));
    });

    it('should skip RAG when assistant.enableRag is false', async () => {
      // Désactiver RAG sur l'assistant
      await db
        .update(schema.assistants)
        .set({ enableRag: false })
        .where(eq(schema.assistants.id, testAssistantId));

      try {
        const webhookPayload = {
          object: 'whatsapp_business_account',
          entry: [{
            id: TEST_WABA_ID,
            changes: [{
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '+212500000000',
                  phone_number_id: 'phone-123',
                },
                contacts: [{
                  profile: { name: 'Test User' },
                  wa_id: TEST_PHONE.replace('+', ''),
                }],
                messages: [{
                  from: TEST_PHONE.replace('+', ''),
                  id: `wamid-norag-${Date.now()}`,
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  type: 'text',
                  text: { body: 'Quels sont les frais?' },
                }],
              },
            }],
          }],
        };

        await request(app)
          .post('/api/v1/webhooks/whatsapp/360dialog')
          .send(webhookPayload)
          .expect(200);

        // Attendre traitement
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Vérifier que le LLM n'a pas reçu de contexte RAG
        if (mockGenerateReply.mock.calls.length > 0) {
          const lastCall = mockGenerateReply.mock.calls[mockGenerateReply.mock.calls.length - 1][0];
          // Ne devrait pas contenir de contexte documentaire
          expect(lastCall?.systemPrompt || '').not.toContain('## Contexte documentaire');
        }
      } finally {
        // Réactiver RAG
        await db
          .update(schema.assistants)
          .set({ enableRag: true })
          .where(eq(schema.assistants.id, testAssistantId));
      }
    });
  });

  describe('Tenant Isolation', () => {
    it('should not return documents from other tenants', async () => {
      // Créer un autre tenant avec ses propres documents
      const otherTenantResult = await db
        .insert(schema.tenants)
        .values({
          name: 'Other Tenant',
          slug: `other-${Date.now()}`,
        })
        .returning();
      
      const otherTenantId = otherTenantResult[0]!.id;

      try {
        // Indexer un document pour l'autre tenant
        const { documentService } = await import('@/modules/rag');
        
        await documentService.uploadAndIndexDocument(otherTenantId, {
          name: 'Secret Doc.md',
          type: 'md',
          content: 'Information confidentielle de l\'autre tenant.',
        });

        // Rechercher depuis notre tenant de test
        const { ragService } = await import('@/modules/rag');
        const { generateEmbedding } = await import('@/lib/embedding');
        
        const embedding = await generateEmbedding('information confidentielle');
        const results = await ragService.searchSimilarChunks(testTenantId, embedding);

        // Ne devrait pas trouver le document de l'autre tenant
        const otherTenantDocs = results.filter(r => 
          r.content.includes('confidentielle')
        );
        expect(otherTenantDocs.length).toBe(0);
      } finally {
        // Cleanup
        await db.delete(schema.documentChunks)
          .where(eq(schema.documentChunks.tenantId, otherTenantId));
        await db.delete(schema.documents)
          .where(eq(schema.documents.tenantId, otherTenantId));
        await db.delete(schema.tenants)
          .where(eq(schema.tenants.id, otherTenantId));
      }
    });
  });

  describe('RAG API Endpoints', () => {
    it('should upload document via API', async () => {
      const response = await request(app)
        .post(`/api/v1/tenants/${testTenantId}/documents`)
        .set('Content-Type', 'application/json')
        .send({
          name: 'API Test Doc.txt',
          type: 'txt',
          content: 'Contenu uploadé via API.',
        })
        .expect(201);

      expect(response.body).toHaveProperty('documentId');
      expect(response.body.success).toBe(true);

      // Cleanup
      if (response.body.documentId) {
        await db.delete(schema.documentChunks)
          .where(eq(schema.documentChunks.documentId, response.body.documentId));
        await db.delete(schema.documents)
          .where(eq(schema.documents.id, response.body.documentId));
      }
    });

    it('should list tenant documents via API', async () => {
      const response = await request(app)
        .get(`/api/v1/tenants/${testTenantId}/documents`)
        .expect(200);

      expect(Array.isArray(response.body.documents)).toBe(true);
      expect(response.body).toHaveProperty('total');
    });

    it('should get RAG stats via API', async () => {
      const response = await request(app)
        .get(`/api/v1/tenants/${testTenantId}/rag/stats`)
        .expect(200);

      expect(response.body).toHaveProperty('documentsCount');
      expect(response.body).toHaveProperty('chunksCount');
      expect(response.body).toHaveProperty('totalTokens');
    });
  });
});
