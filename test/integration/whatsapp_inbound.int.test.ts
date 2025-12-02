/**
 * ================================
 * WhatsApp Inbound Integration Tests
 * ================================
 * 
 * Tests d'intégration pour valider le flow complet de réception
 * de messages WhatsApp entrants via webhook.
 * 
 * NOTE: Ce fichier utilisait une API legacy (handleIncomingWebhook du gateway)
 * qui a été remplacée par les routes WhatsApp (whatsapp.routes.ts).
 * Voir whatsapp-webhook.int.test.ts pour les tests à jour.
 * 
 * TODO: Refactoriser ce fichier pour utiliser les nouvelles routes
 * ou supprimer si redondant avec whatsapp-webhook.int.test.ts
 */

// Skip ce fichier de test jusqu'à la refactorisation
describe.skip('WhatsApp Inbound Integration Tests (LEGACY - Needs Refactoring)', () => {
  it('placeholder - see whatsapp-webhook.int.test.ts for up-to-date tests', () => {
    expect(true).toBe(true);
  });
});
