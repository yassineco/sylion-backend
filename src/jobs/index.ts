/**
 * ================================
 * Jobs Configuration - Sylion Backend
 * ================================
 *
 * Configuration centralisée des workers BullMQ pour le traitement asynchrone.
 * Gestion des queues, workers et jobs pour IA, WhatsApp, RAG, etc.
 */

import { config } from '@/config/env';
import { logger } from '@/lib/logger';
import { redisPublisher, redisSubscriber } from '@/lib/redis';
import { Job, Queue, QueueOptions, Worker, WorkerOptions } from 'bullmq';

/**
 * Détection de l'environnement de test
 */
const isTestEnv =
  process.env['NODE_ENV'] === 'test' ||
  process.env['DISABLE_QUEUES'] === 'true';

/**
 * Mock Redis connection pour les tests
 */
const mockRedisConnection = {
  host: 'localhost',
  port: 6379,
  // Propriétés minimales pour satisfaire l'interface BullMQ
} as any;

/**
 * Configuration de base pour les queues
 */
const baseQueueConfig: QueueOptions = {
  connection: isTestEnv ? mockRedisConnection : redisPublisher,
  defaultJobOptions: {
    removeOnComplete: config.isProd ? 50 : 10,
    removeOnFail: config.isProd ? 50 : 10,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
};

/**
 * Configuration de base pour les workers
 * (les réglages Redis sensibles sont gérés dans lib/redis.ts)
 */
const baseWorkerConfig: Omit<WorkerOptions, 'connection'> = {
  concurrency: config.isProd ? 5 : 2,
  limiter: {
    max: 10,
    duration: 1000,
  },
  // On laisse autorun à true (valeur par défaut),
  // les workers démarrent dès leur création
  autorun: true,
};

/**
 * Définition des types de jobs
 */
export interface JobTypes {
  // Message Processing Jobs
  'incoming-message': {
    messageData: import('@/modules/whatsapp/types').NormalizedIncomingMessage;
    timestamp: string;
  };

  // WhatsApp Jobs
  'whatsapp:send-message': {
    tenantId: string;
    channelId: string;
    to: string;
    message: {
      type: 'text' | 'image' | 'document' | 'audio';
      content: string;
      mediaUrl?: string;
    };
    metadata?: Record<string, any>;
  };

  'whatsapp:process-incoming': {
    tenantId: string;
    channelId: string;
    conversationId: string;
    messageId: string;
    from: string;
    message: {
      type: 'text' | 'image' | 'document' | 'audio';
      content: string;
      mediaUrl?: string;
    };
    timestamp: string;
  };

  // AI Jobs
  'ai:process-message': {
    tenantId: string;
    assistantId: string;
    conversationId: string;
    messageId: string;
    userMessage: string;
    context?: Record<string, any>;
  };

  'ai:generate-response': {
    tenantId: string;
    assistantId: string;
    conversationId: string;
    messageId: string;
    prompt: string;
    context?: string[];
    metadata?: Record<string, any>;
  };

  // RAG Jobs
  'rag:index-document': {
    tenantId: string;
    documentId: string;
    documentUrl: string;
    metadata: {
      name: string;
      type: string;
      size: number;
      uploadedBy: string;
    };
  };

  'rag:search-similar': {
    tenantId: string;
    query: string;
    conversationId: string;
    maxResults?: number;
    threshold?: number;
  };

  'rag:update-embeddings': {
    tenantId: string;
    documentId: string;
    forceReindex?: boolean;
  };

  // System Jobs
  'system:cleanup-conversations': {
    beforeDate: string;
    tenantId?: string;
  };

  'system:update-quotas': {
    tenantId: string;
    period: 'hour' | 'day' | 'month';
  };

  'system:health-check': {
    services: string[];
    timestamp: string;
  };
}

/**
 * Noms des queues
 */
export const QueueNames = {
  INCOMING_MESSAGES: 'incoming-messages',
  WHATSAPP: 'whatsapp',
  AI: 'ai',
  RAG: 'rag',
  SYSTEM: 'system',
} as const;

/**
 * Mock Queue pour les tests
 */
class MockQueue {
  constructor(public name: string, public options: any) {}

  async add(jobName: string, data: any, options?: any): Promise<any> {
    if (isTestEnv) {
      logger.debug(`Mock queue job added: ${this.name}:${jobName}`, { data });
      return { id: `mock_${Date.now()}`, data, opts: options || {} };
    }
    throw new Error('MockQueue should only be used in test environment');
  }

  async close(): Promise<void> {
    // No-op pour mock
  }

  async obliterate(): Promise<void> {
    // No-op pour mock
  }

  async getWaiting(): Promise<any[]> {
    return [];
  }

  async getActive(): Promise<any[]> {
    return [];
  }

  async getCompleted(): Promise<any[]> {
    return [];
  }

  async getFailed(): Promise<any[]> {
    return [];
  }
}

/**
 * Création des queues (réelles ou mock selon l'environnement)
 */
export const queues = isTestEnv
  ? ({
      incomingMessages: new MockQueue(
        QueueNames.INCOMING_MESSAGES,
        baseQueueConfig
      ),
      whatsapp: new MockQueue(QueueNames.WHATSAPP, baseQueueConfig),
      ai: new MockQueue(QueueNames.AI, baseQueueConfig),
      rag: new MockQueue(QueueNames.RAG, baseQueueConfig),
      system: new MockQueue(QueueNames.SYSTEM, baseQueueConfig),
    } as any)
  : {
      incomingMessages: new Queue(QueueNames.INCOMING_MESSAGES, {
        ...baseQueueConfig,
        defaultJobOptions: {
          ...baseQueueConfig.defaultJobOptions,
          priority: 20, // Très haute priorité pour les messages entrants
          delay: 0,
        },
      }),

      whatsapp: new Queue(QueueNames.WHATSAPP, {
        ...baseQueueConfig,
        defaultJobOptions: {
          ...baseQueueConfig.defaultJobOptions,
          priority: 10, // Haute priorité pour WhatsApp
          delay: 0,
        },
      }),

      ai: new Queue(QueueNames.AI, {
        ...baseQueueConfig,
        defaultJobOptions: {
          ...baseQueueConfig.defaultJobOptions,
          priority: 5,
          delay: 1000, // Petit délai pour regrouper les requêtes
        },
      }),

      rag: new Queue(QueueNames.RAG, {
        ...baseQueueConfig,
        defaultJobOptions: {
          ...baseQueueConfig.defaultJobOptions,
          priority: 3,
          attempts: 5, // Plus d'essais pour RAG
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      }),

      system: new Queue(QueueNames.SYSTEM, {
        ...baseQueueConfig,
        defaultJobOptions: {
          ...baseQueueConfig.defaultJobOptions,
          priority: 1,
          attempts: 2,
        },
      }),
    };

/**
 * Interface pour les handlers de jobs
 */
export type JobHandler<T extends keyof JobTypes> = (
  job: Job<JobTypes[T]>
) => Promise<any>;

/**
 * Helper pour enregistrer un handler de job
 */
export function registerJobHandler<T extends keyof JobTypes>(
  jobType: T,
  handler: JobHandler<T>
): void {
  (jobHandlers as any)[jobType] = handler;
  logger.info(`Job handler registered for ${jobType}`);
}

/**
 * Helper pour ajouter un job à une queue
 */
export async function addJob<T extends keyof JobTypes>(
  jobType: T,
  data: JobTypes[T],
  options?: {
    delay?: number;
    priority?: number;
    attempts?: number;
    removeOnComplete?: number | boolean;
    removeOnFail?: number | boolean;
  }
): Promise<Job<JobTypes[T]>> {
  const queueName = getQueueNameForJobType(jobType);
  const queue = (queues as any)[queueName] as Queue;

  if (!queue) {
    throw new Error(`Queue not found for job type: ${jobType}`);
  }

  const job = await queue.add(jobType, data, options);

  logger.info('Job added to queue', {
    jobType,
    jobId: job.id,
    queueName,
    priority: job.opts.priority,
    delay: job.opts.delay,
  });

  return job as Job<JobTypes[T]>;
}

/**
 * Helper pour déterminer la queue selon le type de job
 */
function getQueueNameForJobType(jobType: keyof JobTypes): keyof typeof queues {
  if (jobType.startsWith('incoming-message')) return 'incomingMessages';
  if (jobType.startsWith('whatsapp:')) return 'whatsapp';
  if (jobType.startsWith('ai:')) return 'ai';
  if (jobType.startsWith('rag:')) return 'rag';
  if (jobType.startsWith('system:')) return 'system';

  throw new Error(`Unknown job type: ${jobType}`);
}

/**
 * Fonction principale pour démarrer tous les workers
 */
export async function startWorkers(): Promise<Worker[]> {
  if (isTestEnv) {
    logger.info('Skipping worker startup in test environment');
    return [];
  }

  logger.info('Starting BullMQ workers...');

  const workers: Worker[] = [];

  const createWorker = (
    queueName: string,
    workerName: string,
    concurrency: number
  ): Worker => {
    const worker = new Worker(
      queueName,
      async (job: Job) => {
        const jobType = job.name as keyof JobTypes;
        const handler = jobHandlers[jobType];

        if (!handler) {
          throw new Error(`No handler found for job type: ${jobType}`);
        }

        logger.jobLog(jobType, 'started', { jobId: job.id });
        const startTime = Date.now();

        try {
          const result = await handler(job);
          const duration = Date.now() - startTime;

          logger.jobLog(jobType, 'completed', {
            jobId: job.id,
            duration,
          });

          return result;
        } catch (error) {
          const duration = Date.now() - startTime;

          logger.jobLog(jobType, 'failed', {
            jobId: job.id,
            duration,
          });

          throw error;
        }
      },
      {
        ...baseWorkerConfig,
        connection: redisSubscriber,
        concurrency,
      }
    );

    worker.on('ready', () => {
      logger.info(`Worker ${workerName} ready`);
    });

    worker.on('error', (error: Error) => {
      logger.error(`Worker ${workerName} error`, { error: error.message });
    });

    worker.on('failed', (job: Job | undefined, error: Error) => {
      logger.error(`Job ${job?.id} failed in ${workerName} worker`, {
        error: error.message,
        jobId: job?.id,
      });
    });

    worker.on('completed', (job: Job | undefined) => {
      logger.debug(`Job ${job?.id} completed in ${workerName} worker`);
    });

    return worker;
  };

  // Création des différents workers
  const incomingMessagesWorker = createWorker(
    QueueNames.INCOMING_MESSAGES,
    'Incoming Messages',
    5
  );
  const whatsappWorker = createWorker(QueueNames.WHATSAPP, 'WhatsApp', 10);
  const aiWorker = createWorker(QueueNames.AI, 'AI', 3);
  const ragWorker = createWorker(QueueNames.RAG, 'RAG', 2);
  const systemWorker = createWorker(QueueNames.SYSTEM, 'System', 1);

  workers.push(
    incomingMessagesWorker,
    whatsappWorker,
    aiWorker,
    ragWorker,
    systemWorker
  );

  logger.info('All BullMQ workers started successfully (autorun mode)', {
    workers: workers.length,
  });

  return workers;
}

/**
 * Fonction pour arrêter tous les workers
 */
export async function stopWorkers(workers: Worker[]): Promise<void> {
  if (isTestEnv) {
    logger.info('Skipping worker shutdown in test environment');
    return;
  }

  logger.info('Stopping BullMQ workers...');

  await Promise.all(
    workers.map(async (worker) => {
      try {
        await worker.close();
      } catch (error) {
        logger.error('Error stopping worker', error);
      }
    })
  );

  logger.info('All BullMQ workers stopped');
}

/**
 * ================================
 * Job Handlers - Enregistrement et imports
 * ================================
 */

// Import des handlers de jobs
import {
    processIncomingMessage,
    processWhatsAppIncoming,
} from './messageProcessor.worker';

// Import des handlers RAG
import {
    processRagIndexDocument,
    processRagUpdateEmbeddings,
} from './rag.worker';

/**
 * Mapping des handlers par type de job
 */
const jobHandlers: Record<string, (job: Job) => Promise<any>> = {
  // Messages entrants
  'incoming-message': processIncomingMessage,

  // WhatsApp jobs
  'whatsapp:process-incoming': processWhatsAppIncoming,
  'whatsapp:send-message': async () => {
    throw new Error('WhatsApp send-message handler not implemented');
  },
  'whatsapp:process-status': async () => {
    throw new Error('WhatsApp process-status handler not implemented');
  },

  // AI jobs - à implémenter
  'ai:process-message': async () => {
    throw new Error('AI process-message handler not implemented');
  },
  'ai:generate-response': async () => {
    throw new Error('AI generate-response handler not implemented');
  },

  // RAG jobs - IMPLÉMENTÉS
  'rag:index-document': processRagIndexDocument,
  'rag:search-similar': async () => {
    // Non utilisé comme job queue - la recherche est synchrone dans le worker
    throw new Error('rag:search-similar is a synchronous operation, not a queued job');
  },
  'rag:update-embeddings': processRagUpdateEmbeddings,

  // System jobs - à implémenter
  'system:cleanup-conversations': async () => {
    throw new Error('System cleanup-conversations handler not implemented');
  },
  'system:update-quotas': async () => {
    throw new Error('System update-quotas handler not implemented');
  },
  'system:health-check': async () => {
    throw new Error('System health-check handler not implemented');
  },
};

/**
 * ================================
 * Helper pour ajouter un message entrant à la queue
 * ================================
 */
export async function addIncomingMessageJob(
  messageData: JobTypes['incoming-message']['messageData']
): Promise<void> {
  try {
    const job = await (queues as any).incomingMessages.add(
      'incoming-message',
      {
        messageData,
        timestamp: new Date().toISOString(),
      },
      {
        priority: 20,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      }
    );

    logger.info('Incoming message job added to queue', {
      jobId: job.id,
      // ✅ champs réels de NormalizedIncomingMessage
      messageId: messageData.providerMessageId,
      from: messageData.fromPhone,
    });
  } catch (error) {
    logger.error('Failed to add incoming message job to queue', {
      error: error instanceof Error ? error.message : String(error),
      messageId: messageData.providerMessageId,
    });
    throw error;
  }
}

/**
 * Helper pour obtenir les statistiques des queues
 */
export async function getQueueStats(): Promise<Record<string, any>> {
  if (isTestEnv) {
    return {
      incomingMessages: { waiting: 0, active: 0, completed: 0, failed: 0 },
      whatsapp: { waiting: 0, active: 0, completed: 0, failed: 0 },
      ai: { waiting: 0, active: 0, completed: 0, failed: 0 },
      rag: { waiting: 0, active: 0, completed: 0, failed: 0 },
      system: { waiting: 0, active: 0, completed: 0, failed: 0 },
    };
  }

  const stats: Record<string, any> = {};

  // ✅ Type guard pour savoir si c'est une vraie queue BullMQ
  const isRealQueue = (q: any): q is Queue => {
    return typeof q.getWaiting === 'function';
  };

  for (const [name, queue] of Object.entries(queues as any)) {
    try {
      if (!isRealQueue(queue)) {
        // MockQueue -> stats vides
        stats[name] = { waiting: 0, active: 0, completed: 0, failed: 0 };
        continue;
      }

      const waiting = await queue.getWaiting();
      const active = await queue.getActive();
      const completed = await queue.getCompleted();
      const failed = await queue.getFailed();

      stats[name] = {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
      };

    } catch (error) {
      logger.error(`Error getting stats for queue ${name}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      stats[name] = { error: 'Failed to get stats' };
    }
  }

  return stats;
}

