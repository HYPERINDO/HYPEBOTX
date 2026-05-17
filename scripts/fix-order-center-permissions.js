const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const {
  ChannelType,
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  PermissionsBitField,
} = require("discord.js");

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
const reportDir = path.join(repoRoot, "logs", "qa");
fs.mkdirSync(reportDir, { recursive: true });

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

function resolveCategory(guild) {
  const id = envValue("TICKET_CATEGORY_ID");
  if (id && guild.channels.cache.has(id)) return { channel: guild.channels.cache.get(id), source: "TICKET_CATEGORY_ID" };

  const names = [channelConfig.defaultTicketCategory, envValue("TICKET_CATEGORY_NAME")]
    .filter(Boolean)
    .map((name) => String(name).toLowerCase());
  const channel = guild.channels.cache.find((item) => item.type === ChannelType.GuildCategory && names.some((name) => item.name.toLowerCase().includes(name)));
  return channel ? { channel, source: "category-name" } : { channel: null, source: "not-found" };
}

function overwriteSnapshot(guild, channel) {
  return channel.permissionOverwrites.cache.map((overwrite) => {
    const role = overwrite.type === 0 ? guild.roles.cache.get(overwrite.id) : null;
    const member = overwrite.type === 1 ? guild.members.cache.get(overwrite.id) : null;
    return {
      id: overwrite.id,
      type: overwrite.type === 0 ? "role" : "member",
      name: role?.name || member?.user?.tag || overwrite.id,
      allow: new PermissionsBitField(overwrite.allow.bitfield).toArray(),
      deny: new PermissionsBitField(overwrite.deny.bitfield).toArray(),
    };
  });
}

function saveSnapshot(label, payload) {
  const filePath = path.join(reportDir, `order-center-permissions-${label}-${Date.now()}.json`);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  return filePath;
}

function canView(channel, target) {
  return channel.permissionsFor(target)?.has(PermissionFlagsBits.ViewChannel) || false;
}

async function main() {
  const token = envValue("DISCORD_TOKEN");
  const guildId = envValue("GUILD_ID") || envValue("DISCORD_GUILD_ID") || envValue("DASHBOARD_GUILD_ID");
  if (!token) throw new Error("DISCORD_TOKEN missing");
  if (!guildId) throw new Error("GUILD_ID missing");

  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
  await client.login(token);

  let sampleChannel = null;
  try {
    const guild = await client.guilds.fetch(guildId);
    await guild.roles.fetch();
    await guild.channels.fetch();
    await guild.members.fetch();

    const categoryResult = resolveCategory(guild);
    const category = categoryResult.channel;
    if (!category || category.type !== ChannelType.GuildCategory) throw new Error("ORDER CENTER ticket category not found");

    const botMember = await guild.members.fetch(client.user.id);
    const roles = {
      owner: resolveRole(guild, ["OWNER_ROLE_ID"], [roleNames.owner]),
      admin: resolveRole(guild, ["ADMIN_ROLE_ID", "STAFF_ROLE_ID"], [roleNames.admin, roleNames.staff]),
      penjoki: resolveRole(guild, ["PENJOKI_ROLE_ID"], [roleNames.penjoki, roleNames.joki, roleNames.gameBooster]),
      verified: resolveRole(guild, ["VERIFIED_ROLE_ID", "VERIFY_ROLE_ID", "MEMBER_ROLE_ID"], [roleNames.member, roleNames.customer]),
      unverified: resolveRole(guild, ["UNVERIFIED_ROLE_ID"], [roleNames.unverified]),
    };

    const beforePath = saveSnapshot("before", {
      generatedAt: new Date().toISOString(),
      guild: guild.name,
      category: { id: category.id, name: category.name, source: categoryResult.source },
      overwrites: overwriteSnapshot(guild, category),
    });
    add("snapshot", "before category permissions", "PASS", beforePath);

    const botHighest = botMember.roles.highest;
    for (const [name, resolved] of Object.entries(roles)) {
      if (!resolved.role) {
        add("hierarchy", `${name} role found`, name === "unverified" ? "WARN" : "FAIL", "not found");
        continue;
      }
      const canManage = botHighest.position > resolved.role.position;
      add(
        "hierarchy",
        `bot role above ${name}`,
        canManage ? "PASS" : "WARN",
        `bot=${botHighest.name}(${botHighest.position}) target=${resolved.role.name}(${resolved.role.position})`,
      );
    }

    const staffAllow = {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      ManageMessages: true,
      ManageThreads: true,
      CreatePublicThreads: true,
      CreatePrivateThreads: true,
      SendMessagesInThreads: true,
      AttachFiles: true,
      EmbedLinks: true,
    };
    const botAllow = {
      ...staffAllow,
      ManageChannels: true,
      ManageRoles: true,
    };
    const baselineDeny = {
      ViewChannel: false,
      SendMessages: false,
      CreatePublicThreads: false,
      CreatePrivateThreads: false,
      SendMessagesInThreads: false,
    };
    const clearNonStaff = {
      ViewChannel: null,
      SendMessages: null,
      CreatePublicThreads: null,
      CreatePrivateThreads: null,
      SendMessagesInThreads: null,
      ReadMessageHistory: null,
    };

    const reason = "HYPEBOTX QA: secure ORDER CENTER ticket category baseline";
    await category.permissionOverwrites.edit(guild.roles.everyone, baselineDeny, { reason });
    await category.permissionOverwrites.edit(botMember, botAllow, { reason });
    for (const key of ["owner", "admin"]) {
      if (roles[key].role) await category.permissionOverwrites.edit(roles[key].role, staffAllow, { reason });
    }
    for (const key of ["penjoki", "verified", "unverified"]) {
      if (roles[key].role) await category.permissionOverwrites.edit(roles[key].role, clearNonStaff, { reason });
    }

    const refreshedCategory = await guild.channels.fetch(category.id, { force: true });
    const everyoneOverwrite = refreshedCategory.permissionOverwrites.cache.get(guild.roles.everyone.id);
    const everyoneDenied = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.CreatePublicThreads,
      PermissionFlagsBits.CreatePrivateThreads,
      PermissionFlagsBits.SendMessagesInThreads,
    ].every((permission) => everyoneOverwrite?.deny.has(permission));
    add("permissions", "category @everyone deny baseline", everyoneDenied ? "PASS" : "FAIL", everyoneDenied ? "View/Send/Thread denied" : "missing one or more denies");

    add("permissions", "owner can view category", roles.owner.role && canView(refreshedCategory, roles.owner.role) ? "PASS" : "FAIL", roles.owner.role?.name || "missing");
    add("permissions", "admin can view category", roles.admin.role && canView(refreshedCategory, roles.admin.role) ? "PASS" : "FAIL", roles.admin.role?.name || "missing");
    add("permissions", "bot can view category", canView(refreshedCategory, botMember) ? "PASS" : "FAIL", botMember.user.tag);
    if (roles.penjoki.role) add("permissions", "penjoki cannot view category by default", !canView(refreshedCategory, roles.penjoki.role) ? "PASS" : "FAIL", roles.penjoki.role.name);
    if (roles.verified.role) add("permissions", "member cannot view category by default", !canView(refreshedCategory, roles.verified.role) ? "PASS" : "FAIL", roles.verified.role.name);

    sampleChannel = await guild.channels.create({
      name: `qa-ticket-privacy-${Date.now().toString().slice(-6)}`,
      type: ChannelType.GuildText,
      parent: refreshedCategory.id,
      reason: "HYPEBOTX QA: temporary ticket privacy sample",
    });
    await sampleChannel.lockPermissions();
    sampleChannel = await guild.channels.fetch(sampleChannel.id, { force: true });

    const sampleEveryoneHidden = !canView(sampleChannel, guild.roles.everyone);
    const sampleBotCanView = canView(sampleChannel, botMember);
    const sampleOwnerCanView = roles.owner.role ? canView(sampleChannel, roles.owner.role) : false;
    const sampleAdminCanView = roles.admin.role ? canView(sampleChannel, roles.admin.role) : false;
    const samplePenjokiHidden = roles.penjoki.role ? !canView(sampleChannel, roles.penjoki.role) : true;
    const sampleMemberHidden = roles.verified.role ? !canView(sampleChannel, roles.verified.role) : true;

    add("sample-ticket", "new sample hides @everyone", sampleEveryoneHidden ? "PASS" : "FAIL", sampleChannel.name);
    add("sample-ticket", "new sample bot access", sampleBotCanView ? "PASS" : "FAIL", sampleChannel.name);
    add("sample-ticket", "new sample owner access", sampleOwnerCanView ? "PASS" : "FAIL", sampleChannel.name);
    add("sample-ticket", "new sample admin access", sampleAdminCanView ? "PASS" : "FAIL", sampleChannel.name);
    add("sample-ticket", "new sample penjoki hidden by default", samplePenjokiHidden ? "PASS" : "FAIL", sampleChannel.name);
    add("sample-ticket", "new sample member hidden by default", sampleMemberHidden ? "PASS" : "FAIL", sampleChannel.name);

    await sampleChannel.delete("HYPEBOTX QA: temporary privacy sample complete");
    add("cleanup", "temporary sample ticket deleted", "PASS", sampleChannel.name);
    sampleChannel = null;

    const afterPath = saveSnapshot("after", {
      generatedAt: new Date().toISOString(),
      guild: guild.name,
      category: { id: refreshedCategory.id, name: refreshedCategory.name },
      overwrites: overwriteSnapshot(guild, refreshedCategory),
      results,
    });
    add("snapshot", "after category permissions", "PASS", afterPath);
  } finally {
    if (sampleChannel) {
      await sampleChannel.delete("HYPEBOTX QA: cleanup after interrupted permission test").catch(() => null);
    }
    client.destroy();
  }

  printAndExit(results.some((row) => row.status === "FAIL") ? 1 : 0);
}

function printAndExit(code) {
  const counts = results.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {});
  const report = { generatedAt: new Date().toISOString(), counts, results };
  const reportPath = path.join(reportDir, `order-center-permission-fix-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.table(results);
  console.log(`Report: ${reportPath}`);
  process.exitCode = code;
}

main().catch((error) => {
  add("runtime", "order center permission fix", "FAIL", error.message);
  printAndExit(1);
});
