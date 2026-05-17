const Queue = require('bull');

class QueueService {
    constructor(config, logger) {
        this.config = config.queue;
        this.logger = logger;
        this.queues = {};
        this.workers = {};
    }

    createQueue(name, options = {}) {
        const queueConfig = {
            redis: this.config.redis,
            defaultJobOptions: {
                attempts: this.config.attempts,
                backoff: {
                    type: 'exponential',
                    delay: 2000,
                },
                removeOnComplete: 50,
                removeOnFail: 20,
            },
            ...options,
        };

        this.queues[name] = new Queue(name, queueConfig);
        this.logger.info(`[QUEUE] Created queue: ${name}`);

        // Add event listeners
        this.queues[name].on('completed', (job) => {
            this.logger.debug(`[QUEUE:${name}] Job ${job.id} completed`);
        });

        this.queues[name].on('failed', (job, err) => {
            this.logger.error(`[QUEUE:${name}] Job ${job.id} failed:`, err);
        });

        this.queues[name].on('stalled', (jobId) => {
            this.logger.warn(`[QUEUE:${name}] Job ${jobId} stalled`);
        });

        return this.queues[name];
    }

    addWorker(queueName, processor, concurrency = this.config.concurrency) {
        if (!this.queues[queueName]) {
            throw new Error(`Queue ${queueName} does not exist`);
        }

        this.workers[queueName] = this.queues[queueName].process(concurrency, processor);
        this.logger.info(`[QUEUE] Added worker for queue: ${queueName} (concurrency: ${concurrency})`);

        return this.workers[queueName];
    }

    async addJob(queueName, jobName, data, options = {}) {
        if (!this.queues[queueName]) {
            throw new Error(`Queue ${queueName} does not exist`);
        }

        try {
            const job = await this.queues[queueName].add(jobName, data, options);
            this.logger.debug(`[QUEUE:${queueName}] Added job ${job.id}: ${jobName}`);
            return job;
        } catch (error) {
            this.logger.error(`[QUEUE:${queueName}] Failed to add job ${jobName}:`, error);
            throw error;
        }
    }

    getQueue(queueName) {
        return this.queues[queueName];
    }

    async getJobCounts(queueName) {
        if (!this.queues[queueName]) return null;
        return this.queues[queueName].getJobCounts();
    }

    async closeAll() {
        const promises = Object.values(this.queues).map(queue => queue.close());
        await Promise.all(promises);
        this.logger.info('[QUEUE] All queues closed');
    }

    // Specific queue methods for common use cases
    async addAIJob(data, priority = 0) {
        return this.addJob('ai', 'process_ai_request', data, { priority });
    }

    async addAuditJob(data) {
        return this.addJob('audit', 'process_audit', data, { delay: 1000 });
    }

    async addNotificationJob(data) {
        return this.addJob('notification', 'send_notification', data);
    }

    async addBackupJob(data) {
        return this.addJob('backup', 'create_backup', data, { delay: 5000 });
    }
}

function createQueueService(config, logger) {
    return new QueueService(config, logger);
}

module.exports = { createQueueService };