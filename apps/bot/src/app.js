const { Client, Collection, Options } = require("discord.js");

const botConfig = require("./config/bot");
const intents = require("./config/intents");
const { createDatabase } = require("./database/connection");
const { registerCommands } = require("./handlers/commandHandler");
const { registerEvents } = require("./handlers/eventHandler");
const { createLogger } = require("./utils/logger");
const { createDiscordWebhookConsoleLogger } = require("./utils/discordWebhookConsoleLogger");
const { createTemplateService } = require("./services/templateService");
const { createRoleService } = require("./services/roleService");
const { createLoggingService } = require("./services/loggingService");
const { createStructureService } = require("./services/structureService");
const { createVerifyService } = require("./services/verifyService");
const { createTicketService } = require("./services/ticketService");
const { createOrderService } = require("./services/orderService");
const { createPaymentService } = require("./services/paymentService");
const { createModerationService } = require("./services/moderationService");
const { createMusicService } = require("./services/musicService");
const { createBackupService } = require("./services/backupService");
const { createAuditService } = require("./services/auditService");
const { createAnalyticsService } = require("./services/analyticsService");
const { createGuildRepository } = require("./repositories/guildRepository");
const { createTicketRepository } = require("./repositories/ticketRepository");
const { createOrderRepository } = require("./repositories/orderRepository");
const { createPaymentRepository } = require("./repositories/paymentRepository");
const { createBackupRepository } = require("./repositories/backupRepository");
const { createJokiRepository } = require("./repositories/jokiRepository");
const { createUserRepository } = require("./repositories/userRepository");
const { createSimpleStoreRepository } = require("./repositories/simpleStoreRepository");
const { createRefundDisputeRepository } = require("./repositories/refundDisputeRepository");
const { createOpsRepository } = require("./repositories/opsRepository");
const { createAutoBackupJob } = require("./jobs/autoBackupJob");
const { createAutoCloseTicketJob } = require("./jobs/autoCloseTicketJob");
const { createGiveawayJob } = require("./jobs/giveawayJob");
const { createPaymentReminderJob } = require("./jobs/paymentReminderJob");
const { createMusicCleanupJob } = require("./jobs/musicCleanupJob");
const { createJokiQueueJob } = require("./jobs/jokiQueueJob");
const { createJokiHoldReminderJob } = require("./jobs/jokiHoldReminderJob");
const { createStoreOpsService } = require("./services/storeOpsService");
const { createDeliveryService } = require("./services/deliveryService");
const { createBacklogService } = require("./services/backlogService");
const { createCacheService } = require("./services/cacheService");
const { createQueueService } = require("./services/queueService");
const { createRateLimitService } = require("./services/rateLimitService");
const { createMonitoringService } = require("./services/monitoringService");
const { createAIService } = require("./services/aiService");
const { createAiToolScannerService } = require("./services/aiToolScannerService");
const { createGuildWhitelistService } = require("./services/guildWhitelistService");
const { createEnhancedBackupService } = require("./services/enhancedBackupService");
const { createMigrationService } = require("./services/migrationService");
const { createCrashDetectionService } = require("./services/crashDetectionService");
const { createAntiSpamService } = require("./services/antiSpamService");
const { createJsonRecoveryService } = require("./services/jsonRecoveryService");
const { createSingleInstanceLockService } = require("./services/singleInstanceLockService");
const { createWebDashboardService } = require("./services/webDashboardService");

function createApp() {
  const logger = botConfig.logging.webhookUrl
    ? createDiscordWebhookConsoleLogger({
      webhookUrl: botConfig.logging.webhookUrl,
      scope: "app",
      levels: botConfig.logging.webhookLevels,
    })
    : createLogger("app");

  // Initialize core services
  const cacheService = createCacheService(botConfig, logger);
  const queueService = createQueueService(botConfig, logger);
  const rateLimitService = createRateLimitService(botConfig, cacheService, logger);
  const monitoringService = createMonitoringService(botConfig, logger);
  const aiService = createAIService(botConfig, queueService, rateLimitService, monitoringService, logger);

  const client = new Client({
    intents,
    makeCache: Options.cacheWithLimits({
      MessageManager: 200,
      GuildMemberManager: 1000,
      UserManager: 1000,
      ReactionManager: 1000,
      ThreadManager: 100,
    }),
    sweepers: {
      messages: {
        interval: 3600, // 1 hour
        lifetime: 1800, // 30 minutes
      },
      guildMembers: {
        interval: 3600,
        // Discord.js expects sweeper filter as a factory function that returns
        // either false or a predicate function.
        filter: () => (member) => member?.user?.bot === true,
      },
      threads: {
        interval: 3600,
        lifetime: 1800,
      },
    },
  });
  const database = createDatabase(botConfig.paths, logger);
  const singleInstanceLockService = createSingleInstanceLockService({ botConfig, logger });

  database.init();

  // Initialize cache and monitoring
  const redisEnabled = String(process.env.REDIS_ENABLED ?? "true").toLowerCase() === "true";
  const cacheProvider = String(process.env.CACHE_PROVIDER ?? "redis").toLowerCase();

  if (redisEnabled && cacheProvider !== "memory") {
    cacheService.connect().catch((err) => logger.warn("[APP] Cache connection failed:", err));
  } else {
    logger.info("[APP] Cache disabled (Redis/Bull safe mode)");
  }

  monitoringService.start();

  client.commands = new Collection();
  client.cooldowns = new Collection();

  const repositories = {
    guildRepository: createGuildRepository(database),
    ticketRepository: createTicketRepository(database),
    orderRepository: createOrderRepository(database),
    paymentRepository: createPaymentRepository(database),
    backupRepository: createBackupRepository(database),
    jokiRepository: createJokiRepository({ database, logger }),
    userRepository: createUserRepository(database),
    simpleStoreRepository: createSimpleStoreRepository(database),

    // Priority 1: refund / dispute
    refundDisputeRepository: createRefundDisputeRepository(database),
    opsRepository: createOpsRepository(database),
  };

  const services = {};
  services.singleInstanceLockService = singleInstanceLockService;

  // Core optimization services
  services.cacheService = cacheService;
  services.queueService = queueService;
  services.rateLimitService = rateLimitService;
  services.monitoringService = monitoringService;
  services.aiService = aiService;

  services.templateService = createTemplateService();
  services.loggingService = createLoggingService({ client, logger });
  services.roleService = createRoleService({
    logger,
    repositories,
    templateService: services.templateService,
  });
  services.structureService = createStructureService({
    botConfig,
    logger,
    repositories,
    templateService: services.templateService,
    roleService: services.roleService,
    loggingService: services.loggingService,
  });
  services.verifyService = createVerifyService({
    botConfig,
    logger,
    repositories,
    roleService: services.roleService,
    loggingService: services.loggingService,
  });

  const { createStatusSyncService } = require("./services/statusSyncService");
  services.statusSyncService = createStatusSyncService({
    logger,
    repositories,
  });

  // Chatbot layer (Hyperindo-bounded)
  const { createChatbotService } = require("./services/chatbot/chatbotService");

  services.ticketService = createTicketService({
    botConfig,
    logger,
    database,
    repositories,
    roleService: services.roleService,
    loggingService: services.loggingService,
    statusSyncService: services.statusSyncService,
    getJokiService: () => services.jokiService,
  });

  services.orderService = createOrderService({
    botConfig,
    logger,
    repositories,
    ticketService: services.ticketService,
    roleService: services.roleService,
    loggingService: services.loggingService,
    statusSyncService: services.statusSyncService,
    getJokiService: () => services.jokiService,
  });

  // Delivery harus tersedia sebelum paymentService agar approve bisa memicu auto-delivery.
  services.deliveryService = createDeliveryService({
    botConfig,
    logger,
    database,
    repositories,
    loggingService: services.loggingService,
  });

  services.moderationService = createModerationService({
    botConfig,
    logger,
    database,
    repositories,
    roleService: services.roleService,
    loggingService: services.loggingService,
  });
  services.funService = services.moderationService;

  // Musik bisa diaktifkan/dimatikan via config env flag.
  // Default: ENABLE (jika flag tidak diset, musik tetap aktif).
  const musicEnabled = botConfig.music?.enabled !== false;
  if (musicEnabled) {
    services.musicService = createMusicService({
      botConfig,
      logger,
      loggingService: services.loggingService,
    });
  } else {
    services.musicService = null;
  }

  services.backupService = createBackupService({
    botConfig,
    logger,
    database,
    repositories,
    roleService: services.roleService,
    loggingService: services.loggingService,
  });

  const { createJokiService } = require("./services/jokiService");
  services.jokiService = createJokiService({
    botConfig,
    logger,
    repositories,
    loggingService: services.loggingService,
    statusSyncService: services.statusSyncService,
  });

  services.paymentService = createPaymentService({
    botConfig,
    logger,
    repositories,
    loggingService: services.loggingService,
    statusSyncService: services.statusSyncService,
    getJokiService: () => services.jokiService,
    deliveryService: services.deliveryService,
    orderService: services.orderService,
  });

  // Priority 1: Refund / Dispute
  const { createRefundDisputeService } = require("./services/refundDisputeService");
  services.refundDisputeService = createRefundDisputeService({
    botConfig,
    logger,
    repositories,
    orderService: services.orderService,
    loggingService: services.loggingService,
  });

  services.auditService = createAuditService({
    logger,
    templateService: services.templateService,
    roleService: services.roleService,
  });

  services.storeOpsService = createStoreOpsService({
    botConfig,
    logger,
    repositories,
    loggingService: services.loggingService,
    orderService: services.orderService,
    ticketService: services.ticketService,
    paymentService: services.paymentService,
    jokiService: services.jokiService,
    statusSyncService: services.statusSyncService,
  });

  services.chatbotService = createChatbotService({
    client,
    storeOpsService: services.storeOpsService,
  });

  services.analyticsService = createAnalyticsService({
    repositories,
    logger,
    services,
  });

  services.aiToolScannerService = createAiToolScannerService({
    botConfig,
    logger,
    repositories,
    services: {
      storeOpsService: services.storeOpsService,
      jokiService: services.jokiService,
    },
  });

  services.backlogService = createBacklogService({
    botConfig,
    logger,
    repositories,
    loggingService: services.loggingService,
    statusSyncService: services.statusSyncService,
    orderService: services.orderService,
    paymentService: services.paymentService,
  });

  services.webDashboardService = createWebDashboardService({
    botConfig,
    logger,
    repositories,
    services,
  });

  // PRIORITY FEATURES: Production hardening
  services.guildWhitelistService = createGuildWhitelistService({
    botConfig,
    logger,
    repositories,
  });

  services.enhancedBackupService = createEnhancedBackupService({
    botConfig,
    logger,
    database,
    repositories,
  });

  services.migrationService = createMigrationService({
    botConfig,
    logger,
    database,
  });

  services.crashDetectionService = createCrashDetectionService({
    botConfig,
    logger,
    client,
    loggingService: services.loggingService,
  });

  services.antiSpamService = createAntiSpamService({
    botConfig,
    logger,
    cacheService,
    loggingService: services.loggingService,
  });

  services.jsonRecoveryService = createJsonRecoveryService({
    botConfig,
    logger,
    enhancedBackupService: services.enhancedBackupService,
  });

  const jobs = {
    autoBackupJob: createAutoBackupJob({ botConfig, logger, backupService: services.backupService }),
    autoCloseTicketJob: createAutoCloseTicketJob({ botConfig, logger, ticketService: services.ticketService }),
    jokiQueueJob: createJokiQueueJob({ botConfig, logger, jokiService: services.jokiService }),
    jokiHoldReminderJob: createJokiHoldReminderJob({ botConfig, logger, jokiService: services.jokiService }),
    paymentReminderJob: createPaymentReminderJob({ botConfig, logger, paymentService: services.paymentService }),
    giveawayJob: createGiveawayJob({ logger, funService: services.funService }),
    musicCleanupJob: services.musicService ? createMusicCleanupJob({ logger, musicService: services.musicService }) : null,
  };

  client.container = {
    botConfig,
    logger,
    database,
    repositories,
    services,
    jobs,
  };

  registerCommands(client);
  registerEvents(client);

  function validateEnvironment() {
    const requiredKeys = ["DISCORD_TOKEN", "CLIENT_ID", "GUILD_ID"];
    const missingRequired = requiredKeys.filter((key) => !(process.env[key] || "").trim());

    const ticketKeys = [
      "TICKET_CATEGORY_ID",
      "MEMBER_ROLE_ID",
      "STAFF_ROLE_ID",
      "OWNER_ROLE_ID",
      "TICKET_LOG_CHANNEL_ID",
      "TRANSCRIPT_CHANNEL_ID",
    ];

    if (missingRequired.length) {
      missingRequired.forEach((key) => logger.error(`[ENV] ${key} missing`));
      throw new Error(`Missing required environment variables: ${missingRequired.join(", ")}`);
    }

    ticketKeys.forEach((key) => {
      if (!(process.env[key] || "").trim()) {
        logger.warn(`[ENV] ${key} missing`);
      }
    });

    if (
      !(process.env.VERIFIED_ROLE_ID || "").trim() &&
      !(process.env.VERIFY_ROLE_ID || "").trim() &&
      !(process.env.VERIFIED_ROLE_IDS || "").trim()
    ) {
      logger.warn("[ENV] VERIFIED_ROLE_ID / VERIFY_ROLE_ID / VERIFIED_ROLE_IDS missing");
    }
  }

  return {
    client,
    async start() {
      validateEnvironment();

      if (!botConfig.token) {
        throw new Error("DISCORD_TOKEN belum diisi di .env");
      }

      if (!botConfig.clientId) {
        throw new Error("CLIENT_ID belum diisi di .env");
      }

      await services.singleInstanceLockService.acquireLock();

      // Start monitoring and recovery services
      services.crashDetectionService.startMonitoring();
      services.jsonRecoveryService.startMonitoring();

      logger.info("[APP] Priority services initialized");
      logger.info("[APP] - Guild Whitelist: Active");
      logger.info("[APP] - Enhanced Backup: Active");
      logger.info("[APP] - Migration Service: Ready");
      logger.info("[APP] - Crash Detection: Monitoring");
      logger.info("[APP] - Anti-Spam: Active");
      logger.info("[APP] - JSON Recovery: Monitoring");

      await client.login(botConfig.token);
    },
    async shutdown() {
      logger.info("shutting down app");
      try {
        // Shutdown priority services
        logger.info("[SHUTDOWN] Cleaning up priority services");
        services.guildWhitelistService?.clearCache?.();
        services.antiSpamService?.cleanup?.();
        services.crashDetectionService?.getMetricsSummary?.();

        // Clean up all music queues
        if (services.musicService?.leave) {
          for (const guild of client.guilds.cache.values()) {
            try {
              services.musicService.leave(guild.id);
            } catch (error) {
              logger.error("music cleanup error", { guildId: guild.id, error: error.message });
            }
          }
        }

        // Stop optimization services
        if (services.cacheService?.disconnect) {
          await services.cacheService.disconnect();
        }
        if (services.queueService?.closeAll) {
          await services.queueService.closeAll();
        }
        if (services.monitoringService?.stop) {
          services.monitoringService.stop();
        }

        // Stop all scheduled jobs
        if (jobs.autoBackupJob?.stop) jobs.autoBackupJob.stop();
        if (jobs.autoCloseTicketJob?.stop) jobs.autoCloseTicketJob.stop();
        if (jobs.jokiQueueJob?.stop) jobs.jokiQueueJob.stop();
        if (jobs.jokiHoldReminderJob?.stop) jobs.jokiHoldReminderJob.stop();
        if (jobs.paymentReminderJob?.stop) jobs.paymentReminderJob.stop();
        if (jobs.giveawayJob?.stop) jobs.giveawayJob.stop();
        if (jobs.musicCleanupJob?.stop) jobs.musicCleanupJob.stop();
        if (services.backlogService?.stopOwnerDashboardServer) {
          await services.backlogService.stopOwnerDashboardServer();
        }
        if (services.webDashboardService?.stop) {
          await services.webDashboardService.stop();
        }

        await services.singleInstanceLockService.releaseLock();
        logger.info("app shutdown completed");
      } catch (error) {
        logger.error("app shutdown error", { error: error.message });
      }
    },
  };
}

module.exports = {
  createApp,
};
