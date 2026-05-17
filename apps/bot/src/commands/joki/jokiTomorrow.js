const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { safeReply } = require("../../utils/discordResponse.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("joki-tomorrow")
        .setDescription("Lihat antrian lanjutan heist untuk besok (HOLD karena daily limit, remainingHeist > 0)."),
    async execute(interaction, client) {
        const { services } = client.container;
        const view = await services.jokiService.getQueueView(interaction.guild);

        const entries = (view.entries || []).filter((order) => {
            if (!order) return false;

            // Spec: hanya tampilkan HOLD yang masih punya heist tersisa.
            if (order.status !== "hold") return false;

            const remaining = Number(order.remainingHeist);
            if (!Number.isFinite(remaining) || remaining <= 0) return false;

            return true;
        });

        const tomorrowView = {
            active: null,
            entries,
            etaAt: null,
        };

        const embed = services.jokiService.buildQueueEmbed(interaction.guild.name, tomorrowView);
        return safeReply(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
    },
};
