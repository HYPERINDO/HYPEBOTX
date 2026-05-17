const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { ChannelType, Client, GatewayIntentBits, PermissionsBitField } = require("discord.js");

const repoRoot = path.resolve(__dirname, "..");

for (const file of [".env.local", ".env"]) {
  const envPath = path.join(repoRoot, file);
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
    break;
  }
}

const roleNames = require(path.join(repoRoot, "apps/bot/src/config/roles.js"));
const channelConfig = require(path.join(repoRoot, "apps/bot/src/config/channels.js"));

const results = [];

function add(area, name, status, detail = "") {
  results.push({ area, name, status, detail });
}

function envValue(name) {
  return String(process.env[name] || "").trim();
}

function resolveRole(guild, envNames, fallbackNames) {
  for (const envName of envNames) {
    const id = envValue(envName);
    if (id && guild.roles.cache.has(id)) return { role: guild.roles.cache.get(id), source: envName };
  }

  const names = fallbackNames.filter(Boolean).map((name) => String(name).toLowerCase());
  const role = guild.roles.cache.find((item) => names.includes(item.name.toLowerCase()));
  return role ? { role, source: "role-name" } : { role: null, source: "not-found" };
}

function resolveChannel(guild, envNames, fallbackNames) {
  for (const envName of envNames) {
    const id = envValue(envName);
    if (id && guild.channels.cache.has(id)) return { channel: guild.channels.cache.get(id), source: envName };
  }

  const names = fallbackNames.filter(Boolean).map((name) => String(name).toLowerCase());
  const channel = guild.channels.cache.find((item) => names.includes(item.name.toLowerCase()));
  if (channel) return { channel, source: "channel-name" };

  const fuzzy = guild.channels.cache.find((item) => names.some((name) => item.name.toLowerCase().includes(name)));
  return fuzzy ? { channel: fuzzy, source: "channel-name-fuzzy" } : { channel: null, source: "not-found" };
}

function hasAll(perms, flags) {
  return flags.every((flag) => perms?.has(flag));
}

function summarizePermissions(channel, botMember) {
  const perms = channel.permissionsFor(botMember);
  if (!perms) return "no permission object";
  const required = [
    PermissionsBitField.Flags.ViewChannel,
    PermissionsBitField.Flags.SendMessages,
    PermissionsBitField.Flags.ReadMessageHistory,
  ];
  const threadRequired = [
    PermissionsBitField.Flags.CreatePublicThreads,
    PermissionsBitField.Flags.CreatePrivateThreads,
    PermissionsBitField.Flags.SendMessagesInThreads,
    PermissionsBitField.Flags.ManageThreads,
  ];
  const missing = [];
  for (const flag of required) {
    if (!perms.has(flag)) missing.push(new PermissionsBitField(flag).toArray()[0]);
  }
  if (channel.type === ChannelType.GuildText) {
    for (const flag of threadRequired) {
      if (!perms.has(flag)) missing.push(new PermissionsBitField(flag).toArray()[0]);
    }
  }
  return missing.length ? `missing: ${missing.join(", ")}` : "required bot permissions OK";
}

async function main() {
  const token = envValue("DISCORD_TOKEN");
  const guildId = envValue("GUILD_ID") || envValue("DISCORD_GUILD_ID") || envValue("DASHBOARD_GUILD_ID");

  if (!token) {
    add("env", "DISCORD_TOKEN", "FAIL", "missing");
    printAndExit(1);
    return;
  }
  if (!guildId) {
    add("env", "GUILD_ID", "FAIL", "missing");
    printAndExit(1);
    return;
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
  await client.login(token);

  try {
    const guild = await client.guilds.fetch(guildId);
    await guild.roles.fetch();
    await guild.channels.fetch();
    const botMember = await guild.members.fetch(client.user.id);

    add("discord", "bot login", "PASS", `bot=${client.user.tag}`);
    add("discord", "guild reachable", "PASS", `guild=${guild.name}`);

    const guildPerms = botMember.permissions;
    add(
      "discord",
      "bot guild permissions",
      hasAll(guildPerms, [PermissionsBitField.Flags.ViewAuditLog, PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.ManageRoles])
        ? "PASS"
        : "WARN",
      `manageChannels=${guildPerms.has(PermissionsBitField.Flags.ManageChannels)}, manageRoles=${guildPerms.has(PermissionsBitField.Flags.ManageRoles)}, viewAuditLog=${guildPerms.has(PermissionsBitField.Flags.ViewAuditLog)}`,
    );

    const roles = [
      ["owner role", ["OWNER_ROLE_ID"], [roleNames.owner]],
      ["admin role", ["ADMIN_ROLE_ID", "STAFF_ROLE_ID"], [roleNames.admin, roleNames.staff]],
      ["penjoki role", ["PENJOKI_ROLE_ID"], [roleNames.penjoki, roleNames.joki, roleNames.gameBooster]],
      ["verified/member role", ["VERIFIED_ROLE_ID", "VERIFY_ROLE_ID", "MEMBER_ROLE_ID"], [roleNames.member, roleNames.customer]],
      ["unverified role", ["UNVERIFIED_ROLE_ID"], [roleNames.unverified]],
    ];

    for (const [label, envNames, names] of roles) {
      const found = resolveRole(guild, envNames, names);
      add("roles", label, found.role ? "PASS" : label === "unverified role" ? "WARN" : "FAIL", found.role ? `${found.role.name} (${found.source})` : "not found");
    }

    const channels = [
      ["ticket category", ["TICKET_CATEGORY_ID"], [channelConfig.defaultTicketCategory]],
      ["ticket thread parent", ["TICKET_THREAD_PARENT_CHANNEL_ID"], []],
      ["order log channel", ["ORDER_CHANNEL_ID", "ORDER_LOG_CHANNEL_ID"], [channelConfig.logChannels.order]],
      ["payment review/log channel", ["PAYMENT_REVIEW_CHANNEL_ID", "PAYMENT_CHANNEL_ID"], [channelConfig.logChannels.payment]],
      ["ticket log channel", ["TICKET_LOG_CHANNEL_ID"], [channelConfig.logChannels.ticket]],
      ["admin/security log channel", ["LOG_CHANNEL_ID", "ADMIN_LOG_CHANNEL_ID"], [channelConfig.logChannels.admin, channelConfig.logChannels.security]],
      ["transcript channel", ["TRANSCRIPT_CHANNEL_ID"], []],
    ];

    for (const [label, envNames, names] of channels) {
      const found = resolveChannel(guild, envNames, names);
      const optional = ["ticket thread parent", "transcript channel"].includes(label);
      if (!found.channel) {
        add("channels", label, optional ? "WARN" : "FAIL", "not found");
        continue;
      }
      add("channels", label, "PASS", `${found.channel.name} (${found.source})`);
      const permissionSummary = summarizePermissions(found.channel, botMember);
      add("permissions", `bot can use ${label}`, permissionSummary.includes("missing") ? "FAIL" : "PASS", permissionSummary);
    }

    const ticketCategory = resolveChannel(guild, ["TICKET_CATEGORY_ID"], [channelConfig.defaultTicketCategory]).channel;
    if (ticketCategory?.type === ChannelType.GuildCategory) {
      const everyoneOverwrite = ticketCategory.permissionOverwrites.cache.get(guild.roles.everyone.id);
      const deniesView = everyoneOverwrite?.deny?.has(PermissionsBitField.Flags.ViewChannel) || false;
      add("permissions", "ticket category @everyone hidden", deniesView ? "PASS" : "WARN", deniesView ? "ViewChannel denied" : "category does not deny @everyone ViewChannel");
    }

    const ticketChannels = guild.channels.cache
      .filter((channel) => channel.type === ChannelType.GuildText && /^ticket-|ticket-|ord-/i.test(channel.name))
      .first(10);
    if (ticketChannels.length) {
      const publicTickets = ticketChannels.filter((channel) => {
        const overwrite = channel.permissionOverwrites.cache.get(guild.roles.everyone.id);
        return !overwrite?.deny?.has(PermissionsBitField.Flags.ViewChannel);
      });
      add(
        "permissions",
        "sample ticket channels hide @everyone",
        publicTickets.length === 0 ? "PASS" : "FAIL",
        `${ticketChannels.length - publicTickets.length}/${ticketChannels.length} sampled ticket channels deny @everyone ViewChannel`,
      );
    } else {
      add("permissions", "sample ticket channels hide @everyone", "WARN", "no ticket-* channels found to sample");
    }

    add("verify-gate", "verified role source", resolveRole(guild, ["VERIFIED_ROLE_ID", "VERIFY_ROLE_ID", "MEMBER_ROLE_ID"], [roleNames.member]).role ? "PASS" : "FAIL", "verify gate has a resolvable role");
  } finally {
    client.destroy();
  }

  printAndExit(results.some((row) => row.status === "FAIL") ? 1 : 0);
}

function printAndExit(code) {
  const counts = results.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {});
  const report = {
    generatedAt: new Date().toISOString(),
    counts,
    results,
  };

  const reportDir = path.join(repoRoot, "logs", "qa");
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `live-discord-guild-audit-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.table(results);
  console.log(`Report: ${reportPath}`);
  process.exitCode = code;
}

main().catch((error) => {
  add("runtime", "live guild audit", "FAIL", error.message);
  printAndExit(1);
});
