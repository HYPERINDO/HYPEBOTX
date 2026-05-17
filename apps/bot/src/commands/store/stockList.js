const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { staffCommand } = require("../../config/permissions");
const { sanitizeText } = require("../../utils/validators");
const { createStockRepository } = require("../../repositories/stockRepository");

function maskSecret(value) {
    if (value == null) return null;
    const s = String(value);
    if (!s) return null;
    if (s.length <= 6) return "***";
    return `${s.slice(0, 3)}***${s.slice(-2)}`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("stock-list")
        .setDescription("Lihat inventory stok (available) per kategori/item.")
        .setDefaultMemberPermissions(staffCommand)
        .addStringOption((option) =>
            option.setName("category").setDescription("Kategori/tipe layanan (opsional).").setRequired(false),
        )
        .addStringOption((option) =>
            option.setName("sku").setDescription("SKU item (opsional).").setRequired(false),
        ),
    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const repo = createStockRepository(interaction.client.container.database);

        const guildId = interaction.guild.id;
        const category = sanitizeText(interaction.options.getString("category", false), 500);
        const sku = sanitizeText(interaction.options.getString("sku", false), 500);

        const categories = category
            ? await repo.stockCategories.getAll(guildId).then((rows) => rows.filter((r) => r.key === sanitizeText(category, 50)))
            : await repo.stockCategories.getAll(guildId);

        const items = await repo.stockItems.getAll(guildId);
        const filteredItems = items.filter((it) => {
            const categoryOk = category ? it.categoryId === categories[0]?.id : true;
            const skuOk = sku ? it.sku === sanitizeText(sku, 50) : true;
            const activeOk = it.isActive === true;
            return categoryOk && skuOk && activeOk;
        });

        if (!filteredItems.length) {
            return interaction.editReply({ content: "[OK] Tidak ada item stock yang cocok." }).catch((err) => {
                interaction.client?.container?.logger?.error?.("Failed to reply stock list empty", { error: err.message });
            });
        }

        const lines = [];
        for (const item of filteredItems) {
            const available = await repo.stockUnits.countAvailableByItemId(guildId, item.id).catch(() => 0);

            lines.push(`**${item.name}**`);
            lines.push(`- SKU: \`${item.sku}\``);
            lines.push(`- Type: ${item.type}`);
            lines.push(`- Delivery: ${item.deliveryType}`);
            lines.push(`- Available: ${available}`);

            if ((item.type === "digital" || item.type === "bundle") && available > 0) {
                const units = await repo.stockUnits.findAvailableUnitsByItemId(guildId, item.id).catch(() => []);
                const unitPreview = units.slice(0, 10).map((u, idx) => {
                    const masked = maskSecret(u.valueEncrypted);
                    return `  ${idx + 1}) ${masked ? `value: ${masked}` : `unit: ${u.id}`}`;
                });
                lines.push(`- Available units (preview up to 10):\n${unitPreview.join("\n")}`);
                if (units.length > 10) lines.push(`  ...and ${units.length - 10} more`);
            }

            lines.push("");
        }

        const content = `**Stock List (Available) — ${interaction.guild.name}**\n\n${lines.join("\n")}`.slice(0, 1900);

        return interaction.editReply({ content }).catch((error) => interaction.client?.container?.logger?.warn?.("Suppressed promise rejection", { error: error?.message ?? String(error), stack: error?.stack }));
    },
};
