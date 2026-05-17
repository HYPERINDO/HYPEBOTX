const OpenAI = require('openai');

let hasLoggedMissingApiKey = false;

class AIService {
    constructor(config, queueService, rateLimitService, monitoringService, logger) {
        this.config = config;
        this.queueService = queueService;
        this.rateLimitService = rateLimitService;
        this.monitoringService = monitoringService;
        this.logger = logger;

        const aiEnabled = String(process.env.AI_ENABLED ?? "true").toLowerCase() === "true";
        const apiKey = process.env.OPENAI_API_KEY;
        this.apiKey = apiKey;

        if (!aiEnabled) {
            if (!hasLoggedMissingApiKey) {
                this.logger?.info?.('[AI] AI service disabled by AI_ENABLED=false');
                hasLoggedMissingApiKey = true;
            }
            this.openai = null;
            return;
        }

        if (!apiKey) {
            // Avoid spamming startup warning in long-running process
            if (!hasLoggedMissingApiKey) {
                this.logger?.warn?.('[AI] OPENAI_API_KEY is missing; AI service disabled');
                hasLoggedMissingApiKey = true;
            }

            this.openai = null;
            return;
        }

        // Initialize OpenAI client
        const clientConfig = { apiKey };
        if (apiKey.startsWith('nvapi-')) {
            clientConfig.baseURL = 'https://integrate.api.nvidia.com/v1';
        }
        this.openai = new OpenAI(clientConfig);

        // Create AI processing queue
        this.queueService.createQueue('ai');

        // Add worker for AI requests
        this.queueService.addWorker('ai', this.processAIRequest.bind(this));
    }

    async processRequest(userId, prompt, options = {}) {
        const startTime = Date.now();

        if (!this.openai) {
            return {
                success: true,
                response: this.getFallbackResponse(prompt),
                fallback: true,
            };
        }

        try {
            // Check AI rate limit
            const rateLimitCheck = await this.rateLimitService.checkAILimit(userId);
            if (!rateLimitCheck.allowed) {
                return {
                    success: false,
                    error: `AI rate limit exceeded. Try again later.`,
                };
            }

            // Direct API call (simplified, no queue)
            const completion = await this.openai.chat.completions.create({
                model: options.model || (this.apiKey.startsWith('nvapi-') ? 'openai/gpt-oss-20b' : 'gpt-3.5-turbo'),
                messages: [
                    {
                        role: 'system',
                        content: options.systemPrompt || 'You are a helpful assistant for a gaming community Discord bot.',
                    },
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
                max_tokens: options.maxTokens || 500,
                temperature: options.temperature || 0.7,
            });

            const response = completion.choices[0]?.message?.content || 'No response generated';

            const duration = Date.now() - startTime;
            this.monitoringService.recordAIRequest(duration, true);

            return {
                success: true,
                response,
                duration,
            };

        } catch (error) {
            const duration = Date.now() - startTime;
            this.monitoringService.captureError(error, {
                type: 'ai',
                source: 'processRequest',
                userId,
            });
            this.monitoringService.recordAIRequest(duration, false);

            this.logger.error('[AI] Request failed:', error);

            // Fallback response
            return {
                success: false,
                error: 'AI service temporarily unavailable. Please try again later.',
                fallback: this.getFallbackResponse(prompt),
            };
        }
    }

    async processAIRequest(job) {
        const { userId, prompt, options } = job.data;

        try {
            const completion = await this.openai.chat.completions.create({
                model: options.model || (this.apiKey.startsWith('nvapi-') ? 'openai/gpt-oss-20b' : 'gpt-3.5-turbo'),
                messages: [
                    {
                        role: 'system',
                        content: options.systemPrompt || 'You are a helpful assistant for a gaming community Discord bot.',
                    },
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
                max_tokens: options.maxTokens || 500,
                temperature: options.temperature || 0.7,
            });

            const response = completion.choices[0]?.message?.content || 'No response generated';

            return { response };

        } catch (error) {
            this.logger.error('[AI] OpenAI API error:', error);

            // Return fallback response
            throw new Error('AI processing failed');
        }
    }

    getFallbackResponse(prompt) {
        // Simple fallback responses based on keywords
        const lowerPrompt = prompt.toLowerCase();

        if (lowerPrompt.includes('help') || lowerPrompt.includes('bantuan')) {
            return 'Untuk bantuan, silakan gunakan command /help atau hubungi admin.';
        }

        if (lowerPrompt.includes('joki') || lowerPrompt.includes('boost')) {
            return 'Untuk layanan joki, gunakan command /joki-queue untuk melihat antrian.';
        }

        if (lowerPrompt.includes('payment') || lowerPrompt.includes('bayar')) {
            return 'Untuk informasi pembayaran, cek command /payment-info.';
        }

        return 'Maaf, saya sedang mengalami gangguan. Silakan coba lagi nanti atau hubungi admin.';
    }

    // Synchronous processing for urgent requests (bypass queue)
    async processUrgentRequest(userId, prompt, options = {}) {
        const startTime = Date.now();

        try {
            // Check rate limit
            const rateLimitCheck = await this.rateLimitService.checkAILimit(userId);
            if (!rateLimitCheck.allowed) {
                return {
                    success: false,
                    error: `AI rate limit exceeded. Try again ${this.rateLimitService.formatTimeRemaining(rateLimitCheck.resetTime)}.`,
                };
            }

            const completion = await this.openai.chat.completions.create({
                model: options.model || 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: options.systemPrompt || 'You are a helpful assistant for a gaming community Discord bot.',
                    },
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
                max_tokens: options.maxTokens || 300, // Shorter for urgent requests
                temperature: options.temperature || 0.7,
            });

            const response = completion.choices[0]?.message?.content || 'No response generated';
            const duration = Date.now() - startTime;

            this.monitoringService.recordAIRequest(duration, true);

            return {
                success: true,
                response,
                duration,
            };

        } catch (error) {
            const duration = Date.now() - startTime;
            this.monitoringService.captureError(error, {
                type: 'ai',
                source: 'processUrgentRequest',
                userId,
            });
            this.monitoringService.recordAIRequest(duration, false);

            this.logger.error('[AI] Urgent request failed:', error);

            return {
                success: false,
                error: 'AI service error',
                fallback: this.getFallbackResponse(prompt),
            };
        }
    }
}

function createAIService(config, queueService, rateLimitService, monitoringService, logger) {
    return new AIService(config, queueService, rateLimitService, monitoringService, logger);
}

module.exports = { createAIService };
