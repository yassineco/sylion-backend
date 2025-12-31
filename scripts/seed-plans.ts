/**
 * ================================
 * Seed Plans - Sylion Backend
 * ================================
 * 
 * Script pour créer les plans Starter/Pro/Business/Enterprise en base de données.
 * Les limites sont stockées en JSON pour permettre une modification sans redéploiement.
 * 
 * Usage: npx tsx scripts/seed-plans.ts
 * 
 * @module scripts/seed-plans
 */

import { eq } from 'drizzle-orm';
import { db, schema } from '../src/db/index';
import { DEFAULT_PLAN_LIMITS, type PlanCode } from '../src/modules/quota/quota.types';

interface PlanSeed {
  code: PlanCode;
  name: string;
  description: string;
  priceMonthly: string | null;
  sortOrder: number;
}

const PLANS_TO_SEED: PlanSeed[] = [
  {
    code: 'starter',
    name: 'Starter',
    description: 'Plan gratuit pour démarrer avec Sylion AI. Idéal pour les tests et petits projets.',
    priceMonthly: null, // Gratuit
    sortOrder: 1,
  },
  {
    code: 'pro',
    name: 'Pro',
    description: 'Plan professionnel pour les PME. Inclut RAG avancé et support prioritaire.',
    priceMonthly: '49.00',
    sortOrder: 2,
  },
  {
    code: 'business',
    name: 'Business',
    description: 'Plan business pour les entreprises. Volumes élevés et branding personnalisé.',
    priceMonthly: '199.00',
    sortOrder: 3,
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    description: 'Plan entreprise sur mesure. Limites illimitées et support dédié.',
    priceMonthly: null, // Sur devis
    sortOrder: 4,
  },
];

async function seedPlans(): Promise<void> {
  console.log('🌱 Seeding plans...\n');

  for (const plan of PLANS_TO_SEED) {
    try {
      // Vérifier si le plan existe déjà
      const existing = await db
        .select()
        .from(schema.plans)
        .where(eq(schema.plans.code, plan.code))
        .limit(1);

      if (existing.length > 0) {
        console.log(`⏭️  Plan "${plan.code}" already exists, updating...`);
        
        // Mettre à jour le plan existant
        await db
          .update(schema.plans)
          .set({
            name: plan.name,
            description: plan.description,
            limitsJson: DEFAULT_PLAN_LIMITS[plan.code],
            priceMonthly: plan.priceMonthly,
            sortOrder: plan.sortOrder,
            updatedAt: new Date(),
          })
          .where(eq(schema.plans.code, plan.code));

        console.log(`   ✅ Updated "${plan.code}"`);
      } else {
        // Créer le nouveau plan
        await db.insert(schema.plans).values({
          code: plan.code,
          name: plan.name,
          description: plan.description,
          limitsJson: DEFAULT_PLAN_LIMITS[plan.code],
          priceMonthly: plan.priceMonthly,
          priceCurrency: 'EUR',
          isActive: true,
          sortOrder: plan.sortOrder,
        });

        console.log(`   ✅ Created "${plan.code}"`);
      }

      // Afficher les limites du plan
      const limits = DEFAULT_PLAN_LIMITS[plan.code];
      console.log(`      📊 Limits:`);
      console.log(`         - Max Documents: ${limits.maxDocuments === -1 ? '∞' : limits.maxDocuments}`);
      console.log(`         - Max Storage: ${limits.maxStorageMb === -1 ? '∞' : limits.maxStorageMb + 'MB'}`);
      console.log(`         - Daily Indexing: ${limits.maxDailyIndexing === -1 ? '∞' : limits.maxDailyIndexing}`);
      console.log(`         - Daily RAG Queries: ${limits.maxDailyRagQueries === -1 ? '∞' : limits.maxDailyRagQueries}`);
      console.log(`         - Daily Messages: ${limits.maxDailyMessages === -1 ? '∞' : limits.maxDailyMessages}`);
      console.log('');

    } catch (error) {
      console.error(`❌ Error seeding plan "${plan.code}":`, error);
    }
  }

  console.log('\n✨ Plans seeding completed!\n');
}

// Exécuter le script
seedPlans()
  .then(() => {
    console.log('Done.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
