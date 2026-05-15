const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const { componentIds } = require("../../utils/constants");
const { sanitizeText, validateInput } = require("../../utils/validators");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("joki-queue")
    .setDescription("Masuk antrian joki")
    .addIntegerOption((opt) => opt.setName("estimated_minutes").setDescription("Estimasi durasi per order (menit)").setMinValue(1).setMaxValue(10080))
    .addStringOption((opt) => opt.setName("ticket_id").setDescription("ID ticket/urutan terkait (opsional)")),
  async execute(interaction, client) {
    const { services, repositories } = client.container;
    const estimatedMinutes = interaction.options.getInteger("estimated_minutes");
    const rawTicketId = sanitizeText(interaction.options.getString("ticket_id"), 500);

    let ticketId = null;
    if (rawTicketId) {
      const validation = validateInput(rawTicketId, {
        maxLength: 40,
        required: false,
        pattern: /^[a-zA-Z0-9-]+$/,
      });

      if (!validation.valid) {
        await interaction.reply({
          content: `[ERROR] Ticket ID tidak valid: ${validation.errors.join(", ")}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      ticketId = sanitizeText(rawTicketId, 40);
    }

    // Auto-link ke ticket aktif jika command dijalankan di channel ticket.
    if (!ticketId && repositories?.ticketRepository?.findByChannelId) {
      const relatedTicket = await repositories.ticketRepository.findByChannelId(interaction.channel.id);
      if (relatedTicket?.id) {
        ticketId = relatedTicket.id;
      }
    }

    const estimatedSeconds = estimatedMinutes ? estimatedMinutes * 60 : undefined;

    const { entry, reused } = await services.jokiService.startQueue(interaction, {
      estimatedSeconds,
      ticketId,
    });

    const claimCustomId = `${componentIds.jokiClaimPrefix}${entry.id}`;
    const startCustomId = `${componentIds.jokiStartPrefix}${entry.id}`;
    const finishCustomId = `${componentIds.jokiFinishPrefix}${entry.id}`;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(claimCustomId).setLabel("Claim").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(startCustomId).setLabel("Start").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(finishCustomId).setLabel("Finish").setStyle(ButtonStyle.Secondary),
    );

    const view = await services.jokiService.getQueueView(interaction.guild);
    const embed = services.jokiService.buildQueueEmbed(interaction.guild.name, view);

    return interaction.reply({
      content: reused
        ? `[OK] Kamu sudah punya antrian aktif. Order ID: \`${entry.id}\``
        : `[OK] Antrian ditambahkan. Order ID: \`${entry.id}\`\nPosisi: #${(entry.position ?? 0) + 1}`,
      embeds: [embed],
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  },
};
