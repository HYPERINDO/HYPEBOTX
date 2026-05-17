const fs = require("fs");
const path = require("path");
const { sanitizeAiData } = require("../utils/sanitizeAiData");

const cache = new Map();
const CACHE_TTL_MS = 25 * 1000;

function getCache(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return null;
    }
    return entry.value;
}

function setCache(key, value, ttlMs = CACHE_TTL_MS) {
    cache.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
    });
}

function parseCommaList(raw) {
    return String(raw || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

function safeString(value, max = 300) {
    const text = typeof value === "string" ? value : value == null ? "" : String(value);
    return text.length > max ? `${text.slice(0, max)}...` : text;
}

function buildOwnerMemberSummary(member) {
    if (!member || !member.user) return null;
    return {
        userId: member.user.id,
        username: member.user.username,
        displayName: member.displayName || member.user.username,
    };
}

async function resolveRoleMembers(guild, roleIds, roleLabel) {
    if (!guild || !Array.isArray(roleIds) || roleIds.length === 0) return [];

    const members = [];

    for (const roleId of roleIds) {
        if (!roleId) continue;
        const role = guild.roles.cache.get(roleId) || (await guild.roles.fetch(roleId).catch(() => null));
        if (!role) continue;

        let resolved = [];
        if (role.members?.size > 0) {
            resolved = Array.from(role.members.values()).slice(0, 10);
        } else {
            try {
                const fetched = await role.members.fetch({ limit: 10 });
                if (fetched && fetched.size > 0) {
                    resolved = Array.from(fetched.values());
                }
            } catch {
                // ignore
            }
        }

        if (resolved.length > 0) {
            members.push({
                roleName: role.name,
                members: resolved.map((m) => buildOwnerMemberSummary(m)).filter(Boolean),
            });
        }
    }

    return members;
}

async function resolveConfiguredOwners(guild) {
    const configuredOwnerName = String(process.env.OWNER_NAME || "").trim();
    const configuredOwnerUserId = String(process.env.OWNER_USER_ID || "").trim();
    const ownerRoleIds = parseCommaList(process.env.OWNER_ROLE_IDS);
    const coOwnerRoleIds = parseCommaList(process.env.CO_OWNER_ROLE_IDS);

    const guildOwner = await guild.fetchOwner().catch(() => null);
    const ownerSummary = guildOwner ? buildOwnerMemberSummary(guildOwner) : null;

    const ownerRoles = await resolveRoleMembers(guild, ownerRoleIds, "OWNER");
    const coOwnerRoles = await resolveRoleMembers(guild, coOwnerRoleIds, "CO-OWNER");

    const configuredOwner = configuredOwnerUserId
        ? {
            name: configuredOwnerName || null,
            userId: configuredOwnerUserId,
        }
        : null;

    return {
        guildOwner: ownerSummary,
        configuredOwner,
        ownerRoles,
        coOwnerRoles,
    };
}

function buildPriceListSummary(items) {
    if (!Array.isArray(items)) return [];
    return items.map((item) => ({
        id: item.id || item.sku || item.name || null,
        name: safeString(item.name || item.description || "", 120),
        category: item.category || "",
        priceFrom: item.price || item.priceFrom || null,
        status: item.status || (item.isActive === false ? "inactive" : "active"),
        description: safeString(item.description || "", 200),
    }));
}

function buildFaqSummary(faqs) {
    if (!Array.isArray(faqs)) return [];
    return faqs.slice(0, 40).map((faq) => ({
        keyword: String(faq.keyword || faq.question || "").trim(),
        question: String(faq.question || faq.keyword || "").trim(),
        answer: safeString(faq.answer || "", 300),
    }));
}

function buildOrderGuideSummary(guide) {
    if (!guide || typeof guide !== "object") return { steps: [], warnings: [] };
    return {
        steps: Array.isArray(guide.steps) ? guide.steps.slice(0, 25).map((step) => safeString(step, 200)) : [],
        warnings: Array.isArray(guide.warnings) ? guide.warnings.slice(0, 20).map((step) => safeString(step, 200)) : [],
    };
}

function buildQueueSummary(queueView) {
    const summary = {
        available: false,
        mode: "UNKNOWN",
        status: "UNKNOWN",
        jam: null,
        updatedAt: null,
        items: [],
    };

    if (!queueView || !Array.isArray(queueView.entries)) return summary;

    const entries = queueView.entries.slice(0, 30).map((order, index) => ({
        no: order.position != null ? order.position : index + 1,
        name: safeString(order.orderLabel || order.ticketId || `order-${order.id}`, 80),
        status: order.status || "unknown",
    }));

    const active = queueView.active;
    summary.available = entries.length > 0;
    summary.mode = active?.orderLabel?.toUpperCase().includes("ENHANCED") ? "ENHANCED" : "LEGACY";
    summary.status = active ? "PROSES" : "ANTRIAN";
    summary.updatedAt = new Date().toISOString();
    summary.items = entries;

    return summary;
}

async function loadOrderGuide() {
    const filePath = path.join(__dirname, "..", "..", "data", "order-guide.json");
    if (!fs.existsSync(filePath)) {
        return {
            steps: [
                "Pilih produk atau paket joki.",
                "Tanyakan stok ke admin.",
                "Kirim data yang diminta.",
                "Admin membuat invoice.",
                "Customer melakukan payment.",
                "Order diproses sesuai antrian.",
            ],
            warnings: [
                "Jangan kirim password di channel publik.",
                "Pastikan payment sesuai invoice.",
                "Untuk data sensitif, gunakan ticket/private channel.",
            ],
        };
    }

    try {
        const raw = fs.readFileSync(filePath, "utf8");
        return JSON.parse(raw);
    } catch {
        return {
            steps: [
                "Pilih produk atau paket joki.",
                "Tanyakan stok ke admin.",
                "Kirim data yang diminta.",
                "Admin membuat invoice.",
                "Customer melakukan payment.",
                "Order diproses sesuai antrian.",
            ],
            warnings: [
                "Jangan kirim password di channel publik.",
                "Pastikan payment sesuai invoice.",
                "Untuk data sensitif, gunakan ticket/private channel.",
            ],
        };
    }
}

function buildTicketContext(ticket) {
    if (!ticket || typeof ticket !== "object") {
        return { available: false };
    }

    return {
        available: true,
        type: ticket.type || "order",
        status: ticket.orderStatus || ticket.status || "unknown",
        packageName: ticket.packageName || ticket.product || ticket.detail || "order",
        createdAt: ticket.createdAt || ticket.createdAtAt || null,
        updatedAt: ticket.updatedAt || ticket.updatedAtAt || null,
    };
}

function safeSources(sources) {
    return Array.isArray(sources) ? Array.from(new Set(sources)) : [];
}

function buildCacheKey({ guildId, channelId, mode, question }) {
    return [`ai-scan`, guildId || "global", channelId || "none", mode || "customer", getQuestionType(question)].join(":");
}

function getQuestionType(question) {
    const q = String(question || "").toLowerCase();
    if (q.includes("owner") || q.includes("pemilik") || q.includes("co-owner") || q.includes("co owner")) return "owner";
    if (q.includes("joki") || q.includes("antrian")) return "queue";
    if (q.includes("harga") || q.includes("price") || q.includes("price list") || q.includes("pricelist") || q.includes("paket")) return "pricelist";
    if (q.includes("cara order") || (q.includes("order") && q.includes("cara"))) return "orderguide";
    if (q.includes("faq") || q.includes("pertanyaan")) return "faq";
    if (q.includes("status") || q.includes("payment") || q.includes("invoice")) return "ticket";
    return "general";
}

async function scan({ client, guild, channel, user, question, mode }) {
    const cacheKey = buildCacheKey({ guildId: guild?.id, channelId: channel?.id, mode, question });
    const cached = getCache(cacheKey);
    if (cached) {
        return cached;
    }

    const storeOpsService = client?.container?.services?.storeOpsService;
    const jokiService = client?.container?.services?.jokiService;
    const ticketRepository = client?.container?.repositories?.ticketRepository;

    const result = {
        ok: true,
        sources: [],
        data: {
            guildOwner: null,
            configuredOwner: null,
            ownerRoles: [],
            coOwnerRoles: [],
            priceList: [],
            faq: [],
            orderGuide: { steps: [], warnings: [] },
            queue: { available: false, mode: "UNKNOWN", status: "UNKNOWN", jam: null, updatedAt: null, items: [] },
            ticket: { available: false },
            server: { channels: [], roles: [] },
        },
        warnings: [],
    };

    if (guild) {
        try {
            const ownerData = await resolveConfiguredOwners(guild);
            result.data.guildOwner = ownerData.guildOwner;
            result.data.configuredOwner = ownerData.configuredOwner;
            result.data.ownerRoles = ownerData.ownerRoles;
            result.data.coOwnerRoles = ownerData.coOwnerRoles;
            result.sources.push("discord:guild-owner-role");

            const channelNames = [];
            if (guild.channels?.cache) {
                for (const channelEntry of guild.channels.cache.values()) {
                    if (!channelEntry?.name) continue;
                    const lower = String(channelEntry.name).toLowerCase();
                    if (/[a-z0-9]/.test(lower) && (lower.includes("joki") || lower.includes("order") || lower.includes("ticket") || lower.includes("refund") || lower.includes("payment") || lower.includes("faq") || lower.includes("invoice") || lower.includes("price") || lower.includes("warranty"))) {
                        channelNames.push(`#${channelEntry.name}`);
                    }
                }
            }
            result.data.server.channels = channelNames.slice(0, 40);

            const roleNames = [];
            if (guild.roles?.cache) {
                for (const role of guild.roles.cache.values()) {
                    if (!role?.name) continue;
                    const lower = role.name.toLowerCase();
                    if (lower.includes("owner") || lower.includes("co-owner") || lower.includes("admin") || lower.includes("staff") || lower.includes("support")) {
                        roleNames.push(role.name);
                    }
                }
            }
            result.data.server.roles = Array.from(new Set(roleNames)).slice(0, 40);
            if (result.data.server.roles.length > 0) {
                result.sources.push("discord:server-meta");
            }
        } catch (error) {
            result.warnings.push("Gagal membaca metadata server. Pastikan intent GuildMembers dan channel cache tersedia.");
        }
    }

    if (storeOpsService) {
        try {
            const priceList = await storeOpsService.getPriceListSummary?.(guild?.id) || [];
            result.data.priceList = priceList;
            if (priceList.length) result.sources.push("database:pricelist");
        } catch (error) {
            result.warnings.push("Gagal membaca pricelist dari database.");
        }

        try {
            const faq = await storeOpsService.getFaqSummary?.(guild?.id) || [];
            result.data.faq = faq;
            if (faq.length) result.sources.push("database:faq");
        } catch (error) {
            result.warnings.push("Gagal membaca FAQ dari database.");
        }

        try {
            const orderGuide = await storeOpsService.getOrderGuideSummary?.(guild?.id);
            result.data.orderGuide = buildOrderGuideSummary(orderGuide);
            if (result.data.orderGuide.steps.length) result.sources.push("database:order-guide");
        } catch (error) {
            result.warnings.push("Gagal membaca panduan order.");
        }
    }

    if (jokiService) {
        try {
            const queueSummary = await jokiService.getQueueSummary?.(guild);
            if (queueSummary && typeof queueSummary === "object") {
                result.data.queue = queueSummary;
                result.sources.push("database:joki-queue");
            }
        } catch (error) {
            result.warnings.push("Gagal membaca antrian joki.");
        }
    }

    if (channel && ticketRepository) {
        try {
            const ticket = await ticketRepository.findByChannelId(channel.id).catch(() => null);
            if (ticket) {
                result.data.ticket = buildTicketContext(ticket);
                result.sources.push("database:ticket-context");
            } else if (String(channel.name || "").toLowerCase().includes("ticket")) {
                result.data.ticket = { available: false };
                result.warnings.push("Channel ticket terdeteksi, namun data ticket tidak ditemukan di database.");
            }
        } catch (error) {
            result.warnings.push("Gagal membaca konteks ticket channel.");
        }
    }

    const sanitized = sanitizeAiData(result);
    const finalResult = {
        ...result,
        data: sanitized.data || result.data,
    };

    setCache(cacheKey, finalResult);
    return finalResult;
}

function createAiToolScannerService() {
    return {
        scan,
    };
}

module.exports = {
    createAiToolScannerService,
};
