/**
 * Seed Price List Script
 *
 * Populates the price-list.json with the full HYPERINDO GTA V Online catalog.
 * Can be run standalone (without Discord bot login) since it only writes to JSON storage.
 *
 * Usage:
 *   node scripts/seedPriceList.js [--guild <guildId>] [--force]
 *
 * Options:
 *   --guild <guildId>  Target guild ID (defaults to GUILD_ID from .env.local or .env)
 *   --force            Overwrite existing entries with the same name
 */

const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

const rootPath = path.resolve(__dirname, "..");
const envFile = process.env.ENV_FILE || ".env.local";
const envPath = path.join(rootPath, envFile);
const fallbackEnvPath = path.join(rootPath, ".env");
dotenv.config({ path: fs.existsSync(envPath) ? envPath : fallbackEnvPath });

const { getAllProducts } = require("../apps/bot/src/config/pricelist");

const storagePath = path.join(rootPath, "apps", "bot", "src", "storage", "temp");
const priceListFile = path.join(storagePath, "price-list.json");

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let guildId = process.env.GUILD_ID || "";
  let force = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--guild" && args[i + 1]) {
      guildId = args[++i];
    } else if (args[i] === "--force") {
      force = true;
    }
  }
  return { guildId, force };
}

async function main() {
  const { guildId, force } = parseArgs();

  if (!guildId) {
    console.error("❌ Guild ID tidak ditemukan. Set GUILD_ID di .env atau gunakan --guild <id>");
    process.exit(1);
  }

  console.log(`🏪 Seeding price list untuk guild: ${guildId}`);
  console.log(`   Force overwrite: ${force}`);

  // Read existing
  let existing = [];
  try {
    const raw = fs.readFileSync(priceListFile, "utf8");
    existing = JSON.parse(raw);
    if (!Array.isArray(existing)) existing = [];
  } catch {
    existing = [];
  }

  const products = getAllProducts();
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const product of products) {
    const matchIdx = existing.findIndex(
      (row) =>
        row.guildId === guildId &&
        String(row.name || "").toLowerCase() === String(product.name || "").toLowerCase(),
    );

    const entry = {
      guildId,
      name: product.name,
      price: product.price,
      numericPrice: product.numericPrice,
      description: product.description || "",
      category: product.category || "",
      sku: null,
      isActive: true,
      sortOrder: product.sortOrder || 0,
      actorId: "SYSTEM_SEED",
    };

    if (matchIdx >= 0) {
      if (force) {
        existing[matchIdx] = {
          ...existing[matchIdx],
          ...entry,
          updatedAt: new Date().toISOString(),
        };
        updated++;
      } else {
        skipped++;
      }
    } else {
      existing.push({
        id: uid("PRICE"),
        ...entry,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      created++;
    }
  }

  // Sort by sortOrder
  existing.sort((a, b) => (Number(a.sortOrder || 0) - Number(b.sortOrder || 0)));

  // Write back
  fs.writeFileSync(priceListFile, JSON.stringify(existing, null, 2), "utf8");

  console.log(`\n✅ Seeding selesai!`);
  console.log(`   Created: ${created}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total entries: ${existing.length}`);
  console.log(`   File: ${priceListFile}`);
}

main().catch((error) => {
  console.error("❌ Seed gagal:", error.message);
  process.exit(1);
});
