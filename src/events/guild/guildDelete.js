const { Events } = require("discord.js");

module.exports = {
    name: Events.GuildDelete,
    async execute(client, guild) {
        try {
            const { logger, database, repositories } = client.container;

            // Clean up music queues
            if (client.container.services.musicService?.leave) {
                client.container.services.musicService.leave(guild.id);
            }

            // Clean up ticket data
            try {
                const tickets = await database.read("tickets", []);
                const updatedTickets = tickets.filter((t) => t.guildId !== guild.id);
                if (updatedTickets.length !== tickets.length) {
                    await database.write("tickets", updatedTickets);
                    logger.info("guild delete cleaned up tickets", { guildId: guild.id, removedCount: tickets.length - updatedTickets.length });
                }
            } catch (error) {
                logger.error("guild delete tickets cleanup failed", { guildId: guild.id, error: error.message });
            }

            // Clean up order data
            try {
                const orders = await database.read("orders", []);
                const updatedOrders = orders.filter((o) => o.guildId !== guild.id);
                if (updatedOrders.length !== orders.length) {
                    await database.write("orders", updatedOrders);
                    logger.info("guild delete cleaned up orders", { guildId: guild.id, removedCount: orders.length - updatedOrders.length });
                }
            } catch (error) {
                logger.error("guild delete orders cleanup failed", { guildId: guild.id, error: error.message });
            }

            // Clean up giveaway data
            try {
                const giveaways = await database.read("giveaways", []);
                const updatedGiveaways = giveaways.filter((g) => g.guildId !== guild.id);
                if (updatedGiveaways.length !== giveaways.length) {
                    await database.write("giveaways", updatedGiveaways);
                    logger.info("guild delete cleaned up giveaways", { guildId: guild.id, removedCount: giveaways.length - updatedGiveaways.length });
                }
            } catch (error) {
                logger.error("guild delete giveaways cleanup failed", { guildId: guild.id, error: error.message });
            }

            // Clean up guild configs
            try {
                const configs = await database.read("guildConfigs", []);
                const updatedConfigs = configs.filter((c) => c.guildId !== guild.id);
                if (updatedConfigs.length !== configs.length) {
                    await database.write("guildConfigs", updatedConfigs);
                    logger.info("guild delete cleaned up guild configs", { guildId: guild.id, removedCount: configs.length - updatedConfigs.length });
                }
            } catch (error) {
                logger.error("guild delete guild configs cleanup failed", { guildId: guild.id, error: error.message });
            }

            logger.info("guild deleted and cleanup completed", { guildId: guild.id, guildName: guild.name });
        } catch (error) {
            client.container.logger.error("guild delete event error", { error: error.message });
        }
    },
};
