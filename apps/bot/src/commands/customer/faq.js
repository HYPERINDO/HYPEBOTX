const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { isOwnerOrStaff } = require("../../utils/permissionCheck");
const { clampContent } = require("../../utils/discordResponse");
const { sanitizeText } = require("../../utils/validators");
const { safeReply } = require("../../utils/discordResponse.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("faq")
    .setDescription("Cari jawaban FAQ.")
    .addStringOption((option) => option.setName("keyword").setDescription("Keyword FAQ").setRequired(true))
    .addStringOption((option) => option.setName("answer").setDescription("Isi untuk tambah/update FAQ (staff)").setRequired(false))
    .addStringOption((option) => option.setName("category").setDescription("Kategori FAQ").setRequired(false)),
  async execute(interaction, client) {
    const rawKeyword = sanitizeText(interaction.options.getString("keyword", true), 500);
    const rawAnswer = sanitizeText(interaction.options.getString("answer"), 500);
    const keyword = sanitizeText(rawKeyword, 100);
    const answer = rawAnswer ? sanitizeText(rawAnswer, 1000) : null;

    if (answer) {
      if (!isOwnerOrStaff(interaction.member)) {
        await safeReply(interaction, { content: "Hanya staff yang bisa tambah/update FAQ.", flags: MessageFlags.Ephemeral });
        return;
      }

      const category = sanitizeText(interaction.options.getString("category"), 500) || "general";
      const faq = await client.container.services.storeOpsService.upsertFaq(
        interaction,
        keyword,
        answer,
        category,
      );
      await safeReply(interaction, { content: `FAQ tersimpan: \`${faq.keyword}\`.`, flags: MessageFlags.Ephemeral });
      return;
    }

    const faq = await client.container.services.storeOpsService.findFaq(interaction.guild.id, keyword);
    await safeReply(interaction, {
      content: clampContent(faq ? `**${faq.keyword}**\n${faq.answer}` : "FAQ belum ditemukan. Silakan buka ticket support."),
      flags: MessageFlags.Ephemeral,
    });
  },
};
