const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { adminCommand } = require("../../config/permissions");
const { requireAdmin } = require("../../middlewares/permissionGuard");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("apply-permissions")
        .setDescription("Apply ulang permission overwrites semua channel berdasarkan template GameStore.")
        .setDefaultMemberPermissions(adminCommand),
    async execute(interaction, client) {
        if (!(await requireAdmin(interaction))) return;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const summary = await client.container.services.structureService.ensureTemplate(
            interaction.guild,
            "gamestore",
        );

        await interaction.editReply(
            `Apply permission selesai.\nKategori: ${summary.categories}\nChannel: ${summary.channels}\n\nTemplate overwrites untuk verify/member/staff sudah disinkronkan.`,
        );
    },
};
