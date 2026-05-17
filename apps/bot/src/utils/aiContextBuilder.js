const fs = require("fs");
const path = require("path");

function safeString(value, max = 4000) {
  const s = typeof value === "string" ? value : value == null ? "" : String(value);
  if (s.length <= max) return s;
  return s.slice(0, max) + "\n...";
}

function resolveKnowledgeBasePath() {
  const candidates = [
    process.env.PANDUAN_FILE_PATH,
    path.join(process.cwd(), "docs", "PANDUAN_FINAL_HYPEBOTX.md"),
    path.join(process.cwd(), "PANDUAN_FINAL_HYPEBOTX.md"),
    path.join(__dirname, "..", "..", "docs", "PANDUAN_FINAL_HYPEBOTX.md"),
    path.join(__dirname, "..", "..", "..", "docs", "PANDUAN_FINAL_HYPEBOTX.md"),
    path.join(__dirname, "..", "..", "..", "..", "docs", "PANDUAN_FINAL_HYPEBOTX.md"),
  ].filter((candidate) => typeof candidate === "string" && candidate.trim().length > 0);

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function safeExtractPanduanSnippets(text) {
  if (!text || typeof text !== "string") return [];
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const snippets = [];
  for (const line of lines) {
    if (!line) continue;
    if (/^#{1,6}\s+/.test(line)) {
      snippets.push(line.replace(/^#{1,6}\s+/, "").trim());
    } else if (
      line.includes("`/price`") ||
      line.includes("`/order`") ||
      line.includes("`/status`") ||
      line.includes("`/faq`") ||
      line.includes("`/refund`") ||
      line.includes("`/warranty`")
    ) {
      snippets.push(line);
    }
    if (snippets.length >= 80) break;
  }
  return snippets;
}

function getPanduanSnippets() {
  try {
    const kbPath = resolveKnowledgeBasePath();
    if (!kbPath) return [];
    const raw = fs.readFileSync(kbPath, "utf8");
    return safeExtractPanduanSnippets(raw);
  } catch {
    return [];
  }
}

async function buildAIContext({ client, guildId }) {
  const storeOpsService = client?.container?.services?.storeOpsService;

  // Always include non-sensitive KB/panduan
  const panduan = getPanduanSnippets();

  // Sync with server (safe): include existing channel names relevant to pricing/faq/payment/order/joki.
  // This helps AI "sync" with actual server structure without accessing sensitive data.
  let serverChannelsText = "";
  try {
    const guild = client?.guilds?.cache?.get?.(guildId) || null;
    const channelNames = new Set();

    if (guild?.channels?.cache) {
      for (const ch of guild.channels.cache.values()) {
        const name = String(ch?.name || "");
        const lower = name.toLowerCase();

        // Keep it targeted (pricing/faq/payment/order/joki/ticket/invoice/refund)
        const shouldInclude =
          lower.includes("joki") ||
          lower.includes("pricing") ||
          lower.includes("price") ||
          lower.includes("pricelist") ||
          lower.includes("faq") ||
          lower.includes("payment") ||
          lower.includes("invoice") ||
          lower.includes("refund") ||
          lower.includes("warranty") ||
          lower.includes("order") ||
          lower.includes("ticket") ||
          lower.includes("admin");

        if (shouldInclude && lower) channelNames.add(`#${name}`);
      }
    }

    if (channelNames.size > 0) {
      serverChannelsText = `Server channel references (from guild metadata):\n${Array.from(channelNames).slice(0, 60).join("\n")}`;
    }

    const roleNames = new Set();
    if (guild?.roles?.cache) {
      for (const role of guild.roles.cache.values()) {
        const name = String(role?.name || "").trim();
        const lower = name.toLowerCase();
        if (
          lower.includes("owner") ||
          lower.includes("co-owner") ||
          lower.includes("admin") ||
          lower.includes("staff") ||
          lower.includes("support") ||
          lower.includes("moderator")
        ) {
          roleNames.add(name);
        }
      }
    }

    if (roleNames.size > 0) {
      serverChannelsText += serverChannelsText ? "\n\n" : "";
      serverChannelsText += `Server role references (from guild metadata):\n${Array.from(roleNames).slice(0, 30).map((name) => `- ${name}`).join("\n")}`;
    }
  } catch {
    // ignore
  }

  // Include price list as compact text (safe: no secrets)
  let priceListText = "";
  try {
    const priceList = await storeOpsService?.getPriceList?.(guildId);
    if (Array.isArray(priceList) && priceList.length) {
      const rows = priceList.slice(0, 150).map((row) => {
        const name = row?.name ? String(row.name) : "";
        const price = row?.price ? String(row.price) : "";
        const category = row?.category ? String(row.category) : "";
        return `- ${name} (${category}) => ${price}`;
      });
      priceListText = rows.join("\n");
    }
  } catch {
    // ignore
  }

  // FAQ snippets (safe: stored content, no secrets)
  let faqText = "";
  try {
    if (storeOpsService?.findFaq && storeOpsService?.getAllFaqs) {
      const faqs = await storeOpsService.getAllFaqs(guildId);
      if (Array.isArray(faqs) && faqs.length) {
        faqText = faqs.slice(0, 30).map((f) => `- ${f.keyword}: ${safeString(f.answer, 200)}`).join("\n");
      }
    }
  } catch {
    // ignore
  }

  // Final context for systemPrompt
  const contextParts = [];
  if (panduan.length) contextParts.push(`Panduan/commands penting:\n${panduan.map((x) => `- ${x}`).join("\n")}`);
  if (priceListText) contextParts.push(`Price list (ringkas):\n${priceListText}`);
  if (faqText) contextParts.push(`FAQ (ringkas):\n${faqText}`);
  if (serverChannelsText) contextParts.push(serverChannelsText);

  // Hard guard: tell model not to invent or claim access to protected data.
  contextParts.push(
    `Catatan keamanan: kamu hanya boleh menjawab berdasarkan konteks yang tersedia (Panduan/price list/FAQ/Server channel/Server role). Jangan mengklaim mengetahui data sensitif internal atau data pribadi user. Jika data tidak ada, sarankan user cek /faq atau hubungi admin.`
  );

  return contextParts.join("\n\n");
}

module.exports = {
  buildAIContext,
};
