const { SlashCommandBuilder } = require("discord.js");
const { sanitizeText } = require("../../utils/validators");

const answers = [
  "Iya, gas.",
  "Belum tentu, cek lagi nanti.",
  "Sepertinya aman.",
  "Lebih baik jangan sekarang.",
  "Peluangnya bagus.",
  "Jawabannya no untuk saat ini.",
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("8ball")
    .setDescription("Tanya ke 8ball.")
    .addStringOption((option) =>
      option.setName("question").setDescription("Pertanyaan kamu").setRequired(true),
    ),
  async execute(interaction, client) {
    const question = sanitizeText(interaction.options.getString("question", true), 500);
    const answer = answers[Math.floor(Math.random() * answers.length)];
    await client.container.services.funService.addPoints(interaction.user.id, 1);
    await interaction.reply(`Pertanyaan: **${question}**\nJawaban: **${answer}**`);
  },
};
