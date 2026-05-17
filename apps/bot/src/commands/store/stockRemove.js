const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { staffCommand } = require("../../config/permissions");
const { sanitizeText } = require("../../utils/validators");
const { createStockRepository } = require("../../repositories/stockRepository");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("stock-remove")
        .setDescription("Hapus/void stok berdasarkan SKU.")
        .setDefaultMemberPermissions(staffCommand)
        .addStringOption((option) =>
            option.setName("sku").setDescription("SKU item").setRequired(true),
        )
        .addStringOption((option) =>
            option.setName("mode").setDescription("soft=void units, hard=delete units").setRequired(false).addChoices(
                { name: "soft (void)", value: "soft" },
                { name: "hard (delete)", value: "hard" },
            ),
        ),
    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const repo = createStockRepository(interaction.client.container.database);

        const guildId = interaction.guild.id;
        const sku = sanitizeText(interaction.options.getString("sku", true), 50);
        const mode = sanitizeText(interaction.options.getString("mode", false), 500) || "soft";

        const item = await repo.stockItems.findBySku(guildId, sku);
        if (!item) {
            return interaction.editReply({ content: `[ERROR] Item stock tidak ditemukan untuk SKU \`${sku}\`.` }).catch((err) => {
                interaction.client?.container?.logger?.error?.("Failed to reply stock remove not found", { error: err.message });
            });
        }

        const allUnits = await repo.stockUnits.getAll(guildId);
        const units = allUnits.filter((u) => u.itemId === item.id);

        if (!units.length) {
            await repo.stockItems.deleteById(item.id).catch((err) => {
                interaction.client?.container?.logger?.error?.("Failed to delete empty stock item", { error: err.message, sku });
            });
            return interaction.editReply({ content: `[OK] Stock item removed. SKU: \`${sku}\` (tidak ada unit tersisa).` }).catch((err) => {
                interaction.client?.container?.logger?.error?.("Failed to reply stock remove success", { error: err.message });
            });
        }

        // Safety rules:
        // - soft default: only void available units
        // - if there are reserved/sold units, block both soft & hard removals
        const unsafeUnits = units.filter((u) => !["available"].includes(u.status));
        if (unsafeUnits.length > 0) {
            const unsafeStatuses = Array.from(new Set(unsafeUnits.map((u) => u.status))).join(", ");
            return interaction.editReply({
                content: `[ERROR] Tidak bisa remove stock. SKU \`${sku}\` memiliki unit non-available (status: ${unsafeStatuses}).`,
            }).catch((error) => interaction.client?.container?.logger?.warn?.("Suppressed promise rejection", { error: error?.message ?? String(error), stack: error?.stack }));
        }

        if (mode === "hard") {
            for (const u of units) {
                await repo.stockUnits.deleteById(u.id).catch((error) => interaction.client?.container?.logger?.warn?.("Suppressed promise rejection", { error: error?.message ?? String(error), stack: error?.stack }));
            }
            await repo.stockItems.deleteById(item.id).catch((error) => interaction.client?.container?.logger?.warn?.("Suppressed promise rejection", { error: error?.message ?? String(error), stack: error?.stack }));
        } else {
            for (const u of units) {
                await repo.stockUnits.updateById(u.id, { status: "void" }).catch((error) => interaction.client?.container?.logger?.warn?.("Suppressed promise rejection", { error: error?.message ?? String(error), stack: error?.stack }));
            }
        }

        return interaction.editReply({
            content: `[OK] Stock removed.\nSKU: \`${sku}\`\nItem: ${item.name}\nUnits affected: ${units.length}\nMode: ${mode}`,
        }).catch((error) => interaction.client?.container?.logger?.warn?.("Suppressed promise rejection", { error: error?.message ?? String(error), stack: error?.stack }));
    },
};
