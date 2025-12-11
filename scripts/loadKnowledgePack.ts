/**
 * ================================
 * Knowledge Pack Loader - Sylion Backend
 * ================================
 *
 * Script pour charger le Knowledge Pack depuis /knowledge
 * dans la base de connaissances interne et l'indexer pour RAG.
 *
 * Usage: npx ts-node -r tsconfig-paths/register scripts/loadKnowledgePack.ts
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";

// Imports adaptés au backend Sylion
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { documentChunks, documents, tenants } from "../src/db/schema";
import { generateEmbedding } from "../src/lib/embedding";
import { chunkText } from "../src/modules/rag/chunker";

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");
const INTERNAL_TENANT_SLUG = "SYLION_INTERNAL";

/**
 * Calcule le hash SHA-256 d'un contenu
 */
function computeHash(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

async function main() {
  console.log("🔵 Loading SylionAI Knowledge Pack into backend…");

  // Vérifier que le dossier knowledge existe
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    throw new Error(`❌ Knowledge directory not found: ${KNOWLEDGE_DIR}`);
  }

  // 1. Obtenir ou créer le tenant interne SYLION_INTERNAL
  let [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, INTERNAL_TENANT_SLUG))
    .limit(1);

  if (!tenant) {
    console.log("🟡 Creating internal tenant SYLION_INTERNAL…");
    const [created] = await db
      .insert(tenants)
      .values({
        slug: INTERNAL_TENANT_SLUG,
        name: "SylionAI Internal Knowledge Base",
        isActive: true,
        plan: "enterprise",
        contactEmail: "system@sylion.ai",
      })
      .returning();
    tenant = created;
    console.log(`✅ Internal tenant created with ID: ${tenant.id}`);
  } else {
    console.log(`✅ Found existing internal tenant: ${tenant.id}`);
  }

  const tenantId = tenant.id;

  // 2. Purger les anciens documents de ce tenant (Knowledge Pack uniquement)
  console.log("🟡 Clearing previous Knowledge Pack documents…");

  // Récupérer les documents existants pour ce tenant avec le tag knowledge_pack
  const existingDocs = await db
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.tenantId, tenantId));

  if (existingDocs.length > 0) {
    console.log(`   Deleting ${existingDocs.length} existing documents…`);
    for (const doc of existingDocs) {
      // Les chunks sont supprimés en cascade grâce à ON DELETE CASCADE
      await db.delete(documents).where(eq(documents.id, doc.id));
    }
  }

  // 3. Lecture des fichiers markdown
  const files = fs
    .readdirSync(KNOWLEDGE_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort();

  console.log(`📚 Found ${files.length} markdown files.`);

  let totalChunks = 0;
  let totalTokens = 0;

  for (const filename of files) {
    const fullPath = path.join(KNOWLEDGE_DIR, filename);
    const content = fs.readFileSync(fullPath, "utf8");
    const hash = computeHash(content);
    const size = Buffer.byteLength(content, "utf8");

    console.log(`📄 Indexing ${filename}…`);

    // 3.1 Insert document
    const [doc] = await db
      .insert(documents)
      .values({
        tenantId,
        name: filename,
        type: "markdown",
        size,
        hash,
        storageUrl: `file://${fullPath}`, // URL locale pour les fichiers knowledge
        metadata: {
          source: "knowledge_pack",
          originalPath: fullPath,
        },
        status: "processing",
      })
      .returning();

    const docId = doc.id;

    // 3.2 Chunking du contenu
    const chunks = chunkText(content, { chunkSize: 800 });
    console.log(`   → ${chunks.length} chunks created`);

    let docTokens = 0;

    // 3.3 Générer les embeddings et insérer les chunks
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;

      try {
        // Générer l'embedding pour ce chunk
        const embedding = await generateEmbedding(chunk.content, {
          taskType: "RETRIEVAL_DOCUMENT",
        });

        // Insérer le chunk avec son embedding
        await db.insert(documentChunks).values({
          documentId: docId,
          tenantId,
          content: chunk.content,
          chunkIndex: chunk.index,
          embedding: JSON.stringify(embedding), // Stocké en JSON (text) pour le moment
          tokenCount: chunk.tokenCount,
          metadata: {
            filename,
            ...chunk.metadata,
          },
        });

        docTokens += chunk.tokenCount;
        totalChunks++;

        // Petit délai pour éviter le rate limiting
        if (i > 0 && i % 10 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`   ❌ Error embedding chunk ${i} of ${filename}:`, error);
        throw error;
      }
    }

    totalTokens += docTokens;

    // 3.4 Mettre à jour le document avec les stats
    await db
      .update(documents)
      .set({
        status: "indexed",
        chunkCount: chunks.length,
        totalTokens: docTokens,
        indexedAt: new Date(),
        processedAt: new Date(),
      })
      .where(eq(documents.id, docId));

    console.log(`   ✅ ${filename}: ${chunks.length} chunks, ${docTokens} tokens`);
  }

  console.log("");
  console.log("═══════════════════════════════════════════════════════");
  console.log("✅ SylionAI Knowledge Pack successfully indexed!");
  console.log(`   📁 Documents: ${files.length}`);
  console.log(`   📦 Total chunks: ${totalChunks}`);
  console.log(`   🔢 Total tokens: ${totalTokens}`);
  console.log(`   🏢 Tenant ID: ${tenantId}`);
  console.log("═══════════════════════════════════════════════════════");

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error while loading Knowledge Pack:", err);
  process.exit(1);
});
