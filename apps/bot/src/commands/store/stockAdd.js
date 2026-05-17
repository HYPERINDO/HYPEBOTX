const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { staffCommand } = require("../../config/permissions");
const { sanitizeText } = require("../../utils/validators");
const { createStockRepository } = require("../../repositories/stockRepository");

function parseUnitsMultiline(raw) {
    if (!raw || typeof raw !== "string") return [];
    return raw
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("stock-add")
        .setDescription("Tambah stok item (digital/non-digital) ke inventory.")
        .setDefaultMemberPermissions(staffCommand)
        .addStringOption((option) =>
            option.setName("category").setDescription("Kategori/tipe layanan (mis. windows, office, game_account).").setRequired(true),
        )
        .addStringOption((option) =>
            option.setName("sku").setDescription("SKU unik item (mis. WIN10PRO-KEY-01).").setRequired(true),
        )
        .addStringOption((option) =>
            option.setName("name").setDescription("Nama item/display name.").setRequired(true),
        )
        .addStringOption((option) =>
            option.setName("type").setDescription("digital / non_digital / bundle").setRequired(true).addChoices(
                { name: "digital", value: "digital" },
                { name: "non_digital", value: "non_digital" },
                { name: "bundle", value: "bundle" },
            ),
        )
        .addStringOption((option) =>
            option.setName("deliverytype").setDescription("manual / auto").setRequired(false).addChoices(
                { name: "manual", value: "manual" },
                { name: "auto", value: "auto" },
            ),
        )
        .addStringOption((option) =>
            option.setName("valueencr").setDescription("Untuk type digital: isi tiap unit value (key/akun/lisensi) per baris. Kosongkan untuk non-digital.").setRequired(false),
        )
        .addIntegerOption((option) =>
            option.setName("quantity").setDescription("Untuk type non_digital: jumlah unit yang ditambahkan.").setRequired(false),
        )
        .addStringOption((option) =>
            option.setName("price").setDescription("Harga (opsional, untuk display/invoice).").setRequired(false),
        ),
    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const category = sanitizeText(interaction.options.getString("category", true), 50);
        const sku = sanitizeText(interaction.options.getString("sku", true), 50);
        const name = sanitizeText(interaction.options.getString("name", true), 100);
        const type = String(sanitizeText(interaction.options.getString("type", true), 500)).toLowerCase();

        const deliveryType = sanitizeText(interaction.options.getString("deliverytype", false), 500) || "manual";
        const price = sanitizeText(interaction.options.getString("price", false), 500) || "";

        if (!["digital", "non_digital", "bundle"].includes(type)) {
            return interaction.editReply({ content: "[ERROR] type harus digital / non_digital / bundle." }).catch((err) => {
                interaction.client?.container?.logger?.error?.("Failed to reply stock add type error", { error: err.message });
            });
        }

        const repo = createStockRepository(interaction.client.container.database);

        const categoryRow = await repo.ensureCategoryForKey(interaction.guild.id, category);

        const existingItem = await repo.stockItems.findBySku(interaction.guild.id, sku);
        let itemRow = existingItem;

        if (!itemRow) {
            itemRow = await repo.stockItems.create({
                guildId: interaction.guild.id,
                categoryId: categoryRow.id,
                sku,
                name,
                description: "",
                deliveryType,
                type,
                price,
                isActive: true,
                lowStockThreshold: 0,
            });
        } else {
            // update metadata (name/type/deliveryType/price) best-effort
            await repo.stockItems.updateById(itemRow.id, {
                name,
                deliveryType,
                type,
                price,
                updatedAt: new Date().toISOString(),
            }).catch((error) => interaction.client?.container?.logger?.warn?.("Suppressed promise rejection", { error: error?.message ?? String(error), stack: error?.stack }));
        }

        const unitsToAdd = [];
        if (type === "digital" || type === "bundle") {
            const raw = sanitizeText(interaction.options.getString("valueencr", false), 500) || "";
            const lines = parseUnitsMultiline(raw);
            if (!lines.length) {
                return interaction.editReply({ content: "[ERROR] Untuk type digital/bundle, valueencr wajib diisi (tiap unit per baris)." }).catch((error) => interaction.client?.container?.logger?.warn?.("Suppressed promise rejection", { error: error?.message ?? String(error), stack: error?.stack }));
            }

            for (const v of lines) {
                unitsToAdd.push(v);
            }
        } else {
            const quantity = interaction.options.getInteger("quantity", false);
            if (!Number.isFinite(quantity) || quantity <= 0) {
                return interaction.editReply({ content: "[ERROR] Untuk type non_digital, quantity wajib > 0." }).catch((error) => interaction.client?.container?.logger?.warn?.("Suppressed promise rejection", { error: error?.message ?? String(error), stack: error?.stack }));
            }
            for (let i = 0; i < quantity; i += 1) {
                unitsToAdd.push(null);
            }
        }

        const createdUnits = [];
        for (const valueEncrypted of unitsToAdd) {
            const unit = await repo.stockUnits.create({
                guildId: interaction.guild.id,
                itemId: itemRow.id,
                valueEncrypted: valueEncrypted,
                skuSnapshot: sku,
                nameSnapshot: name,
                status: "available",
                reservedByOrderId: null,
                reservedAt: null,
                soldToOrderId: null,
                deliveredAt: null,
                addedBy: interaction.user.id,
            });
            createdUnits.push(unit);
        }

        const availableCount = await repo.stockUnits.countAvailableByItemId(interaction.guild.id, itemRow.id).catch(() => null);

        return interaction.editReply({
            content: `[OK] Stock ditambah.\nCategory: ${category}\nSKU: ${sku}\nItem: ${name}\nType: ${type}\nUnits added: ${createdUnits.length}\nAvailable: ${availableCount ?? "-"}`,
        }).catch((error) => interaction.client?.container?.logger?.warn?.("Suppressed promise rejection", { error: error?.message ?? String(error), stack: error?.stack }));
    },
};
