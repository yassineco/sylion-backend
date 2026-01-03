/**
 * ================================
 * WhatsApp Pipeline Load Test - 10 Messages Consécutifs
 * ================================
 * 
 * Test d'intégration validant que le pipeline Boss 1 standardisé
 * (POST /api/v1/whatsapp/webhook) peut traiter 10 messages consécutifs
 * sans crash, timeout ou incohérence DB.
 * 
 * Vérifie :
 * - 10 requêtes HTTP acceptées (status 200)
 * - 10 messages USER insérés en DB
 * - 10 jobs enqueués vers 'whatsapp:process-incoming'
 * 
 * Timeout global : 90s
 */

import { and, eq } from 'drizzle-orm';
import { FastifyInstance } from 'fastify';
import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db, schema } from '../../src/db/index';
import { createApp } from '../../src/server';
import { DatabaseTestHelper } from '../helpers/database.helper';

// Configuration du test
const MESSAGE_COUNT = 10;
const INTER_MESSAGE_DELAY_MS = 50; // Petit délai pour éviter race conditions

// Mock BullMQ pour capturer les jobs enqueués
const enqueuedJobs: Array<{ name: string; data: any }> = [];

vi.mock('../../src/jobs/index', () => ({
  addJob: vi.fn().mockImplementation(async (name: string, data: any) => {
    enqueuedJobs.push({ name, data });
    return { id: `mock-job-${enqueuedJobs.length}` };
  }),
  getQueueStats: vi.fn().mockResolvedValue({
    incomingMessages: { waiting: 0, active: 0, completed: enqueuedJobs.length },
  }),
}));

/**
 * Helper pour attendre un délai
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Générer un payload 360dialog simulé
 */
function generate360dialogPayload(index: number, toPhone: string) {
  const messageId = `load_test_msg_${Date.now()}_${index}`;
  const timestamp = Math.floor(Date.now() / 1000).toString();

  return {
    messages: [
      {
        id: messageId,
        from: `21260000${String(index).padStart(4, '0')}`, // Numéros uniques
        to: toPhone.replace('+', ''),
        timestamp,
        type: 'text',
        text: {
          body: `Message de test #${index + 1} - Load test pipeline Boss 1`,
        },
      },
    ],
  };
}

describe('WhatsApp Pipeline Load Test - 10 Messages Consécutifs', () => {
  let app: FastifyInstance;
  let request: supertest.SuperTest<supertest.Test>;
  
  // Test data
  let testTenant: any;
  let testChannel: any;
  let testAssistant: any;
  const channelPhone = '+212677777777';

  beforeAll(async () => {
    // Reset des jobs capturés
    enqueuedJobs.length = 0;

    // Créer l'application Fastify
    app = await createApp();
    await app.ready();
    request = supertest(app.server);

    // Préparer les données de test
    await DatabaseTestHelper.cleanup();
    
    // Créer un tenant de test
    testTenant = await DatabaseTestHelper.createTestTenant('loadtest');
    
    // Créer un canal WhatsApp avec un numéro spécifique
    testChannel = await DatabaseTestHelper.createTestChannel(testTenant.id, 'loadtest');
    await db
      .update(schema.channels)
      .set({ 
        whatsappPhoneNumber: channelPhone,
        type: 'whatsapp',
        isActive: true,
      })
      .where(eq(schema.channels.id, testChannel.id));

    // Créer un assistant par défaut
    testAssistant = await DatabaseTestHelper.createTestAssistant(testTenant.id, 'loadtest');
  }, 30000); // 30s pour le setup

  afterAll(async () => {
    await DatabaseTestHelper.cleanup();
    await app.close();
  });

  describe(`POST /api/v1/whatsapp/webhook - ${MESSAGE_COUNT} messages consécutifs`, () => {
    
    it(`devrait accepter ${MESSAGE_COUNT} requêtes HTTP avec status 200`, async () => {
      const responses: supertest.Response[] = [];

      for (let i = 0; i < MESSAGE_COUNT; i++) {
        const payload = generate360dialogPayload(i, channelPhone);
        
        const response = await request
          .post('/api/v1/whatsapp/webhook')
          .send(payload)
          .expect(200);

        responses.push(response);

        // Petit délai entre les messages
        if (i < MESSAGE_COUNT - 1 && INTER_MESSAGE_DELAY_MS > 0) {
          await sleep(INTER_MESSAGE_DELAY_MS);
        }
      }

      // Vérifier que toutes les réponses sont OK
      expect(responses).toHaveLength(MESSAGE_COUNT);
      
      for (let i = 0; i < responses.length; i++) {
        const response = responses[i]!;
        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
          status: 'accepted',
          tenantId: testTenant.id,
          channelId: testChannel.id,
          conversationId: expect.any(String),
          messageId: expect.any(String),
        });
      }
    }, 60000); // 60s timeout pour ce test

    it(`devrait avoir inséré ${MESSAGE_COUNT} messages USER en DB`, async () => {
      // Récupérer toutes les conversations du tenant de test
      const conversations = await db
        .select()
        .from(schema.conversations)
        .where(eq(schema.conversations.tenantId, testTenant.id));

      // Récupérer tous les messages inbound de ces conversations
      const conversationIds = conversations.map(c => c.id);
      
      let totalInboundMessages = 0;
      
      for (const convId of conversationIds) {
        const messages = await db
          .select()
          .from(schema.messages)
          .where(
            and(
              eq(schema.messages.conversationId, convId),
              eq(schema.messages.direction, 'inbound')
            )
          );
        totalInboundMessages += messages.length;
      }

      expect(totalInboundMessages).toBe(MESSAGE_COUNT);
    });

    it(`devrait avoir enqueué ${MESSAGE_COUNT} jobs vers 'whatsapp:process-incoming'`, async () => {
      // Vérifier les jobs capturés par le mock
      const whatsappJobs = enqueuedJobs.filter(
        job => job.name === 'whatsapp:process-incoming'
      );

      expect(whatsappJobs).toHaveLength(MESSAGE_COUNT);

      // Vérifier la structure des jobs
      for (const job of whatsappJobs) {
        expect(job.data).toMatchObject({
          tenantId: testTenant.id,
          channelId: testChannel.id,
          conversationId: expect.any(String),
          messageId: expect.any(String),
          from: expect.stringMatching(/^\+212/),
          message: {
            type: 'text',
            content: expect.stringContaining('Load test pipeline Boss 1'),
          },
        });
      }
    });

    it('devrait avoir créé des conversations cohérentes', async () => {
      // Chaque message vient d'un numéro différent, donc devrait créer 10 conversations
      const conversations = await db
        .select()
        .from(schema.conversations)
        .where(eq(schema.conversations.tenantId, testTenant.id));

      // 10 expéditeurs différents = 10 conversations
      expect(conversations).toHaveLength(MESSAGE_COUNT);

      // Vérifier que chaque conversation est active et liée au bon channel
      for (const conv of conversations) {
        expect(conv.channelId).toBe(testChannel.id);
        expect(conv.assistantId).toBe(testAssistant.id);
        expect(conv.status).toBe('active');
      }
    });

    it('devrait avoir des messages avec des externalId uniques', async () => {
      const conversations = await db
        .select()
        .from(schema.conversations)
        .where(eq(schema.conversations.tenantId, testTenant.id));

      const conversationIds = conversations.map(c => c.id);
      
      const allMessages: any[] = [];
      
      for (const convId of conversationIds) {
        const messages = await db
          .select()
          .from(schema.messages)
          .where(eq(schema.messages.conversationId, convId));
        allMessages.push(...messages);
      }

      // Vérifier l'unicité des externalId
      const externalIds = allMessages
        .filter(m => m.externalId)
        .map(m => m.externalId);
      
      const uniqueExternalIds = new Set(externalIds);
      expect(uniqueExternalIds.size).toBe(externalIds.length);
    });
  });

  describe('Vérification du webhook legacy déprécié', () => {
    it('devrait retourner 410 Gone sur POST /whatsapp/webhook', async () => {
      const payload = generate360dialogPayload(999, channelPhone);
      
      const response = await request
        .post('/whatsapp/webhook')
        .send(payload)
        .expect(410);

      expect(response.body).toMatchObject({
        error: 'deprecated',
        message: expect.stringContaining('deprecated'),
        use: '/api/v1/whatsapp/webhook',
      });
    });
  });
}, 90000); // 90s timeout global pour la suite
