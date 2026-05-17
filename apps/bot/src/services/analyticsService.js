const { createEmbed } = require("../utils/embed");

function safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function unique(arr) {
  return Array.from(new Set(Array.isArray(arr) ? arr : []));
}

function parseMoneyLike(v) {
  // repositories kadang bisa menyimpan angka/decimal string
  if (typeof v === "number") return v;
  if (!v) return 0;
  const raw = String(v).trim();
  if (!raw) return 0;

  // handle "1.234,56" / "1234.56" / "1234"
  const normalized = raw
    .replace(/Rp\.?\s*/i, "")
    .replace(/\s+/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function createAnalyticsService({ repositories, logger, services }) {
  async function getAnalyticsForGuild(guildId) {
    if (!guildId) return { ok: false, message: "Missing guildId" };

    const orderRepo = repositories.orderRepository;
    const paymentRepo = repositories.paymentRepository;
    const ticketRepo = repositories.ticketRepository;
    const userRepo = repositories.userRepository;

    // Best-effort fetch: use getAll when available
    const orders = await (orderRepo?.getAll?.().catch(() => []) || Promise.resolve([]));
    const payments = await (paymentRepo?.getAll?.().catch(() => []) || Promise.resolve([]));
    const tickets = await (ticketRepo?.getAll?.().catch(() => []) || Promise.resolve([]));
    const users = await (userRepo?.getAll?.().catch(() => []) || Promise.resolve([]));

    const ordersInGuild = Array.isArray(orders) ? orders.filter((o) => String(o.guildId) === String(guildId)) : [];
    const paymentsInGuild = Array.isArray(payments) ? payments.filter((p) => String(p.guildId) === String(guildId)) : [];
    const ticketsInGuild = Array.isArray(tickets) ? tickets.filter((t) => String(t.guildId) === String(guildId)) : [];
    const usersInGuild = Array.isArray(users) ? users.filter((u) => String(u.guildId) === String(guildId)) : [];

    const totalOrders = ordersInGuild.length;

    // Revenue = sum amount of paid payments (status === paid)
    const revenue = paymentsInGuild
      .filter((p) => String(p.status || "").toLowerCase() === "paid")
      .reduce((sum, p) => sum + parseMoneyLike(p.amount), 0);

    const openTickets = ticketsInGuild.filter((t) => String(t.status || "").toLowerCase() === "open").length;
    const closedTickets = ticketsInGuild.length - openTickets;

    const activeCustomerIds = unique([
      ...ticketsInGuild
        .filter((t) => ["open", "reopened"].includes(String(t.status || "").toLowerCase()))
        .map((t) => t.openerId),
      ...ordersInGuild
        .filter((o) => {
          const s = String(o.status || "").toLowerCase();
          return !["completed", "cancelled", "refunded", "refund"].includes(s);
        })
        .map((o) => o.userId),
    ]).filter(Boolean);

    // Package stats: group by order.product and/or service_type/category
    const packageBuckets = new Map();
    for (const o of ordersInGuild) {
      const key = String(o.product || o.service_type || o.category || "unknown").slice(0, 40);
      packageBuckets.set(key, (packageBuckets.get(key) || 0) + 1);
    }
    const topPackages = Array.from(packageBuckets.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => `${name} (${count})`);

    // Admin activity: prefer auditService if exists
    // Because we don't have an audit table query contract here, we just expose last-known counters if possible.
    let adminActivity = "N/A";
    try {
      if (services?.auditService?.getAdminActivitySummary) {
        const res = await services.auditService.getAdminActivitySummary(guildId);
        adminActivity = res?.summary || JSON.stringify(res || {});
      }
    } catch {
      // ignore
    }

    // Chatbot usage: best-effort from chatbotService counters if exists
    let chatbotUsage = 0;
    try {
      if (services?.chatbotService?.getUsageStats) {
        const stats = await services.chatbotService.getUsageStats(guildId);
        chatbotUsage = safeNumber(stats?.total || stats?.count);
      }
    } catch {
      chatbotUsage = 0;
    }

    // Ticket statistics
    const ticketStats = {
      totalTickets: ticketsInGuild.length,
      openTickets,
      closedTickets,
    };

    const analytics = {
      ok: true,
      guildId,
      totalOrders,
      revenue,
      activeCustomerCount: activeCustomerIds.length,
      ticketStats,
      topPackages,
      chatbotUsage,
      adminActivity,
      usersInGuildCount: usersInGuild.length,
    };

    return analytics;
  }

  function buildAnalyticsEmbed({ analytics, guildName = "HYPEBOTX" }) {
    const revenueText = analytics.revenue ? `${analytics.revenue.toLocaleString("id-ID")}` : "0";
    const topPackagesText = analytics.topPackages?.length ? analytics.topPackages.join("\n") : "-";

    return createEmbed({
      title: `📊 Analytics — ${guildName}`,
      description: [
        `**Total Order:** ${analytics.totalOrders}`,
        `**Revenue (paid payments):** ${revenueText}`,
        `**Active Customer:** ${analytics.activeCustomerCount}`,
        ``,
        `**Tickets:** ${analytics.ticketStats.totalTickets} (Open: ${analytics.ticketStats.openTickets} / Closed: ${analytics.ticketStats.closedTickets})`,
        ``,
        `**Top Packages (by order count):**`,
        topPackagesText,
        ``,
        `**Chatbot Usage:** ${analytics.chatbotUsage}`,
        `**Admin Activity:** ${analytics.adminActivity}`,
      ].join("\n"),
      color: 0x5865f2,
      footer: "HYPEBOTX",
    });
  }

  return {
    getAnalyticsForGuild,
    buildAnalyticsEmbed,
  };
}

module.exports = {
  createAnalyticsService,
};
