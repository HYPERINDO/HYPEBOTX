const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { staffCommand } = require("../../config/permissions");
const { sanitizeText } = require("../../utils/validators");
const { createStockRepository } = require("../../repositories/stockRepository");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("stock-edit")
        .setDescription("Edit metadata item stock berdasarkan SKU.")
        .setDefaultMemberPermissions(staffCommand)
        .addStringOption((option) =>
            option.setName("sku").setDescription("SKU item").setRequired(true),
        )
        .addStringOption((option) =>
            option.setName("name").setDescription("Nama item").setRequired(false),
        )
        .addStringOption((option) =>
            option.setName("deliverytype").setDescription("manual / auto").setRequired(false).addChoices(
                { name: "manual", value: "manual" },
                { name: "auto", value: "auto" },
            ),
        )
        .addStringOption((option) =>
            option.setName("type").setDescription("digital / non_digital / bundle").setRequired(false).addChoices(
                { name: "digital", value: "digital" },
                { name: "non_digital", value: "non_digital" },
                { name: "bundle", value: "bundle" },
            ),
        )
        .addStringOption((option) =>
            option.setName("price").setDescription("Harga (opsional)").setRequired(false),
        )
        .addIntegerOption((option) =>
            option.setName("lowthreshold").setDescription("Low stock threshold").setRequired(false),
        )
        .addStringOption((option) =>
            option.setName("isactive").setDescription("active?").setRequired(false).addChoices(
                { name: "true", value: "true" },
                { name: "false", value: "false" },
            ),
        ),
    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const repo = createStockRepository(interaction.client.container.database);

        const guildId = interaction.guild.id;
        const sku = sanitizeText(interaction.options.getString("sku", true), 50);

        const item = await repo.stockItems.findBySku(guildId, sku);
        if (!item) {
            return interaction.editReply({ content: `[ERROR] Item stock tidak ditemukan untuk SKU \`${sku}\`.` }).catch((error) => interaction.client?.container?.logger?.warn?.("Suppressed promise rejection", { error: error?.message ?? String(error), stack: error?.stack }));
        }

        const updates = {};
        const name = sanitizeText(interaction.options.getString("name", false), 500);
        const deliveryType = sanitizeText(interaction.options.getString("deliverytype", false), 500);
        const type = sanitizeText(interaction.options.getString("type", false), 500);
        const price = sanitizeText(interaction.options.getString("price", false), 500);
        const lowthreshold = interaction.options.getInteger("lowthreshold", false);
        const isactiveRaw = sanitizeText(interaction.options.getString("isactive", false), 500);

        if (name) updates.name = sanitizeText(name, 100);
        if (deliveryType) updates.deliveryType = deliveryType;
        if (type) updates.type = type;
        if (price) updates.price = sanitizeText(price, 200);
        if (Number.isFinite(lowthreshold)) updates.lowStockThreshold = lowthreshold;
        if (isactiveRaw) updates.isActive = isactiveRaw === "true";

        if (!Object.keys(updates).length) {
            return interaction.editReply({ content: "[OK] Tidak ada field yang diubah. Isi minimal satu opsi." }).catch((error) => interaction.client?.container?.logger?.warn?.("Suppressed promise rejection", { error: error?.message ?? String(error), stack: error?.stack }));
        }

        const updated = await repo.stockItems.updateById(item.id, updates);
        if (!updated) {
            return interaction.editReply({ content: "[ERROR] Gagal update item stock." }).catch((error) => interaction.client?.container?.logger?.warn?.("Suppressed promise rejection", { error: error?.message ?? String(error), stack: error?.stack }));
        }

        return interaction.editReply({
            content: `[OK] Stock item updated.\nSKU: \`${sku}\`\nItem: ${updated.name}\nDelivery: ${updated.deliveryType}\nType: ${updated.type}\nPrice: ${updated.price || "-"}`,
        }).catch((error) => interaction.client?.container?.logger?.warn?.("Suppressed promise rejection", { error: error?.message ?? String(error), stack: error?.stack }));
    },
};
