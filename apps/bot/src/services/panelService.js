const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const roleNames = require("../config/roles");
const { hasAdminPermission, hasNamedRole, isOwnerOrStaff } = require("../utils/permissionCheck");
const { safeReply } = require("../utils/discordResponse");

const PANEL_PREFIX = "hbx:panel";
const PANEL_IDS = {
  customer: "customer",
  admin: "admin",
  owner: "owner",
  dev: "dev",
  setup: "setup",
};

const DANGEROUS_ACTIONS = new Set([
  "order:refund",
  "order:dispute",
  "order:close",
  "joki:clear",
  "joki:apply-sync",
  "joki:mass-done",
  "store:remove-stock",
  "store:disable-product",
  "store:disable-coupon",
  "customer:blacklist",
  "owner:maintenance-enable",
  "owner:maintenance-disable",
  "owner:dashboard-stop",
  "owner:dashboard-restart",
  "owner:backup-restore",
  "owner:whitelist-remove",
  "owner:recovery-apply",
  "setup:restore-structure",
  "setup:apply-permissions",
  "setup:rename-channels",
  "setup:sort-channels",
  "setup:rapihin",
  "dev:pm2-start",
  "dev:pm2-stop",
  "dev:pm2-restart",
]);

const PANEL_DEFINITIONS = {
  customer: {
    title: "HYPEBOTX GAME STORE",
    description: "Pilih kebutuhan store dari panel. Order berjalan bertahap: kategori, layanan, form, payment, review, confirm.",
    color: 0x2f80ed,
    buttons: [
      ["Order", "customer:order", ButtonStyle.Primary],
      ["Pricelist", "customer:pricelist", ButtonStyle.Secondary],
      ["Status Order", "customer:status", ButtonStyle.Secondary],
      ["Ticket Support", "customer:ticket", ButtonStyle.Secondary],
      ["Warranty", "customer:warranty", ButtonStyle.Secondary],
      ["FAQ", "customer:faq", ButtonStyle.Secondary],
    ],
  },
  admin: {
    title: "HYPEBOTX ADMIN STORE PANEL",
    description: "Dashboard operasional store. Pilih kategori, lalu pilih action dari select menu.",
    color: 0x57f287,
    buttons: [
      ["Order", "admin:order", ButtonStyle.Primary],
      ["Payment", "admin:payment", ButtonStyle.Primary],
      ["Ticket", "admin:ticket", ButtonStyle.Secondary],
      ["Joki", "admin:joki", ButtonStyle.Secondary],
      ["Store", "admin:store", ButtonStyle.Secondary],
      ["Customer", "admin:customer", ButtonStyle.Secondary],
      ["Report", "admin:report", ButtonStyle.Secondary],
    ],
  },
  owner: {
    title: "HYPEBOTX OWNER CONTROL CENTER",
    description: "Hosting, recovery, backup, whitelist, dan production control. Aksi risiko tinggi selalu butuh reason dan confirm.",
    color: 0xf2c94c,
    buttons: [
      ["Maintenance", "owner:maintenance", ButtonStyle.Primary],
      ["Dashboard", "owner:dashboard", ButtonStyle.Secondary],
      ["Backup", "owner:backup", ButtonStyle.Secondary],
      ["Whitelist", "owner:whitelist", ButtonStyle.Secondary],
      ["Recovery", "owner:recovery", ButtonStyle.Secondary],
      ["Security", "owner:security", ButtonStyle.Secondary],
      ["Production Health", "owner:health", ButtonStyle.Secondary],
    ],
  },
  dev: {
    title: "HYPEBOTX DEVOPS PANEL",
    description: "QA gate, PM2, logs, storage safety, dan command sync. Shell/destructive action ditahan di confirm gate.",
    color: 0x9b51e0,
    buttons: [
      ["QA Gate", "dev:qa", ButtonStyle.Primary],
      ["PM2", "dev:pm2", ButtonStyle.Secondary],
      ["Logs", "dev:logs", ButtonStyle.Secondary],
      ["CI/CD", "dev:cicd", ButtonStyle.Secondary],
      ["Storage Safety", "dev:storage", ButtonStyle.Secondary],
      ["Command Sync", "dev:commands", ButtonStyle.Secondary],
      ["Dev Guide", "dev:guide", ButtonStyle.Secondary],
    ],
  },
  setup: {
    title: "HYPEBOTX SETUP PANEL",
    description: "Setup server, panel sender, struktur, terms, dan backup struktur. Action berbahaya masuk confirm gate.",
    color: 0x56ccf2,
    buttons: [
      ["Gamestore Setup", "setup:gamestore", ButtonStyle.Primary],
      ["Role Setup", "setup:roles", ButtonStyle.Secondary],
      ["Panel Sender", "setup:sender", ButtonStyle.Secondary],
      ["Server Structure", "setup:structure", ButtonStyle.Secondary],
      ["Terms / Format", "setup:terms", ButtonStyle.Secondary],
      ["Backup Structure", "setup:backup", ButtonStyle.Secondary],
    ],
  },
};

const ACTION_GROUPS = {
  "admin:order": [
    ["Order Baru", "order:new"],
    ["Pending Payment", "order:pending-payment"],
    ["Processing", "order:processing"],
    ["Done", "order:done"],
    ["Bermasalah", "order:issue"],
    ["Cari Order by ID", "order:search"],
    ["Add Note", "order:add-note"],
    ["Refund", "order:refund"],
    ["Dispute", "order:dispute"],
    ["Close Order", "order:close"],
  ],
  "admin:payment": [
    ["Payment Pending Review", "payment:pending"],
    ["Payment Approved", "payment:approved"],
    ["Payment Rejected", "payment:rejected"],
    ["Cek Payment ID", "payment:search"],
    ["Mutasi Masuk", "payment:mutasi-add"],
    ["Match Mutasi", "payment:mutasi-match"],
    ["Setting Payment Method", "payment:setting"],
  ],
  "admin:ticket": [
    ["Ticket Baru", "ticket:new"],
    ["Ticket Saya", "ticket:mine"],
    ["Ticket Open", "ticket:open"],
    ["Ticket Pending Customer", "ticket:pending-customer"],
    ["Ticket Closed", "ticket:closed"],
    ["Cari Ticket", "ticket:search"],
  ],
  "admin:joki": [
    ["Queue Aktif", "joki:active"],
    ["Queue Hari Ini", "joki:today"],
    ["Queue Besok", "joki:tomorrow"],
    ["History Joki", "joki:history"],
    ["Tambah Manual Queue", "joki:add"],
    ["Sync Queue Dry Run", "joki:dry-sync"],
    ["Apply Sync Queue", "joki:apply-sync"],
    ["Komisi Joki", "joki:komisi"],
    ["Shift Joki", "joki:shift"],
    ["Clear Queue", "joki:clear"],
  ],
  "admin:store": [
    ["Pricelist", "store:pricelist"],
    ["Stock", "store:stock"],
    ["Coupon", "store:coupon"],
    ["Produk Digital", "store:digital"],
    ["Joki Package", "store:joki-package"],
    ["Top Up Package", "store:topup-package"],
    ["Remove Stock", "store:remove-stock"],
    ["Disable Product", "store:disable-product"],
    ["Disable Coupon", "store:disable-coupon"],
  ],
  "admin:customer": [
    ["Search Customer", "customer:search"],
    ["Customer Profile", "customer:profile"],
    ["Edit Customer Data", "customer:edit"],
    ["Blacklist Customer", "customer:blacklist"],
    ["Set Role", "customer:set-role"],
    ["Warranty Follow Up", "customer:warranty-followup"],
  ],
  "admin:report": [
    ["Sales Report Hari Ini", "report:sales-today"],
    ["Sales Report Mingguan", "report:sales-week"],
    ["Sales Report Bulanan", "report:sales-month"],
    ["Export Data", "report:export"],
    ["Staff Log", "report:staff-log"],
    ["Health Check", "report:health"],
    ["Test Webhook", "report:test-webhook"],
    ["Admin Guide", "report:guide"],
  ],
  "owner:maintenance": [
    ["Enable Maintenance", "owner:maintenance-enable"],
    ["Disable Maintenance", "owner:maintenance-disable"],
    ["Edit Maintenance Message", "owner:maintenance-message"],
    ["View Current Status", "owner:maintenance-status"],
  ],
  "owner:dashboard": [
    ["Start Dashboard", "owner:dashboard-start"],
    ["Stop Dashboard", "owner:dashboard-stop"],
    ["Restart Dashboard", "owner:dashboard-restart"],
    ["Dashboard Status", "owner:dashboard-status"],
  ],
  "owner:backup": [
    ["Create Backup", "owner:backup-create"],
    ["List Backup", "owner:backup-list"],
    ["Verify Backup", "owner:backup-verify"],
    ["Restore Backup", "owner:backup-restore"],
  ],
  "owner:whitelist": [
    ["List Whitelist", "owner:whitelist-list"],
    ["Add Guild", "owner:whitelist-add"],
    ["Remove Guild", "owner:whitelist-remove"],
  ],
  "owner:recovery": [
    ["Recovery Status", "owner:recovery-status"],
    ["Recovery Scan", "owner:recovery-scan"],
    ["Migration Status", "owner:migration-status"],
    ["Data Integrity Check", "owner:integrity-check"],
    ["Apply Recovery", "owner:recovery-apply"],
  ],
  "owner:security": [
    ["Spam Stats", "owner:spam-stats"],
    ["Permission Guard Check", "owner:permission-guard"],
    ["Owner Command Audit", "owner:command-audit"],
    ["Anti-Spam Status", "owner:antispam-status"],
    ["Health Check", "owner:health-check"],
  ],
  "owner:health": [
    ["Production Health", "owner:production-health"],
    ["Runtime Status", "owner:runtime-status"],
    ["Release Checklist", "owner:release-checklist"],
  ],
  "dev:qa": [
    ["Unit Test", "dev:qa-unit"],
    ["QA All", "dev:qa-all"],
    ["E2E Test", "dev:qa-e2e"],
    ["Security Audit", "dev:audit"],
    ["NPM Audit High", "dev:audit-high"],
    ["Lint", "dev:lint"],
    ["Verify Discord ENV", "dev:verify-env"],
    ["Full Production Gate", "dev:prod-gate"],
  ],
  "dev:pm2": [
    ["PM2 Status", "dev:pm2-status"],
    ["PM2 Logs 100 Lines", "dev:pm2-logs"],
    ["Restart Bot", "dev:pm2-restart"],
    ["Start Bot", "dev:pm2-start"],
    ["Stop Bot", "dev:pm2-stop"],
  ],
  "dev:logs": [
    ["Error Log", "dev:log-error"],
    ["Order Log", "dev:log-order"],
    ["Payment Log", "dev:log-payment"],
    ["Ticket Log", "dev:log-ticket"],
    ["Queue Log", "dev:log-queue"],
    ["Admin Log", "dev:log-admin"],
    ["AI Log", "dev:log-ai"],
    ["Moderation Log", "dev:log-moderation"],
    ["Delivery Log", "dev:log-delivery"],
  ],
  "dev:cicd": [
    ["Workflow Status", "dev:workflow-status"],
    ["Last Deploy", "dev:last-deploy"],
    ["Current Branch", "dev:current-branch"],
    ["Last Commit", "dev:last-commit"],
    ["Audit CI Config", "dev:audit-ci"],
    ["Deployment Checklist", "dev:deploy-checklist"],
  ],
  "dev:storage": [
    ["Check Data Folder", "dev:check-data"],
    ["Check Logs Folder", "dev:check-logs"],
    ["Check Storage File", "dev:check-storage"],
    ["Sensitive Data Leak Check", "dev:leak-check"],
    ["Backup Before Migration", "dev:backup-before-migration"],
    ["Runtime Data Guard", "dev:runtime-data-guard"],
  ],
  "dev:commands": [
    ["Check Registered Commands", "dev:commands-check"],
    ["Sync Commands", "dev:commands-sync"],
    ["Remove Deprecated Commands", "dev:commands-remove-deprecated"],
    ["Compare Local vs Discord Commands", "dev:commands-compare"],
    ["Command Permission Audit", "dev:commands-permission-audit"],
  ],
  "dev:guide": [
    ["Dev Guide", "dev:guide-open"],
    ["Panel Mapping", "dev:panel-mapping"],
    ["Security Rules", "dev:security-rules"],
  ],
  "setup:gamestore": [
    ["Setup Basic", "setup:basic"],
    ["Setup Gamestore", "setup:gamestore-run"],
    ["Setup Roles", "setup:roles-run"],
    ["Setup Terms", "setup:terms-run"],
  ],
  "setup:roles": [
    ["Sync Roles", "setup:roles-run"],
    ["Role Audit", "setup:role-audit"],
  ],
  "setup:sender": [
    ["Send Verify Panel", "setup:send-verify"],
    ["Send Role Panel", "setup:send-role"],
    ["Send Ticket Panel", "setup:send-ticket"],
    ["Send Payment Panel", "setup:send-payment"],
    ["Send Promo Panel", "setup:send-promo"],
  ],
  "setup:structure": [
    ["Audit Server", "setup:audit-server"],
    ["Backup Structure", "setup:backup-structure"],
    ["Restore Structure", "setup:restore-structure"],
    ["Rapihin Server", "setup:rapihin"],
    ["Rename Channels", "setup:rename-channels"],
    ["Sort Channels", "setup:sort-channels"],
    ["Apply Permissions", "setup:apply-permissions"],
  ],
  "setup:terms": [
    ["Setup Terms", "setup:terms-run"],
    ["Format Guide", "setup:format-guide"],
  ],
  "setup:backup": [
    ["Backup Structure", "setup:backup-structure"],
    ["Restore Structure", "setup:restore-structure"],
  ],
};

const ACTION_LABELS = Object.fromEntries(
  Object.values(ACTION_GROUPS)
    .flat()
    .map(([label, value]) => [value, label]),
);

function customId(...parts) {
  return [PANEL_PREFIX, ...parts].join(":");
}

function detectPanelRoles(member) {
  const owner = Boolean(
    member?.guild?.ownerId && member?.id && String(member.guild.ownerId) === String(member.id),
  ) || hasNamedRole(member, roleNames.owner);
  const developer = hasNamedRole(member, roleNames.itDev);
  const admin = owner || hasAdminPermission(member) || hasNamedRole(member, roleNames.manager) || hasNamedRole(member, roleNames.admin);
  const staff = admin || isOwnerOrStaff(member) || hasNamedRole(member, roleNames.staff);
  const customer = Boolean(member);

  return { owner, developer, admin, staff, customer };
}

function resolvePrimaryRole(member) {
  const roles = detectPanelRoles(member);
  if (roles.owner) return "owner";
  if (roles.developer) return "developer";
  if (roles.admin) return "admin";
  if (roles.staff) return "staff";
  return "customer";
}

function canAccessPanel(member, panelId) {
  const roles = detectPanelRoles(member);
  if (roles.owner) return true;
  if (panelId === PANEL_IDS.customer) return true;
  if (panelId === PANEL_IDS.admin) return roles.admin || roles.staff || roles.developer;
  if (panelId === PANEL_IDS.dev) return roles.developer;
  if (panelId === PANEL_IDS.setup) return roles.admin || roles.staff;
  if (panelId === PANEL_IDS.owner) return false;
  return false;
}

function getPanelAccessList(member) {
  return Object.values(PANEL_IDS).filter((panelId) => canAccessPanel(member, panelId));
}

function getActionPanel(actionValue) {
  if (actionValue.startsWith("owner:")) return PANEL_IDS.owner;
  if (actionValue.startsWith("dev:")) return PANEL_IDS.dev;
  if (actionValue.startsWith("setup:")) return PANEL_IDS.setup;
  if (
    actionValue.startsWith("order:") ||
    actionValue.startsWith("payment:") ||
    actionValue.startsWith("ticket:") ||
    actionValue.startsWith("joki:") ||
    actionValue.startsWith("store:") ||
    actionValue.startsWith("customer:") ||
    actionValue.startsWith("report:")
  ) {
    return PANEL_IDS.admin;
  }
  return PANEL_IDS.customer;
}

function getGroupPanel(groupId) {
  if (groupId.startsWith("owner:")) return PANEL_IDS.owner;
  if (groupId.startsWith("dev:")) return PANEL_IDS.dev;
  if (groupId.startsWith("setup:")) return PANEL_IDS.setup;
  if (groupId.startsWith("admin:")) return PANEL_IDS.admin;
  return PANEL_IDS.customer;
}

function canRunAction(member, actionValue) {
  const panelId = getActionPanel(actionValue);
  if (!canAccessPanel(member, panelId)) return false;
  if (!DANGEROUS_ACTIONS.has(actionValue)) return true;
  if (panelId === PANEL_IDS.owner) return detectPanelRoles(member).owner;
  if (panelId === PANEL_IDS.dev) return detectPanelRoles(member).owner || detectPanelRoles(member).developer;
  return detectPanelRoles(member).owner || detectPanelRoles(member).admin || detectPanelRoles(member).staff;
}

function maskSensitiveData(value) {
  let text = String(value ?? "");
  text = text.replace(/(token|api[_-]?key|password|secret|webhook|cookie|session|valueencr)\s*[:=]\s*([^\s,;]+)/gi, "$1=[MASKED]");
  text = text.replace(/(DISCORD_TOKEN|OPENAI_API_KEY|DASHBOARD_PASSWORD)\s*=\s*([^\s]+)/g, "$1=[MASKED]");
  text = text.replace(/https:\/\/discord(?:app)?\.com\/api\/webhooks\/[^\s)]+/gi, "https://discord.com/api/webhooks/[MASKED]");
  return text;
}

function buildPanelEmbed(panelId, member) {
  const definition = PANEL_DEFINITIONS[panelId] || PANEL_DEFINITIONS.customer;
  return new EmbedBuilder()
    .setTitle(definition.title)
    .setDescription(definition.description)
    .setColor(definition.color)
    .addFields(
      { name: "Role route", value: resolvePrimaryRole(member), inline: true },
      { name: "Pattern", value: "Panel -> Kategori -> Select -> Modal -> Review -> Confirm", inline: false },
    )
    .setFooter({ text: "HYPEBOTX Panel Router" })
    .setTimestamp();
}

function buildButtonRows(buttons) {
  const rows = [];
  for (let index = 0; index < buttons.length; index += 5) {
    const row = new ActionRowBuilder();
    for (const [label, value, style] of buttons.slice(index, index + 5)) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(customId("button", value))
          .setLabel(label)
          .setStyle(style || ButtonStyle.Secondary),
      );
    }
    rows.push(row);
  }
  return rows;
}

function buildPanelPayload(panelId, member) {
  const definition = PANEL_DEFINITIONS[panelId] || PANEL_DEFINITIONS.customer;
  return {
    embeds: [buildPanelEmbed(panelId, member)],
    components: buildButtonRows(definition.buttons),
    flags: MessageFlags.Ephemeral,
  };
}

function buildHomePayload(member) {
  const panels = getPanelAccessList(member);
  const embed = new EmbedBuilder()
    .setTitle("HYPEBOTX HOME PANEL")
    .setDescription("Slash command hanya pintu masuk. Pilih dashboard sesuai role, lalu lanjut lewat button, select, modal, review, dan confirm.")
    .setColor(0x5865f2)
    .addFields({ name: "Role route", value: resolvePrimaryRole(member), inline: true })
    .setFooter({ text: "HYPEBOTX Panel Router" })
    .setTimestamp();

  const buttons = panels.map((panelId) => [
    PANEL_DEFINITIONS[panelId].title.replace("HYPEBOTX ", "").replace(" PANEL", ""),
    `open:${panelId}`,
    panelId === PANEL_IDS.customer ? ButtonStyle.Primary : ButtonStyle.Secondary,
  ]);

  return {
    embeds: [embed],
    components: buildButtonRows(buttons),
    flags: MessageFlags.Ephemeral,
  };
}

function buildActionSelectPayload(groupId, member) {
  const actions = ACTION_GROUPS[groupId] || [];
  const label = ACTION_LABELS[groupId] || groupId;
  const embed = new EmbedBuilder()
    .setTitle("Pilih Action")
    .setDescription(`Kategori: **${label}**\nAction panjang dipilih lewat select menu agar panel tetap rapi.`)
    .setColor(0x5865f2)
    .addFields({ name: "Role route", value: resolvePrimaryRole(member), inline: true })
    .setFooter({ text: "HYPEBOTX Panel Router" })
    .setTimestamp();

  const select = new StringSelectMenuBuilder()
    .setCustomId(customId("select", groupId))
    .setPlaceholder("Pilih action...")
    .addOptions(actions.slice(0, 25).map(([labelText, value]) => ({
      label: labelText.slice(0, 100),
      value,
      description: DANGEROUS_ACTIONS.has(value) ? "Butuh reason dan confirm" : "Panel action",
    })));

  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(select)],
    flags: MessageFlags.Ephemeral,
  };
}

function buildReasonModal(actionValue) {
  const label = ACTION_LABELS[actionValue] || actionValue;
  return new ModalBuilder()
    .setCustomId(customId("reason", actionValue))
    .setTitle("Reason wajib")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("reason")
          .setLabel(`Reason untuk ${label}`.slice(0, 45))
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMinLength(5)
          .setMaxLength(500),
      ),
    );
}

function buildDangerousConfirmPayload(actionValue, reason, interaction) {
  const label = ACTION_LABELS[actionValue] || actionValue;
  const target = label;
  const embed = new EmbedBuilder()
    .setTitle("WARNING / CONFIRMATION")
    .setColor(0xed4245)
    .addFields(
      { name: "Action", value: maskSensitiveData(label), inline: true },
      { name: "Target", value: maskSensitiveData(target), inline: true },
      { name: "Impact", value: "Action ini bisa mengubah state order/store/server/runtime.", inline: false },
      { name: "Requested by", value: `${interaction.user?.tag || interaction.user?.id || "-"} (${interaction.user?.id || "-"})`, inline: false },
      { name: "Reason", value: maskSensitiveData(reason), inline: false },
    )
    .setFooter({ text: "HYPEBOTX Dangerous Action Gate" })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(customId("confirm", actionValue, "yes"))
      .setLabel("YA, LANJUTKAN")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(customId("confirm", actionValue, "no"))
      .setLabel("BATAL")
      .setStyle(ButtonStyle.Secondary),
  );

  return {
    embeds: [embed],
    components: [row],
    flags: MessageFlags.Ephemeral,
  };
}

function buildActionResultPayload(actionValue) {
  const label = ACTION_LABELS[actionValue] || actionValue;
  const commandHints = {
    "dev:qa-unit": "npm test",
    "dev:qa-all": "npm run qa:all",
    "dev:qa-e2e": "npm run qa:e2e",
    "dev:audit": "npm run audit",
    "dev:audit-high": "npm audit --audit-level high",
    "dev:lint": "npm run lint",
    "dev:verify-env": "npm run verify:discord-env",
    "dev:pm2-status": "pm2 status",
    "dev:pm2-logs": "pm2 logs hypebotx --lines 100 --nostream",
  };
  const embed = new EmbedBuilder()
    .setTitle(label)
    .setColor(0x5865f2)
    .setDescription(commandHints[actionValue]
      ? `Command aman untuk dijalankan manual:\n\`${commandHints[actionValue]}\``
      : "Action sudah diarahkan ke panel. Backend lama tetap tersedia sebagai fallback sampai integrasi eksekusi aman selesai.")
    .setFooter({ text: "HYPEBOTX Panel Action" })
    .setTimestamp();

  return { embeds: [embed], flags: MessageFlags.Ephemeral };
}

function formatRows(title, rows, mapper) {
  const list = Array.isArray(rows) ? rows.slice(0, 10) : [];
  const description = list.length
    ? list.map(mapper).join("\n")
    : "Data belum tersedia atau tidak ada item untuk filter ini.";
  return {
    embeds: [
      new EmbedBuilder()
        .setTitle(title)
        .setColor(0x5865f2)
        .setDescription(maskSensitiveData(description).slice(0, 4000))
        .setFooter({ text: "HYPEBOTX Panel Data View" })
        .setTimestamp(),
    ],
    flags: MessageFlags.Ephemeral,
  };
}

async function buildOperationalActionPayload(client, interaction, actionValue) {
  const repositories = client.container?.repositories || {};
  const services = client.container?.services || {};
  const guildId = interaction.guild?.id;

  if (actionValue.startsWith("order:")) {
    const rows = await repositories.orderRepository?.getAllByGuildId?.(guildId).catch(() => null)
      || await repositories.orderRepository?.getAll?.().catch(() => [])
      || [];
    const scopedRows = rows.filter((row) => !row.guildId || row.guildId === guildId);
    const statusMatchers = {
      "order:pending-payment": (row) => /pending|waiting|unpaid/i.test(`${row.status || ""} ${row.paymentStatus || ""}`),
      "order:processing": (row) => /process|paid|queue/i.test(`${row.status || ""} ${row.paymentStatus || ""}`),
      "order:done": (row) => /done|complete|completed/i.test(`${row.status || ""}`),
      "order:issue": (row) => /refund|dispute|cancel|hold|problem|issue/i.test(`${row.status || ""} ${row.orderFlowStatus || ""}`),
    };
    const filtered = statusMatchers[actionValue] ? scopedRows.filter(statusMatchers[actionValue]) : scopedRows;
    return formatRows(ACTION_LABELS[actionValue] || "Order", filtered, (row) => {
      const status = services.orderService?.normalizeOrderStatusForDisplay?.(row) || row.status || "-";
      return `- \`${row.id || "-"}\` | ${status} | <@${row.userId || row.customerId || "unknown"}> | ${row.service || row.category || "-"} | ${row.total || row.price || "-"}`;
    });
  }

  if (actionValue.startsWith("payment:")) {
    const rows = await repositories.paymentRepository?.getAll?.().catch(() => []) || [];
    const scopedRows = rows.filter((row) => !row.guildId || row.guildId === guildId);
    const expected = {
      "payment:pending": /pending|review|submitted/i,
      "payment:approved": /approved|paid/i,
      "payment:rejected": /reject|failed/i,
    }[actionValue];
    const filtered = expected ? scopedRows.filter((row) => expected.test(String(row.status || row.paymentStatus || ""))) : scopedRows;
    return formatRows(ACTION_LABELS[actionValue] || "Payment", filtered, (row) =>
      `- \`${row.id || "-"}\` | order \`${row.orderId || "-"}\` | ${row.status || "-"} | ${row.amount || row.nominal || "-"}`,
    );
  }

  if (actionValue.startsWith("ticket:")) {
    const rows = await repositories.ticketRepository?.getAllByGuildId?.(guildId).catch(() => []) || [];
    const filtered = rows.filter((row) => {
      if (actionValue === "ticket:closed") return /closed/i.test(String(row.status || ""));
      if (actionValue === "ticket:mine") return String(row.claimedBy || row.staffId || "") === String(interaction.user?.id || "");
      if (actionValue === "ticket:pending-customer") return /pending|customer/i.test(String(row.status || row.orderStatus || ""));
      return !/closed/i.test(String(row.status || ""));
    });
    return formatRows(ACTION_LABELS[actionValue] || "Ticket", filtered, (row) =>
      `- \`${row.id || "-"}\` | ${row.type || "-"} | ${row.status || row.orderStatus || "open"} | <#${row.channelId || "unknown"}>`,
    );
  }

  if (actionValue.startsWith("joki:")) {
    const queue = await repositories.jokiRepository?.getQueue?.(guildId).catch(() => null);
    const history = /history/i.test(actionValue)
      ? await repositories.jokiRepository?.listHistory?.(guildId).catch(() => [])
      : null;
    const rows = history || queue?.orders || [];
    return formatRows(ACTION_LABELS[actionValue] || "Joki", rows, (row) =>
      `- \`${row.id || row.orderId || "-"}\` | ${row.status || "-"} | ${row.packageLabel || row.package || "-"} | ${row.completedHeist || 0}/${row.totalHeist || "-"} heist`,
    );
  }

  if (actionValue.startsWith("store:stock")) {
    const rows = await repositories.stockRepository?.items?.getAll?.(guildId).catch(() => null)
      || await repositories.stockRepository?.getAll?.(guildId).catch(() => [])
      || [];
    return formatRows("Stock", rows, (row) =>
      `- \`${row.sku || row.id || "-"}\` | ${row.name || row.product || "-"} | ${row.status || "active"} | ${row.available ?? row.stock ?? "-"}`,
    );
  }

  if (actionValue.startsWith("store:coupon")) {
    const rows = await repositories.couponRepository?.getAll?.().catch(() => []) || [];
    const scopedRows = rows.filter((row) => !row.guildId || row.guildId === guildId);
    return formatRows("Coupon", scopedRows, (row) =>
      `- \`${row.code || "-"}\` | ${row.type || "-"} | ${row.value || "-"} | ${row.active === false ? "disabled" : "active"}`,
    );
  }

  if (actionValue === "owner:backup-list") {
    const backups = services.enhancedBackupService?.listBackups?.() || [];
    return formatRows("Available Backups", backups, (row) =>
      `- \`${row.filename || row.name || "-"}\` | ${row.size ? `${Math.round(row.size / 1024)} KB` : "-"} | ${row.created || "-"}`,
    );
  }

  if (actionValue === "owner:maintenance-status") {
    const settings = await repositories.guildRepository?.getSettings?.(guildId).catch(() => null);
    return {
      content: `Maintenance: ${settings?.maintenance?.enabled ? "ON" : "OFF"}\nMessage: ${maskSensitiveData(settings?.maintenance?.message || "Store sedang maintenance.")}`,
      flags: MessageFlags.Ephemeral,
    };
  }

  return buildActionResultPayload(actionValue);
}

async function logPanelAction(interaction, title, details, fields = []) {
  const safeDetails = maskSensitiveData(details);
  const safeFields = fields.map((field) => ({
    ...field,
    value: maskSensitiveData(field.value),
  }));

  await interaction.client?.container?.services?.loggingService?.logAdminAction?.(
    interaction.guild,
    title,
    safeDetails,
    safeFields,
  ).catch(() => null);

  interaction.client?.container?.logger?.info?.("panel action", {
    title,
    userId: interaction.user?.id,
    guildId: interaction.guild?.id,
    details: safeDetails,
  });
}

async function showPanel(interaction, panelId) {
  if (!canAccessPanel(interaction.member, panelId)) {
    await logPanelAction(interaction, "Panel Access Denied", `Denied panel=${panelId}`, [
      { name: "Actor", value: interaction.user?.id || "-", inline: true },
      { name: "Panel", value: panelId, inline: true },
    ]);
    return safeReply(interaction, { content: "Akses panel ditolak.", flags: MessageFlags.Ephemeral });
  }

  await logPanelAction(interaction, "Panel Open", `Opened panel=${panelId}`, [
    { name: "Actor", value: interaction.user?.id || "-", inline: true },
    { name: "Panel", value: panelId, inline: true },
  ]);
  return safeReply(interaction, buildPanelPayload(panelId, interaction.member));
}

async function handlePanelButton(client, interaction) {
  const parts = interaction.customId.split(":");
  const action = parts[2];
  const value = parts.slice(3).join(":");

  if (action === "button" && value.startsWith("open:")) {
    return showPanel(interaction, value.slice("open:".length));
  }

  if (action === "button" && value === "customer:order") {
    if (!client.container.services?.orderService?.startCheckoutFromPanel) {
      return safeReply(interaction, { content: "Checkout service belum siap.", flags: MessageFlags.Ephemeral });
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => null);
    const result = await client.container.services.orderService.startCheckoutFromPanel(interaction);
    await interaction.editReply(result?.reused
      ? "Checkout order kamu dilanjutkan. Pilih kategori layanan dari panel checkout."
      : "Panel checkout dikirim. Pilih kategori layanan, isi form, payment, review, lalu confirm.");
    return result;
  }

  if (action === "button" && value === "customer:status") {
    const orders = await client.container.repositories?.orderRepository?.findByUserId?.(interaction.guild.id, interaction.user.id).catch(() => []);
    if (!Array.isArray(orders) || !orders.length) {
      return safeReply(interaction, { content: "Kamu belum punya order aktif.", flags: MessageFlags.Ephemeral });
    }
    const lines = orders.slice(-5).reverse().map((order) => `- \`${order.id}\` | ${order.status || "-"} | ${order.service || order.category || "-"}`);
    return safeReply(interaction, { content: `Status order terbaru:\n${lines.join("\n")}`, flags: MessageFlags.Ephemeral });
  }

  if (action === "button" && value === "customer:ticket") {
    if (!client.container.services?.ticketService?.createTicketChannel) {
      return safeReply(interaction, { content: "Ticket service belum siap.", flags: MessageFlags.Ephemeral });
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => null);
    const { channel, reused } = await client.container.services.ticketService.createTicketChannel(
      interaction.guild,
      interaction.member,
      "support",
      { detail: `Support dari /panel (${interaction.user.id})` },
    );
    return interaction.editReply(reused ? `Kamu masih punya ticket aktif: ${channel}` : `Ticket support dibuat: ${channel}`);
  }

  if (action === "button" && ["customer:pricelist", "customer:faq", "customer:warranty"].includes(value)) {
    return safeReply(interaction, buildActionResultPayload(value));
  }

  if (action === "button" && ACTION_GROUPS[value]) {
    const panelId = getGroupPanel(value);
    if (!canAccessPanel(interaction.member, panelId)) {
      return safeReply(interaction, { content: "Akses kategori ditolak.", flags: MessageFlags.Ephemeral });
    }
    return safeReply(interaction, buildActionSelectPayload(value, interaction.member));
  }

  if (action === "confirm") {
    const decision = parts[parts.length - 1];
    const actionValue = parts.slice(3, -1).join(":");
    if (decision !== "yes") {
      await logPanelAction(interaction, "Dangerous Action Cancelled", `Cancelled action=${actionValue}`, [
        { name: "Actor", value: interaction.user?.id || "-", inline: true },
        { name: "Action", value: actionValue, inline: true },
      ]);
      return safeReply(interaction, { content: "Action dibatalkan.", flags: MessageFlags.Ephemeral });
    }
    if (!canRunAction(interaction.member, actionValue)) {
      return safeReply(interaction, { content: "Akses action ditolak.", flags: MessageFlags.Ephemeral });
    }
    await logPanelAction(interaction, "Dangerous Action Confirmed", `Confirmed action=${actionValue}`, [
      { name: "Actor", value: interaction.user?.id || "-", inline: true },
      { name: "Action", value: actionValue, inline: true },
    ]);
    return safeReply(interaction, {
      content: `Confirm diterima untuk **${ACTION_LABELS[actionValue] || actionValue}**. Eksekusi backend destructive tetap ditahan sampai handler spesifiknya aman dipasang.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  return null;
}

async function handlePanelSelect(client, interaction) {
  const actionValue = interaction.values?.[0];
  if (!actionValue) {
    return safeReply(interaction, { content: "Action tidak valid.", flags: MessageFlags.Ephemeral });
  }

  if (!canRunAction(interaction.member, actionValue)) {
    await logPanelAction(interaction, "Panel Action Denied", `Denied action=${actionValue}`, [
      { name: "Actor", value: interaction.user?.id || "-", inline: true },
      { name: "Action", value: actionValue, inline: true },
    ]);
    return safeReply(interaction, { content: "Akses action ditolak.", flags: MessageFlags.Ephemeral });
  }

  if (DANGEROUS_ACTIONS.has(actionValue)) {
    return interaction.showModal(buildReasonModal(actionValue));
  }

  await logPanelAction(interaction, "Panel Action Selected", `Selected action=${actionValue}`, [
    { name: "Actor", value: interaction.user?.id || "-", inline: true },
    { name: "Action", value: actionValue, inline: true },
  ]);
  const payload = await buildOperationalActionPayload(client, interaction, actionValue);
  return safeReply(interaction, payload);
}

async function handlePanelModal(_client, interaction) {
  const actionValue = interaction.customId.split(":").slice(3).join(":");
  if (!DANGEROUS_ACTIONS.has(actionValue)) return null;
  if (!canRunAction(interaction.member, actionValue)) {
    return safeReply(interaction, { content: "Akses action ditolak.", flags: MessageFlags.Ephemeral });
  }
  const reason = interaction.fields?.getTextInputValue?.("reason") || "";
  if (String(reason).trim().length < 5) {
    return safeReply(interaction, { content: "Reason minimal 5 karakter.", flags: MessageFlags.Ephemeral });
  }
  await logPanelAction(interaction, "Dangerous Action Reason Submitted", `Reason submitted action=${actionValue}`, [
    { name: "Actor", value: interaction.user?.id || "-", inline: true },
    { name: "Action", value: actionValue, inline: true },
    { name: "Reason", value: reason, inline: false },
  ]);
  return safeReply(interaction, buildDangerousConfirmPayload(actionValue, reason, interaction));
}

module.exports = {
  PANEL_PREFIX,
  PANEL_IDS,
  DANGEROUS_ACTIONS,
  ACTION_GROUPS,
  ACTION_LABELS,
  buildHomePayload,
  buildOperationalActionPayload,
  buildPanelPayload,
  buildActionSelectPayload,
  buildDangerousConfirmPayload,
  canAccessPanel,
  canRunAction,
  customId,
  detectPanelRoles,
  handlePanelButton,
  handlePanelModal,
  handlePanelSelect,
  maskSensitiveData,
  showPanel,
};
