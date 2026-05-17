const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { staffCommand } = require("../../config/permissions");
const { sanitizeText } = require("../../utils/validators");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("customer-set")
    .setDescription("Set tier/status/notes customer.")
    .setDefaultMemberPermissions(staffCommand)
    .addUserOption((option) =>
      option.setName("user").setDescription("Customer target.").setRequired(true),
    )
    .addStringOption((option) =>
      option.setName("field").setDescription("Field yang diubah.").setRequired(true).addChoices(
        { name: "tier", value: "tier" },
        { name: "status", value: "status" },
        { name: "notes", value: "notes" },
      ),
    )
    .addStringOption((option) =>
      option.setName("value").setDescription("Nilai baru.").setRequired(true),
    ),
  async execute(interaction, client) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const target = interaction.options.getUser("user", true);
    const rawField = sanitizeText(interaction.options.getString("field", true), 500);
    const rawValue = sanitizeText(interaction.options.getString("value", true), 500).trim();
    const field = sanitizeText(rawField, 50);
    const value = sanitizeText(rawValue, 500);
    const guildId = interaction.guild.id;
    const { repositories } = client.container;

    const allowedTiers = ["new", "regular", "vip"];
    const allowedStatuses = ["normal", "blacklist", "vip"];

    if (field === "tier" && !allowedTiers.includes(value.toLowerCase())) {
      return interaction.editReply({ content: `[ERROR] Tier harus salah satu dari: ${allowedTiers.join(", ")}` });
    }
    if (field === "status" && !allowedStatuses.includes(value.toLowerCase())) {
      return interaction.editReply({ content: `[ERROR] Status harus salah satu dari: ${allowedStatuses.join(", ")}` });
    }

    const updates = {};
    if (field === "tier") updates.tier = value.toLowerCase();
    if (field === "status") updates.status = value.toLowerCase();
    if (field === "notes") updates.notes = value.slice(0, 500);

    await repositories.userRepository.upsert({
      guildId,
      userId: target.id,
      username: target.tag || target.username,
      ...updates,
    });

    await client.container.services.storeOpsService.writeStaffLog(
      interaction,
      "customer_set",
      target.id,
      `Set ${field}=${value} untuk ${target.tag || target.username}`,
    ).catch((err) => {
      client.container?.logger?.error?.("Failed to write staff log for customer set", { error: err.message });
    });

    return interaction.editReply({
      content: `[OK] Customer <@${target.id}> — ${field} diubah ke \`${updates[field]}\`.`,
    });
  },
};
