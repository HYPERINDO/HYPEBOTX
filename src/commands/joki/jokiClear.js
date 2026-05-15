const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { hasJokiCrewAccess } = require("../../utils/permissionCheck");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("joki-clear")
        .setDescription("Reset data antrian joki aktif (hapus QUEUE/WORK/DONE yang masih tersimpan di queue aktif)."),

    async execute(interaction, client) {
        const { services, repositories } = client.container;

        if (!hasJokiCrewAccess(interaction.member)) {
            await interaction.reply({ content: "[ERROR] Hanya joki crew/staff yang bisa reset antrian.", flags: MessageFlags.Ephemeral });
            return;
        }

        if (!repositories?.jokiRepository?.clearActiveQueue) {
            await interaction.reply({ content: "[ERROR] jokiRepository.clearActiveQueue tidak tersedia.", flags: MessageFlags.Ephemeral });
            return;
        }

        await repositories.jokiRepository.clearActiveQueue(interaction.guild.id);

        // publish refresh to queue-list (will show Kosong)
        try {
            const queueOrderForUpdate = { id: "CLEAR" };
            await services.jokiService.publishQueueUpdate(interaction.guild, queueOrderForUpdate, "manual-add");
        } catch {
            // ignore: just to avoid blocking the clear action
        }

        await interaction.reply({ content: "[OK] Antrian joki aktif sudah di-reset.", flags: MessageFlags.Ephemeral });
    },
};
