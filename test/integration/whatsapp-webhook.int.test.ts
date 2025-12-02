/**
 * ================================
 * WhatsApp Webhook Boss 1 Integration Test
 * ================================
 * 
 * Test d'intégration pour le pipeline Boss 1: 
 * Webhook → Gateway → Normalization → Core Service → Queue.
 */

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { eq } from 'drizzle-orm';
import { FastifyInstance } from 'fastify';
import supertest from 'supertest';
import { db, schema } from '../../src/db/index';
import { createApp } from '../../src/server';
import { DatabaseTestHelper } from '../helpers/database.helper';

// Mock the queue system for tests
jest.mock('../../src/jobs/index', () => ({
  addJob: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
}));

describe('WhatsApp Webhook Boss 1 Integration', () => {
  let app: FastifyInstance;
  let request: supertest.SuperTest<supertest.Test>;
  
  // Test data
  let testTenant: any;
  let testChannel: any;
  let testAssistant: any;

  beforeAll(async () => {
    // Créer l'application Fastify
    app = await createApp();
    await app.ready();
    request = supertest(app.server);

    // Préparer les données de test
    await DatabaseTestHelper.cleanup();
    
    // Créer un tenant de test
    testTenant = await DatabaseTestHelper.createTestTenant('boss1');
    
    // Créer un canal WhatsApp avec un numéro spécifique
    testChannel = await DatabaseTestHelper.createTestChannel(testTenant.id, 'boss1');
    // Mettre à jour avec un numéro spécifique pour les tests
    await db
      .update(schema.channels)
      .set({ 
        whatsappPhoneNumber: '+212699999999', // Numéro utilisé dans les tests
        type: 'whatsapp',
        isActive: true,
      })
      .where(eq(schema.channels.id, testChannel.id));

    // Créer un assistant par défaut
    testAssistant = await DatabaseTestHelper.createTestAssistant(testTenant.id, 'boss1');
  });

  afterAll(async () => {
    await DatabaseTestHelper.cleanup();
    await app.close();
  });

  describe('POST /whatsapp/webhook - Boss 1 Pipeline', () => {
    
    it('devrait traiter un message 360dialog et créer les enregistrements DB', async () => {
      // Arrange - Payload 360dialog format
      const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp en secondes
      const webhookPayload = {
        messages: [
          {
            from: '212600000001', // Sans le + pour simuler 360dialog
            to: '212699999999',   // Sans le + pour simuler 360dialog
            id: '360dialog_msg_001',
            timestamp: timestamp.toString(),
            text: {
              body: 'Bonjour, je teste Boss 1!'
            },
            type: 'text'
          }
        ]
      };

      // Act
      const response = await request
        .post('/api/v1/whatsapp/webhook')
        .send(webhookPayload)
        .expect(200);

      // Assert HTTP response
      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: 'accepted',
          tenantId: testTenant.id,
          channelId: testChannel.id,
          conversationId: expect.any(String),
          messageId: expect.any(String),
        },
      });

      const { conversationId, messageId } = response.body.data;

      // Assert: Vérifier que la conversation existe en DB
      const conversations = await db
        .select()
        .from(schema.conversations)
        .where(eq(schema.conversations.id, conversationId));

      expect(conversations).toHaveLength(1);
      const conversation = conversations[0];
      expect(conversation.tenantId).toBe(testTenant.id);
      expect(conversation.channelId).toBe(testChannel.id);
      expect(conversation.assistantId).toBe(testAssistant.id);
      expect(conversation.userIdentifier).toBe('+212600000001'); // Normalisé avec +
      expect(conversation.status).toBe('active');

      // Assert: Vérifier que le message existe en DB
      const messages = await db
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.id, messageId));

      expect(messages).toHaveLength(1);
      const message = messages[0];
      expect(message.conversationId).toBe(conversationId);
      expect(message.type).toBe('text');
      expect(message.direction).toBe('inbound');
      expect(message.content).toBe('Bonjour, je teste Boss 1!');
      expect(message.externalId).toBe('360dialog_msg_001');
      expect(message.status).toBe('processed');

      // Assert: Vérifier les métadonnées du message
      expect(message.metadata).toMatchObject({
        provider: '360dialog',
        providerMessageId: '360dialog_msg_001',
        fromPhone: '+212600000001',
        toPhone: '+212699999999',
      });

      // Assert: Vérifier que le job a été enqueué (mock)
      const { addJob } = require('../../src/jobs/index');
      expect(addJob).toHaveBeenCalledWith(
        'whatsapp:process-incoming',
        expect.objectContaining({
          tenantId: testTenant.id,
          channelId: testChannel.id,
          conversationId,
          messageId,
          from: '+212600000001',
          message: {
            type: 'text',
            content: 'Bonjour, je teste Boss 1!',
          },
        }),
        expect.any(Object)
      );
    });

    it('devrait réutiliser une conversation existante pour le même utilisateur', async () => {
      // Arrange - Premier message
      const firstTimestamp = Math.floor(Date.now() / 1000);
      const firstPayload = {
        messages: [{
          from: '212600000002',
          to: '212699999999',
          id: '360dialog_msg_002',
          timestamp: firstTimestamp.toString(),
          text: { body: 'Premier message' },
          type: 'text'
        }]
      };

      // Act - Envoyer le premier message
      const firstResponse = await request
        .post('/api/v1/whatsapp/webhook')
        .send(firstPayload)
        .expect(200);

      const firstConversationId = firstResponse.body.data.conversationId;

      // Arrange - Deuxième message du même utilisateur
      const secondTimestamp = Math.floor(Date.now() / 1000) + 10;
      const secondPayload = {
        messages: [{
          from: '212600000002', // Même utilisateur
          to: '212699999999',
          id: '360dialog_msg_003',
          timestamp: secondTimestamp.toString(),
          text: { body: 'Deuxième message' },
          type: 'text'
        }]
      };

      // Act - Envoyer le deuxième message
      const secondResponse = await request
        .post('/api/v1/whatsapp/webhook')
        .send(secondPayload)
        .expect(200);

      // Assert - Même conversation réutilisée
      expect(secondResponse.body.data.conversationId).toBe(firstConversationId);

      // Assert - Deux messages dans la même conversation
      const messages = await db
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.conversationId, firstConversationId));

      expect(messages).toHaveLength(2);
      expect(messages.map(m => m.content).sort()).toEqual([
        'Deuxième message',
        'Premier message',
      ]);
    });

    it('devrait échouer si aucun canal WhatsApp trouvé pour le numéro de destination', async () => {
      // Arrange - Utiliser un numéro de destination non configuré
      const timestamp = Math.floor(Date.now() / 1000);
      const webhookPayload = {
        messages: [{
          from: '212600000003',
          to: '212688888888', // Numéro non configuré
          id: '360dialog_msg_004',
          timestamp: timestamp.toString(),
          text: { body: 'Message vers numéro inconnu' },
          type: 'text'
        }]
      };

      // Act
      const response = await request
        .post('/api/v1/whatsapp/webhook')
        .send(webhookPayload)
        .expect(404); // Canal non trouvé

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('canal WhatsApp');
    });

    it('devrait échouer avec un payload 360dialog malformé (pas de messages)', async () => {
      // Arrange - Payload sans champ messages
      const invalidPayload = {
        // Pas de field messages
        entry: [{ /* structure différente */ }]
      };

      // Act - Fastify JSON Schema validation rejette avant le gateway
      const response = await request
        .post('/api/v1/whatsapp/webhook')
        .send(invalidPayload)
        .expect(400);

      // Assert - Validation JSON Schema de Fastify
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.validationErrors).toBeDefined();
    });

    it('devrait échouer avec des champs manquants dans le message (schema validation)', async () => {
      // Arrange - Message sans "from" (required par le schema JSON)
      const invalidPayload = {
        messages: [{
          // from: manquant - champ requis
          to: '212699999999',
          id: '360dialog_msg_005',
          timestamp: Math.floor(Date.now() / 1000).toString(),
          text: { body: 'Message sans from' },
          type: 'text'
        }]
      };

      // Act - Fastify JSON Schema validation rejette
      const response = await request
        .post('/api/v1/whatsapp/webhook')
        .send(invalidPayload)
        .expect(400);

      // Assert - Validation JSON Schema de Fastify
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.validationErrors).toBeDefined();
    });

    it('devrait traiter un message sans texte (type non-text)', async () => {
      // Arrange - Message audio sans texte
      const timestamp = Math.floor(Date.now() / 1000);
      const webhookPayload = {
        messages: [{
          from: '212600000004',
          to: '212699999999',
          id: '360dialog_msg_006',
          timestamp: timestamp.toString(),
          // Pas de text.body pour simuler un message audio
          type: 'audio'
        }]
      };

      // Act
      const response = await request
        .post('/api/v1/whatsapp/webhook')
        .send(webhookPayload)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);

      // Assert: Vérifier le message en DB avec contenu vide
      const messageId = response.body.data.messageId;
      const messages = await db
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.id, messageId));

      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe(''); // Contenu vide pour message non-text
    });

    it('devrait normaliser correctement les numéros de téléphone', async () => {
      // Arrange - Numéros dans différents formats
      const timestamp = Math.floor(Date.now() / 1000);
      const webhookPayload = {
        messages: [{
          from: ' +212 6 00 00 00 05 ', // Format avec espaces et +
          to: '212.699.999.999',        // Format avec points
          id: '360dialog_msg_007',
          timestamp: timestamp.toString(),
          text: { body: 'Test normalisation numéros' },
          type: 'text'
        }]
      };

      // Act
      const response = await request
        .post('/api/v1/whatsapp/webhook')
        .send(webhookPayload)
        .expect(200);

      // Assert
      const messageId = response.body.data.messageId;
      const messages = await db
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.id, messageId));

      expect(messages[0].metadata).toMatchObject({
        fromPhone: '+212600000005', // Normalisé
        toPhone: '+212699999999',   // Normalisé
      });

      // Assert: Vérifier la conversation avec userIdentifier normalisé
      const conversationId = response.body.data.conversationId;
      const conversations = await db
        .select()
        .from(schema.conversations)
        .where(eq(schema.conversations.id, conversationId));

      expect(conversations[0].userIdentifier).toBe('+212600000005');
    });
  });
});