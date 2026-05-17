const { Events, MessageFlags } = require("discord.js");
const { clampContent } = require("../../utils/discordResponse");
const { useCooldown } = require("../../middlewares/cooldown");
const { isOwnerOrStaff } = require("../../utils/permissionCheck");
const { checkGuildWhitelist } = require("../../middlewares/guildWhitelistMiddleware");
const { createLogger } = require("../../utils/logger");
const { safeReply } = require("../../utils/discordResponse.js");

const log = createLogger("interaction-handler");

const DISCORD_MISSING_PERMISSIONS_CODE = 50013;
const REQUIRED_CHANNEL_PERMISSIONS = [
  "View Channel",
  "Send Messages",
  "Embed Links",
  "Read Message History",
];
const COMMAND_COOLDOWN_SECONDS = {
  default: 2,
  play: 5,
  ticket: 10,
  "open-order": 10,
  "joki-queue": 8,
};

function buildCommandErrorMessage(error, interaction) {
  const errorMessage = error?.message || String(error);
  const errorCode = error?.rawError?.code ?? error?.code;

  const isMissingPermissionsError =
    Number(errorCode) === DISCORD_MISSING_PERMISSIONS_CODE ||
    /Missing Permissions/i.test(errorMessage) ||
    /50013/.test(errorMessage) ||
    /Missing Permission/i.test(errorMessage);

  if (!isMissingPermissionsError) {
    return "Terjadi error saat memproses permintaan. Silakan coba lagi atau hubungi admin.";
  }

  const channelLabel = interaction?.channelId ? `<#${interaction.channelId}>` : "channel ini";
  return [
    `Bot tidak punya izin di ${channelLabel}.`,
    `Aktifkan permission ${REQUIRED_CHANNEL_PERMISSIONS.map((permission) => `\`${permission}\``).join(", ")}, lalu jalankan command lagi.`,
  ].join("\n");
}

function getCommandCooldownSeconds(commandName) {
  return COMMAND_COOLDOWN_SECONDS[commandName] || COMMAND_COOLDOWN_SECONDS.default;
}

function getCooldownKey(interaction) {
  return `${interaction.guild.id}:${interaction.user.id}:${interaction.commandName}`;
}

module.exports = {
  name: Events.InteractionCreate,
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand()) return;

    const containerBotConfig = client.container?.botConfig;
    const allowedGuildIds = Array.isArray(containerBotConfig?.allowedGuildIds)
      ? containerBotConfig.allowedGuildIds
      : containerBotConfig
        ? []
        : require("../../config/bot").allowedGuildIds;

    if (allowedGuildIds.length > 0 && interaction.guild && !allowedGuildIds.includes(interaction.guild.id)) {
      client.container.logger.warn("Interaction from unauthorized guild ignored", { guildId: interaction.guild.id });
      return;
    }

    const command = client.commands.get(interaction.commandName);
    if (!command) {
      client.container.logger.warn("command not found", { commandName: interaction.commandName });
      return;
    }

    try {
      // Validate interaction
      if (!interaction.guild || !interaction.user || !interaction.member) {
        throw new Error("Invalid interaction context");
      }

      // IMPORTANT: ACK dulu supaya tidak kena "application did not respond"
      // untuk command yang berpotensi lambat (mis. AI/network).
      if (interaction.commandName === "ask" && !interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch((err) => {
          log.warn("Failed to defer ask command reply", { error: err.message, commandName: interaction.commandName });
        });
      }

      const skipCooldown =
        isOwnerOrStaff(interaction.member) || ["ping", "help"].includes(interaction.commandName);

      // Maintenance mode check: block customer commands
      const { checkMaintenance } = require("../../middlewares/maintenanceGuard");
      const maintenanceOk = await checkMaintenance(interaction, client.container.repositories);
      if (!maintenanceOk) return;

      // Guild whitelist validation
      if (client.container.services?.guildWhitelistService) {
        const allowed = await checkGuildWhitelist(
          interaction,
          client.container.services.guildWhitelistService,
          client.container.logger,
        );
        if (!allowed) {
          return;
        }
      }

      if (!skipCooldown) {
        if (!client.cooldowns) client.cooldowns = new Map();

        const cooldownSeconds = getCommandCooldownSeconds(interaction.commandName);
        const cooldownKey = getCooldownKey(interaction);

        const now = Date.now();
        const expiresAt = client.cooldowns.get(cooldownKey);

        if (typeof expiresAt === "number" && expiresAt > now) {
          const remainingSeconds = Math.ceil((expiresAt - now) / 1000);
          await safeReply(interaction, {
            content: `Terlalu cepat. Coba lagi dalam ${remainingSeconds} detik.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        // apply cooldown immediately only after command succeeds (prevents cross-test pollution)
        // We'll stage setting until after command.execute returns.
        // Store in temp variable for later set:
        client.__pendingCooldown = { cooldownSeconds, cooldownKey, now };
      }

      // Rate limiting check
      const rateLimitCheck = await client.container.services.rateLimitService.checkInteraction(interaction);
      if (!rateLimitCheck.allowed) {
        await safeReply(interaction, {
          content: rateLimitCheck.message,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await command.execute(interaction, client);

      // Track command execution metrics
      client.container.services.monitoringService.incrementCommands();

      if (!skipCooldown) {
        const pending = client.__pendingCooldown;
        if (pending?.cooldownKey && pending?.cooldownSeconds) {
          const expiresAt = pending.now + pending.cooldownSeconds * 1000;
          client.cooldowns.set(pending.cooldownKey, expiresAt);
        }
        client.__pendingCooldown = null;
      }
    } catch (error) {
      client.container.logger.error("command execution failed", {
        command: interaction.commandName,
        user: interaction.user.id,
        guild: interaction.guild?.id,
        message: error.message,
        stack: error.stack,
      });

      // Universal feature error logger (for bug hunting across features)
      try {
        const { createFeatureErrorLogger } = require("../../utils/featureErrorLogger");
        const featureErrorLogger = createFeatureErrorLogger({
          logger: client.container.logger,
          loggingService: client.container.services?.loggingService,
          botConfig: client.container.botConfig,
        });

        await featureErrorLogger.capture({
          interaction,
          feature: `command:${interaction.commandName}`,
          error,
        });
      } catch (logError) {
        client.container.logger.error("feature_error_logging_failed", {
          originalError: error?.message,
          logError: logError?.message,
        });
      }

      const errorMessage = buildCommandErrorMessage(error, interaction);
      const safeErrorMessage = clampContent(errorMessage);

      client.container.services.monitoringService?.captureError?.(error, {
        type: 'command',
        feature: `command:${interaction.commandName}`,
        userId: interaction.user?.id,
        guildId: interaction.guild?.id,
      });

      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({
            content: safeErrorMessage,
            flags: MessageFlags.Ephemeral,
          }).catch((err) => {
            client.container.logger.error("followup message failed", { error: err.message });
          });
        } else {
          await safeReply(interaction, {
            content: safeErrorMessage,
            flags: MessageFlags.Ephemeral,
          }).catch((err) => {
            client.container.logger.error("reply message failed", { error: err.message });
          });
        }
      } catch (replyError) {
        client.container.logger.error("error response failed", { error: replyError.message });
      }
    }
  },
};
