/**
 * ================================
 * RAG Integration Tests - Sylion Backend
 * ================================
 * 
 * Tests d'intégration pour le système RAG complet.
 * Nécessite une base de données avec pgvector.
 */

import { db, schema } from '@/db/index';
import { eq, sql } from 'drizzle-orm';
import { vi } from 'vitest';

// Mock du service d'embedding pour les tests
vi.mock('@/lib/embedding', () => ({
  generateEmbedding: vi.fn().mockImplementation(async () => {
    // Générer un embedding déterministe
    return new Array(768).fill(0).map((_, i) => Math.sin(i) * 0.5);
  }),
  generateBatchEmbeddings: vi.fn().mockImplementation(async () => {
    return [new Array(768).fill(0).map((_, i) => Math.sin(i) * 0.5)];
  }),
  EMBEDDING_DIMENSIONS: 768,
}));

import {
    documentService,
    ragService
} from '@/modules/rag';

describe('RAG Integration Tests', () => {
  let testTenantId: string;
  let testDocumentId: string;

  beforeAll(async () => {
    // Créer un tenant de test
    const tenantResult = await db
      .insert(schema.tenants)
      .values({
        name: 'RAG Test Tenant',
        slug: `rag-test-${Date.now()}`,
        isActive: true,
        plan: 'pro',
      })
      .returning();
    
    testTenantId = tenantResult[0]!.id;
  });

  afterAll(async () => {
    // Nettoyer les données de test
    if (testDocumentId) {
      await db.delete(schema.documentChunks)
        .where(eq(schema.documentChunks.documentId, testDocumentId));
      await db.delete(schema.documents)
        .where(eq(schema.documents.id, testDocumentId));
    }
    
    if (testTenantId) {
      await db.delete(schema.tenants)
        .where(eq(schema.tenants.id, testTenantId));
    }
  });

  describe('Document Indexing', () => {
    it('should create and index a document', async () => {
      const testContent = `
# Guide d'inscription scolaire

## Étape 1: Documents requis
Pour inscrire votre enfant, vous devez fournir:
- Carte d'identité nationale des parents
- Certificat de naissance de l'enfant
- Photos d'identité (4 exemplaires)
- Certificat de scolarité de l'année précédente

## Étape 2: Frais d'inscription
Les frais d'inscription sont les suivants:
- Maternelle: 1500 DH
- Primaire: 2000 DH
- Collège: 2500 DH
- Lycée: 3000 DH

## Étape 3: Dates importantes
- Ouverture des inscriptions: 1er Juin
- Clôture des inscriptions: 15 Septembre
- Rentrée scolaire: 5 Septembre
      `.trim();

      const result = await documentService.uploadAndIndexDocument(testTenantId, {
        name: 'Guide Inscription.md',
        type: 'md',
        content: testContent,
        metadata: { category: 'administrative' },
        uploadedBy: 'test-user',
      });

      testDocumentId = result.documentId;

      expect(result.success).toBe(true);
      expect(result.chunksCreated).toBeGreaterThan(0);
      expect(result.totalTokens).toBeGreaterThan(0);

      // Vérifier que le document est bien indexé
      const document = await documentService.getDocumentById(result.documentId, testTenantId);
      expect(document).not.toBeNull();
      expect(document!.status).toBe('indexed');
      expect(document!.chunkCount).toBe(result.chunksCreated);
    });

    it('should detect duplicate documents by hash', async () => {
      const content = 'This is duplicate content for testing.';
      
      // Premier upload
      const result1 = await documentService.createDocument(testTenantId, {
        name: 'Duplicate Test 1.txt',
        type: 'txt',
        content,
      });

      // Deuxième upload avec le même contenu
      const result2 = await documentService.createDocument(testTenantId, {
        name: 'Duplicate Test 2.txt',
        type: 'txt',
        content,
      });

      // Devrait retourner le même document
      expect(result1.id).toBe(result2.id);

      // Cleanup
      await db.delete(schema.documents)
        .where(eq(schema.documents.id, result1.id));
    });

    it('should fail gracefully on empty content', async () => {
      const result = await documentService.uploadAndIndexDocument(testTenantId, {
        name: 'Empty.txt',
        type: 'txt',
        content: '',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('RAG Search', () => {
    beforeAll(async () => {
      // S'assurer qu'il y a un document indexé pour les tests de recherche
      if (!testDocumentId) {
        const result = await documentService.uploadAndIndexDocument(testTenantId, {
          name: 'Search Test Doc.md',
          type: 'md',
          content: `
# FAQ École

## Question: Quels sont les frais d'inscription?
Les frais d'inscription varient selon le niveau:
- Maternelle: 1500 DH par an
- Primaire: 2000 DH par an

## Question: Quels documents sont nécessaires?
Vous devez apporter la carte d'identité et le certificat de naissance.
          `,
        });
        testDocumentId = result.documentId;
      }
    });

    it('should search and find relevant chunks', async () => {
      // Note: Ce test nécessite que les embeddings soient réellement stockés
      // Dans un environnement de test, on vérifie la structure de réponse
      
      const mockEmbedding = new Array(768).fill(0.1);
      
      // Utiliser une requête SQL directe pour vérifier la présence de chunks
      const chunksResult = await db.execute(sql`
        SELECT COUNT(*) as count 
        FROM document_chunks 
        WHERE tenant_id = ${testTenantId}
      `);
      
      // Type assertion pour accéder aux rows (Drizzle retourne RowList)
      const rows = chunksResult as unknown as Array<{ count: string }>;
      const chunkCount = parseInt(rows[0]?.count || '0', 10);
      
      // Si des chunks existent, tester la recherche
      if (chunkCount > 0) {
        // La recherche réelle nécessiterait des embeddings valides
        // Pour ce test, on vérifie que la fonction ne crash pas
        const results = await ragService.searchSimilarChunks(
          testTenantId,
          mockEmbedding,
          { maxResults: 5, threshold: 0.0 } // Seuil bas pour attraper tout
        );
        
        expect(Array.isArray(results)).toBe(true);
      }
    });

    it('should respect tenant isolation in search', async () => {
      // Créer un autre tenant
      const otherTenantResult = await db
        .insert(schema.tenants)
        .values({
          name: 'Other Tenant',
          slug: `other-tenant-${Date.now()}`,
        })
        .returning();
      
      const otherTenantId = otherTenantResult[0]!.id;
      
      try {
        // Rechercher dans l'autre tenant (devrait être vide)
        const mockEmbedding = new Array(768).fill(0.1);
        const results = await ragService.searchSimilarChunks(
          otherTenantId,
          mockEmbedding,
          { maxResults: 5, threshold: 0.0 }
        );
        
        // Ne devrait pas trouver les documents du premier tenant
        expect(results.length).toBe(0);
      } finally {
        // Cleanup
        await db.delete(schema.tenants)
          .where(eq(schema.tenants.id, otherTenantId));
      }
    });

    it('should build RAG context correctly', async () => {
      const mockResults = [
        {
          chunkId: 'c1',
          documentId: 'd1',
          documentName: 'Doc 1',
          content: 'Content 1',
          score: 0.9,
          chunkIndex: 0,
          tokenCount: 100,
          metadata: {},
        },
        {
          chunkId: 'c2',
          documentId: 'd2',
          documentName: 'Doc 2',
          content: 'Content 2',
          score: 0.8,
          chunkIndex: 0,
          tokenCount: 150,
          metadata: {},
        },
      ];
      
      const context = ragService.buildRagContext(mockResults, 'test query', 2000);
      
      expect(context.chunks).toHaveLength(2);
      expect(context.totalTokens).toBe(250);
      expect(context.documentsUsed).toContain('d1');
      expect(context.documentsUsed).toContain('d2');
      expect(context.searchQuery).toBe('test query');
    });
  });

  describe('Tenant RAG Stats', () => {
    it('should return correct stats for tenant', async () => {
      const stats = await ragService.getTenantRagStats(testTenantId);
      
      expect(stats).toHaveProperty('documentsCount');
      expect(stats).toHaveProperty('indexedDocumentsCount');
      expect(stats).toHaveProperty('chunksCount');
      expect(stats).toHaveProperty('totalTokens');
      
      expect(typeof stats.documentsCount).toBe('number');
      expect(stats.documentsCount).toBeGreaterThanOrEqual(0);
    });

    it('should check if tenant has documents', async () => {
      const hasDocuments = await ragService.hasTenantDocuments(testTenantId);
      
      // Devrait être true si on a indexé un document
      if (testDocumentId) {
        expect(hasDocuments).toBe(true);
      }
    });

    it('should return false for tenant without documents', async () => {
      const fakeTenantId = '00000000-0000-0000-0000-000000000000';
      const hasDocuments = await ragService.hasTenantDocuments(fakeTenantId);
      
      expect(hasDocuments).toBe(false);
    });
  });

  describe('Document Management', () => {
    it('should list documents by tenant', async () => {
      const documents = await documentService.getDocumentsByTenant(testTenantId);
      
      expect(Array.isArray(documents)).toBe(true);
      
      // Chaque document doit appartenir au bon tenant
      documents.forEach(doc => {
        expect(doc.tenantId).toBe(testTenantId);
      });
    });

    it('should filter documents by status', async () => {
      const indexedDocs = await documentService.getDocumentsByTenant(testTenantId, {
        status: 'indexed',
      });
      
      indexedDocs.forEach(doc => {
        expect(doc.status).toBe('indexed');
      });
    });

    it('should delete document and its chunks', async () => {
      // Créer un document à supprimer
      const result = await documentService.uploadAndIndexDocument(testTenantId, {
        name: 'To Delete.txt',
        type: 'txt',
        content: 'This document will be deleted.',
      });

      const docId = result.documentId;
      
      // Vérifier qu'il existe
      const docBefore = await documentService.getDocumentById(docId, testTenantId);
      expect(docBefore).not.toBeNull();
      
      // Supprimer
      const deleted = await documentService.deleteDocument(docId, testTenantId);
      expect(deleted).toBe(true);
      
      // Vérifier qu'il n'existe plus
      const docAfter = await documentService.getDocumentById(docId, testTenantId);
      expect(docAfter).toBeNull();
      
      // Vérifier que les chunks sont aussi supprimés
      const chunksResult = await db.execute(sql`
        SELECT COUNT(*) as count 
        FROM document_chunks 
        WHERE document_id = ${docId}
      `);
      // Type assertion pour accéder aux rows (Drizzle retourne RowList)
      const rows = chunksResult as unknown as Array<{ count: string }>;
      const chunkCount = parseInt(rows[0]?.count || '0', 10);
      expect(chunkCount).toBe(0);
    });
  });
});
