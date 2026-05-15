const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { orderFormats, generalOrderNote } = require("../templates/orderFormats");
const { componentIds } = require("./constants");

const formatButtonConfig = [
  { id: componentIds.formatJoki, label: "JOKI", style: ButtonStyle.Primary },
  { id: componentIds.formatTopup, label: "TOP UP", style: ButtonStyle.Primary },
  { id: componentIds.formatWindows, label: "WINDOWS", style: ButtonStyle.Secondary },
  { id: componentIds.formatOffice, label: "OFFICE", style: ButtonStyle.Secondary },
  { id: componentIds.formatOptimizer, label: "OPTIMIZER", style: ButtonStyle.Secondary },
  { id: componentIds.formatGameaccount, label: "GAME ACCOUNT", style: ButtonStyle.Danger },
  { id: componentIds.formatDiscord, label: "DISCORD SERVER", style: ButtonStyle.Success },
  { id: componentIds.formatBundle, label: "BUNDLE", style: ButtonStyle.Success },
  { id: componentIds.formatWarranty, label: "WARRANTY", style: ButtonStyle.Danger },
];

function createCodeBlock(text, limit = 3900) {
  const value = text.length > limit ? `${text.slice(0, limit - 32)}\n\n[DIPOTONG]` : text;
  return `\`\`\`\n${value}\n\`\`\``;
}

function createOrderFormatEmbed(formatType) {
  const format = orderFormats[formatType];
  if (!format) {
    return new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle("Format Tidak Ditemukan")
      .setDescription("Format order yang dicari tidak tersedia.");
  }

  const requiredFields = format.fields
    .filter((field) => field.required)
    .map((field) => `- ${field.name}`)
    .join("\n");

  const optionalFields = format.fields
    .filter((field) => !field.required)
    .map((field) => `- ${field.name}`)
    .join("\n");

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle(format.name)
    .setDescription(createCodeBlock(format.format))
    .addFields({
      name: "Field Wajib",
      value: requiredFields || "-",
      inline: false,
    });

  if (optionalFields) {
    embed.addFields({
      name: "Field Opsional",
      value: optionalFields,
      inline: false,
    });
  }

  return embed;
}

function createOrderFormatListEmbed() {
  const formatList = Object.entries(orderFormats)
    .map(([key, format]) => `**${format.name}**\nKode: \`${key}\`\n${format.description}`)
    .join("\n\n");

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("KUMPULAN FORMAT ORDER HYPERINDO")
    .setDescription("Pilih tombol format sesuai layanan, atau gunakan `/format type:<jenis>`.")
    .addFields(
      {
        name: "Format Tersedia",
        value: formatList,
        inline: false,
      },
      {
        name: "Note Umum Order Hyperindo",
        value: generalOrderNote,
        inline: false,
      },
    )
    .setFooter({ text: "HYPERINDO - Ticketing System" })
    .setTimestamp();
}

function createOrderFormatButtonRows() {
  const rows = [];

  for (let index = 0; index < formatButtonConfig.length; index += 5) {
    rows.push(
      new ActionRowBuilder().addComponents(
        formatButtonConfig.slice(index, index + 5).map((button) =>
          new ButtonBuilder()
            .setCustomId(button.id)
            .setLabel(button.label)
            .setStyle(button.style),
        ),
      ),
    );
  }

  return rows;
}

async function sendOrderFormatMessage(channel, formatType) {
  await channel.send({
    embeds: [createOrderFormatEmbed(formatType)],
  });
}

async function sendOrderFormatPanel(channel) {
  await channel.send({
    embeds: [createOrderFormatListEmbed()],
    components: createOrderFormatButtonRows(),
  });
}

function getFormatTypeFromButtonId(customId) {
  const match = Object.entries({
    [componentIds.formatJoki]: "joki",
    [componentIds.formatTopup]: "topup",
    [componentIds.formatWindows]: "windows",
    [componentIds.formatOffice]: "office",
    [componentIds.formatOptimizer]: "optimizer",
    [componentIds.formatGameaccount]: "gameAccount",
    [componentIds.formatDiscord]: "discordServer",
    [componentIds.formatBundle]: "bundle",
    [componentIds.formatWarranty]: "warranty",
  }).find(([buttonId]) => buttonId === customId);

  return match?.[1] || null;
}

module.exports = {
  createOrderFormatEmbed,
  createOrderFormatListEmbed,
  createOrderFormatButtonRows,
  sendOrderFormatMessage,
  sendOrderFormatPanel,
  getFormatTypeFromButtonId,
};
