/**
 * ================================
 * WhatsApp Provider Factory - Sylion Backend
 * ================================
 * 
 * Factory pour sélectionner le bon provider WhatsApp selon l'environnement.
 * - Development/Test: Mock Provider (pas d'appels réseau)
 * - Production: 360dialog Provider (appels réels)
 * - Dry-run mode: 360dialog Provider with API calls skipped
 * - Live-test mode: 360dialog Provider for single test messages
 * 
 * Priority: WHATSAPP_LIVE_TEST > WHATSAPP_DRY_RUN > WHATSAPP_MOCK_PROVIDER > NODE_ENV
 */

import { config } from '@/config/env';
import { logger } from '@/lib/logger';
import type { SendTextMessageOptions, WhatsAppSendResponse } from './types';
import { isDryRunMode, isLiveTestMode, WhatsApp360dialogProvider, whatsApp360dialogProvider } from './whatsapp.provider.360dialog';
import { IWhatsAppProvider, WhatsAppMockProvider, whatsAppMockProvider } from './whatsapp.provider.mock';

/**
 * Type d'environnement pour le provider
 */
export type ProviderMode = 'mock' | 'real';

/**
 * Déterminer le mode du provider selon l'environnement
 * Priority: WHATSAPP_LIVE_TEST > WHATSAPP_DRY_RUN > WHATSAPP_MOCK_PROVIDER > NODE_ENV
 */
function getProviderMode(): ProviderMode {
  // Priority 0: Live test mode forces real provider (for single test messages)
  if (isLiveTestMode()) {
    return 'real';
  }

  // Priority 1: Dry-run mode forces real provider (with API calls skipped internally)
  if (isDryRunMode()) {
    return 'real';
  }

  // Priority 2: Forcer le mock si variable d'environnement définie
  if (process.env['WHATSAPP_MOCK_PROVIDER'] === 'true') {
    return 'mock';
  }

  // Priority 3: Forcer le provider réel si variable d'environnement définie
  if (process.env['WHATSAPP_MOCK_PROVIDER'] === 'false') {
    return 'real';
  }

  // Default: mock en dev/test, réel en production
  if (config.isDev || config.isTest) {
    return 'mock';
  }

  return 'real';
}

/**
 * Provider instance singleton
 */
let providerInstance: IWhatsAppProvider | null = null;
let currentMode: ProviderMode | null = null;

/**
 * Obtenir l'instance du provider WhatsApp
 * Utilise le mock en dev/test, le réel en production
 */
export function getWhatsAppProvider(): IWhatsAppProvider {
  const mode = getProviderMode();

  // Si l'instance existe et le mode n'a pas changé, réutiliser
  if (providerInstance && currentMode === mode) {
    return providerInstance;
  }

  // Créer une nouvelle instance selon le mode
  if (mode === 'mock') {
    logger.info('[Factory] Using WhatsApp MOCK Provider', { mode });
    providerInstance = whatsAppMockProvider;
  } else {
    const dryRun = isDryRunMode();
    const liveTest = isLiveTestMode();
    
    // Safety warning: real provider in dev/test environment
    if ((config.isDev || config.isTest) && !dryRun) {
      logger.warn('[Factory] ⚠️ REAL 360dialog provider selected in dev/test environment', {
        mode,
        liveTest,
        dryRun,
        warning: 'Real API calls will be made - ensure this is intentional',
      });
    }
    
    logger.info('[Factory] Using WhatsApp REAL Provider (360dialog)', { 
      mode, 
      dryRun,
      liveTest,
      note: liveTest ? 'Live test mode - single test messages only' 
          : dryRun ? 'API calls will be skipped' 
          : 'Live API calls enabled',
    });
    providerInstance = whatsApp360dialogProvider;
  }

  currentMode = mode;
  return providerInstance;
}

/**
 * Forcer l'utilisation du mock provider (pour les tests)
 */
export function useMockProvider(): WhatsAppMockProvider {
  providerInstance = whatsAppMockProvider;
  currentMode = 'mock';
  return whatsAppMockProvider;
}

/**
 * Forcer l'utilisation du provider réel (360dialog)
 */
export function useRealProvider(): WhatsApp360dialogProvider {
  providerInstance = whatsApp360dialogProvider;
  currentMode = 'real';
  return whatsApp360dialogProvider;
}

/**
 * Réinitialiser le provider (pour les tests)
 */
export function resetProvider(): void {
  providerInstance = null;
  currentMode = null;
}

/**
 * Helper functions pour utilisation simplifiée
 */
export async function sendWhatsAppMessage(
  to: string,
  text: string,
  options?: SendTextMessageOptions
): Promise<WhatsAppSendResponse> {
  const provider = getWhatsAppProvider();
  return provider.sendTextMessage(to, text, options);
}

export async function validateWhatsAppConfig(): Promise<boolean> {
  const provider = getWhatsAppProvider();
  return provider.validateConfiguration();
}
