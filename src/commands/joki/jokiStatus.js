const { SlashCommandBuilder, MessageFlags } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder().setName("joki-status").setDescription("Lihat antrian joki."),
    async execute(interaction, client) {
        const { services } = client.container;

        const view = await services.jokiService.getQueueView(interaction.guild);
        const embed = services.jokiService.buildQueueEmbed(interaction.guild.name, view);

        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    },
};
