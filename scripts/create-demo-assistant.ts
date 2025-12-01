#!/usr/bin/env node

/**
 * ================================
 * Script de création d'assistant SYLION démo
 * ================================
 * 
 * Ce script crée un assistant de démo utilisant le prompt système Sylion
 * par défaut pour un tenant donné.
 * 
 * Usage: npm run create-demo-assistant <tenantId>
 */

import { logger } from '../src/lib/logger';
import { getDefaultSystemPrompt } from '../src/lib/sylion-default-prompt';
import { assistantService } from '../src/modules/assistant/assistant.service';

async function createDemoAssistant(tenantId: string) {
  try {
    logger.info('Creating SYLION demo assistant', { tenantId });

    const assistant = await assistantService.createAssistant(tenantId, {
      name: 'SYLION Assistant – Démo Officielle',
      description: 'Assistant IA professionnel pour entreprises marocaines via WhatsApp',
      isActive: true,
      isDefault: true,
      model: 'gemini-1.5-pro',
      systemPrompt: getDefaultSystemPrompt(),
      temperature: 0.7,
      maxTokens: 1024,
      enableRag: false,
      ragThreshold: 0.7,
      ragMaxResults: 5,
    });

    logger.info('SYLION demo assistant created successfully', {
      assistantId: assistant.id,
      tenantId: assistant.tenantId,
      name: assistant.name,
    });

    console.log('✅ Assistant SYLION créé avec succès !');
    console.log(`📋 ID: ${assistant.id}`);
    console.log(`🏢 Tenant: ${assistant.tenantId}`);
    console.log(`📝 Nom: ${assistant.name}`);
    console.log(`🤖 Modèle: ${assistant.model}`);
    console.log(`⚡ Status: ${assistant.isActive ? 'Actif' : 'Inactif'}`);
    console.log(`🎯 Par défaut: ${assistant.isDefault ? 'Oui' : 'Non'}`);

    process.exit(0);

  } catch (error) {
    logger.error('Error creating demo assistant', {
      tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
    
    console.error('❌ Erreur lors de la création de l\'assistant:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Récupérer l'ID du tenant depuis les arguments de ligne de commande
const tenantId = process.argv[2];

if (!tenantId) {
  console.error('❌ Usage: npm run create-demo-assistant <tenantId>');
  console.error('   Exemple: npm run create-demo-assistant 123e4567-e89b-12d3-a456-426614174000');
  process.exit(1);
}

// Validation basique de l'UUID
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!uuidRegex.test(tenantId)) {
  console.error('❌ L\'ID du tenant doit être un UUID valide');
  process.exit(1);
}

createDemoAssistant(tenantId);