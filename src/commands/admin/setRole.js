const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { isOwnerOrStaff } = require("../../utils/permissionCheck");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setrole")
    .setDescription("Tambah role ke user.")
    .addUserOption((option) => option.setName("user").setDescription("User").setRequired(true))
    .addRoleOption((option) => option.setName("role").setDescription("Role").setRequired(true)),
  async execute(interaction, client) {
    if (!isOwnerOrStaff(interaction.member)) {
      await interaction.reply({ content: "Hanya staff yang bisa set role.", flags: MessageFlags.Ephemeral });
      return;
    }
    const user = interaction.options.getUser("user", true);
    const role = interaction.options.getRole("role", true);
    const member = await interaction.guild.members.fetch(user.id).catch((error) => {
      client.container.logger.warn("setrole fetch member failed", {
        guildId: interaction.guildId,
        targetUserId: user.id,
        message: error?.message || String(error),
      });
      return null;
    });
    if (!member) {
      await interaction.reply({ content: "Member tidak ditemukan.", flags: MessageFlags.Ephemeral });
      return;
    }
    await member.roles.add(role, `Set role by ${interaction.user.tag}`);
    await client.container.services.storeOpsService.writeStaffLog(interaction, "set_role", user.id, `Tambah role ${role.name}`);
    await interaction.reply({ content: `Role ${role} diberikan ke ${user}.`, flags: MessageFlags.Ephemeral });
  },
};
