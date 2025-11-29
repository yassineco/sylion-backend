/**
 * ================================
 * Logger - Sylion Backend
 * ================================
 * 
 * Configuration centralisée du logging avec Pino.
 * Respect des règles de sécurité (masquage des données sensibles).
 */

import pino, { Logger } from 'pino';
import { config } from '@/config/env';
import { maskSensitiveData } from '@/config/env';

/**
 * Configuration du transport Pino pour le développement
 */
const developmentTransport = pino.transport({
  target: 'pino-pretty',
  options: {
    colorize: true,
    translateTime: 'HH:MM:ss Z',
    ignore: 'pid,hostname',
    singleLine: false,
  },
});

/**
 * Configuration du logger principal
 */
const loggerConfig = {
  level: config.logging.level,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label: string) => {
      return { level: label.toUpperCase() };
    },
    bindings: () => ({
      service: 'sylion-backend',
      version: process.env['npm_package_version'] || '0.1.0',
      environment: config.isDev ? 'development' : config.isProd ? 'production' : 'test',
    }),
  },
  redact: {
    paths: [
      'password',
      'apiKey',
      'token',
      'authorization',
      'jwt',
      'secret',
      'req.headers.authorization',
      'req.headers["x-api-key"]',
      'req.headers.cookie',
    ],
    censor: '***REDACTED***',
  },
};

/**
 * Création du logger selon l'environnement
 */
const baseLogger: Logger = config.logging.pretty
  ? pino(loggerConfig, developmentTransport)
  : pino(loggerConfig);

/**
 * Interface pour le contexte de logging
 */
export interface LogContext {
  tenantId?: string;
  userId?: string;
  requestId?: string;
  conversationId?: string;
  messageId?: string;
  channelType?: string;
  phoneNumber?: string;
  [key: string]: any;
}

/**
 * Classe Logger personnalisée pour Sylion
 */
class SylionLogger {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Crée un logger enfant avec contexte
   */
  child(context: LogContext): SylionLogger {
    const sanitizedContext = this.sanitizeContext(context);
    return new SylionLogger(this.logger.child(sanitizedContext));
  }

  /**
   * Log de niveau trace
   */
  trace(message: string, context?: LogContext): void {
    this.logger.trace(this.sanitizeContext(context), message);
  }

  /**
   * Log de niveau debug
   */
  debug(message: string, context?: LogContext): void {
    this.logger.debug(this.sanitizeContext(context), message);
  }

  /**
   * Log de niveau info
   */
  info(message: string, context?: LogContext): void {
    this.logger.info(this.sanitizeContext(context), message);
  }

  /**
   * Log de niveau warning
   */
  warn(message: string, context?: LogContext): void {
    this.logger.warn(this.sanitizeContext(context), message);
  }

  /**
   * Log de niveau error
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const sanitizedContext = this.sanitizeContext(context);
    
    if (error instanceof Error) {
      this.logger.error({ 
        ...sanitizedContext, 
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        }
      }, message);
    } else if (error) {
      this.logger.error({ ...sanitizedContext, error }, message);
    } else {
      this.logger.error(sanitizedContext, message);
    }
  }

  /**
   * Log de niveau fatal
   */
  fatal(message: string, error?: Error | unknown, context?: LogContext): void {
    const sanitizedContext = this.sanitizeContext(context);
    
    if (error instanceof Error) {
      this.logger.fatal({ 
        ...sanitizedContext, 
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        }
      }, message);
    } else if (error) {
      this.logger.fatal({ ...sanitizedContext, error }, message);
    } else {
      this.logger.fatal(sanitizedContext, message);
    }
  }

  /**
   * Log pour les requêtes HTTP entrantes
   */
  httpRequest(method: string, url: string, statusCode: number, duration: number, context?: LogContext): void {
    const logData = {
      ...this.sanitizeContext(context),
      http: {
        method,
        url,
        statusCode,
        duration,
      },
    };

    if (statusCode >= 500) {
      this.logger.error(logData, `HTTP ${method} ${url} - ${statusCode} (${duration}ms)`);
    } else if (statusCode >= 400) {
      this.logger.warn(logData, `HTTP ${method} ${url} - ${statusCode} (${duration}ms)`);
    } else {
      this.logger.info(logData, `HTTP ${method} ${url} - ${statusCode} (${duration}ms)`);
    }
  }

  /**
   * Log pour les jobs BullMQ
   */
  jobLog(jobName: string, status: 'started' | 'completed' | 'failed', context?: LogContext & { jobId?: string, duration?: number }): void {
    const logData = {
      ...this.sanitizeContext(context),
      job: {
        name: jobName,
        status,
        id: context?.jobId,
        duration: context?.duration,
      },
    };

    switch (status) {
      case 'started':
        this.logger.info(logData, `Job ${jobName} started`);
        break;
      case 'completed':
        this.logger.info(logData, `Job ${jobName} completed`);
        break;
      case 'failed':
        this.logger.error(logData, `Job ${jobName} failed`);
        break;
    }
  }

  /**
   * Log pour WhatsApp webhook
   */
  whatsappLog(event: string, phoneNumber: string, context?: LogContext): void {
    this.logger.info({
      ...this.sanitizeContext(context),
      whatsapp: {
        event,
        phoneNumber: maskSensitiveData(phoneNumber),
      },
    }, `WhatsApp ${event}`);
  }

  /**
   * Log pour les interactions IA
   */
  aiLog(provider: 'vertex' | 'openai', model: string, tokensUsed?: number, context?: LogContext): void {
    this.logger.info({
      ...this.sanitizeContext(context),
      ai: {
        provider,
        model,
        tokensUsed,
      },
    }, `AI ${provider}/${model} request`);
  }

  /**
   * Sanitise le contexte pour éviter les fuites de données sensibles
   */
  private sanitizeContext(context?: LogContext): LogContext {
    if (!context) return {};

    const sanitized: LogContext = {};
    
    for (const [key, value] of Object.entries(context)) {
      if (typeof value === 'string') {
        // Masquer les numéros de téléphone
        if (key === 'phoneNumber' || key === 'from' || key === 'to') {
          sanitized[key] = maskSensitiveData(value);
        }
        // Masquer les tokens/clés
        else if (key.includes('token') || key.includes('key') || key.includes('secret')) {
          sanitized[key] = maskSensitiveData(value);
        }
        // Autres chaînes
        else {
          sanitized[key] = value;
        }
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Méthode pour obtenir le logger Pino brut (usage interne uniquement)
   */
  get raw(): Logger {
    return this.logger;
  }
}

/**
 * Export du logger principal
 */
export const logger = new SylionLogger(baseLogger);

/**
 * Export des types
 */
export type { SylionLogger };
export default logger;