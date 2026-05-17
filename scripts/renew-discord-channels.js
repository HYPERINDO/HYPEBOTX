const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const {
  ChannelType,
  Client,
  GatewayIntentBits,
  PermissionsBitField,
} = require("discord.js");

const repoRoot = path.resolve(__dirname, "..");
const envPath = [".env.local", ".env"]
  .map((file) => path.join(repoRoot, file))
  .find((file) => fs.existsSync(file));

if (envPath) {
  dotenv.config({ path: envPath, override: true });
}

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const includeServerLogs = args.has("--include-server-logs");
const labelsArg = process.argv
  .slice(2)
  .find((arg) => arg.startsWith("--labels="));

const baseTargetLabels = [
  "INFO",
  "PRODUCTS",
  "STORE",
  "ORDER CENTER",
  "EVENTS",
  "COMMUNITY",
  "STAFF AREA",
  "SERVER STATS",
  "GTA SERVICES",
  "PC OPTIMIZER",
  "STREAM AREA",
];

const defaultTargetLabels = includeServerLogs
  ? [...baseTargetLabels, "SERVER LOGS"]
  : baseTargetLabels;

const targetLabels = labelsArg
  ? labelsArg
    .slice("--labels=".length)
    .split(",")
    .map((label) => label.trim().toUpperCase())
    .filter(Boolean)
  : defaultTargetLabels;

const runRoot = path.join(repoRoot, "logs", "discord-channel-renew", String(Date.now()));
const reason = "HYPEBOTX renew channel/category to clear old chat history";
const results = [];

function add(area, name, status, detail = "") {
  results.push({ area, name, status, detail });
}

function envValue(name) {
  return String(process.env[name] || "").trim();
}

function simplifiedName(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function isTargetCategory(category) {
  const normalized = simplifiedName(category.name);
  return targetLabels.some((label) => normalized.includes(label));
}

function serializeOverwrites(channel) {
  return channel.permissionOverwrites.cache.map((overwrite) => ({
    id: overwrite.id,
    type: overwrite.type,
    allow: overwrite.allow.toArray(),
    deny: overwrite.deny.toArray(),
  }));
}

function createOverwrites(channel) {
  return channel.permissionOverwrites.cache.map((overwrite) => ({
    id: overwrite.id,
    type: overwrite.type,
    allow: overwrite.allow.bitfield,
    deny: overwrite.deny.bitfield,
  }));
}

function serializeChannel(channel) {
  return {
    id: channel.id,
    name: channel.name,
    type: channel.type,
    parentId: channel.parentId || null,
    parentName: channel.parent?.name || null,
    position: channel.position,
    rawPosition: channel.rawPosition,
    topic: "topic" in channel ? channel.topic || null : null,
    nsfw: "nsfw" in channel ? Boolean(channel.nsfw) : null,
    rateLimitPerUser: "rateLimitPerUser" in channel ? channel.rateLimitPerUser : null,
    userLimit: "userLimit" in channel ? channel.userLimit : null,
    bitrate: "bitrate" in channel ? channel.bitrate : null,
    overwrites: serializeOverwrites(channel),
  };
}

function snapshotGuild(guild, categories) {
  const categoryIds = new Set(categories.map((category) => category.id));
  const channels = guild.channels.cache
    .filter((channel) => categoryIds.has(channel.parentId))
    .sort((a, b) => a.position - b.position)
    .map(serializeChannel);

  return {
    generatedAt: new Date().toISOString(),
    guild: {
      id: guild.id,
      name: guild.name,
    },
    mode: apply ? "apply" : "dry-run",
    targetLabels,
    categories: categories.map(serializeChannel),
    channels,
    envPath,
  };
}

function channelCreatePayload(channel, parentId) {
  const payload = {
    name: channel.name,
    type: channel.type,
    parent: parentId,
    permissionOverwrites: createOverwrites(channel),
    reason,
  };

  if ("topic" in channel && channel.topic && channel.type !== ChannelType.GuildVoice) {
    payload.topic = channel.topic;
  }
  if ("nsfw" in channel) {
    payload.nsfw = channel.nsfw;
  }
  if ("rateLimitPerUser" in channel) {
    payload.rateLimitPerUser = channel.rateLimitPerUser;
  }
  if ("defaultAutoArchiveDuration" in channel && channel.defaultAutoArchiveDuration) {
    payload.defaultAutoArchiveDuration = channel.defaultAutoArchiveDuration;
  }
  if ("userLimit" in channel) {
    payload.userLimit = channel.userLimit;
  }
  if ("bitrate" in channel) {
    payload.bitrate = channel.bitrate;
  }
  if ("rtcRegion" in channel && channel.rtcRegion) {
    payload.rtcRegion = channel.rtcRegion;
  }
  if ("videoQualityMode" in channel && channel.videoQualityMode) {
    payload.videoQualityMode = channel.videoQualityMode;
  }

  return payload;
}

function categoryCreatePayload(category) {
  return {
    name: category.name,
    type: ChannelType.GuildCategory,
    permissionOverwrites: createOverwrites(category),
    reason,
  };
}

function updateEnvIds(mapping) {
  if (!envPath || !fs.existsSync(envPath)) {
    add("env", "update env ids", "WARN", "env file not found");
    return [];
  }

  const raw = fs.readFileSync(envPath, "utf8");
  const lines = raw.split(/\r?\n/);
  const changed = [];

  const next = lines.map((line) => {
    if (!line || line.trimStart().startsWith("#") || !line.includes("=")) {
      return line;
    }
    const index = line.indexOf("=");
    const key = line.slice(0, index);
    const value = line.slice(index + 1).trim();
    const replacement = mapping[value];
    if (!replacement) {
      return line;
    }
    changed.push({ key, from: value, to: replacement });
    return `${key}=${replacement}`;
  });

  if (changed.length > 0) {
    const backupPath = `${envPath}.before-channel-renew-${Date.now()}`;
    fs.copyFileSync(envPath, backupPath);
    fs.writeFileSync(envPath, next.join("\n"), "utf8");
    add("env", "update env ids", "PASS", `${changed.length} id(s), backup=${backupPath}`);
  } else {
    add("env", "update env ids", "PASS", "no env channel ids matched renewed channels");
  }

  return changed;
}

async function renewCategory(guild, category) {
  const oldChildren = guild.channels.cache
    .filter((channel) => channel.parentId === category.id)
    .sort((a, b) => a.position - b.position);

  const newCategory = await guild.channels.create(categoryCreatePayload(category));
  await newCategory.setPosition(category.position, { reason }).catch((error) => {
    add("position", category.name, "WARN", error.message);
  });

  const mapping = {
    [category.id]: newCategory.id,
  };

  const newChildren = [];
  for (const channel of oldChildren.values()) {
    const created = await guild.channels.create(channelCreatePayload(channel, newCategory.id));
    mapping[channel.id] = created.id;
    newChildren.push({ old: channel, created });
    add("create", `${category.name}/${channel.name}`, "PASS", `${channel.id} -> ${created.id}`);
  }

  for (const pair of newChildren) {
    await pair.created.setPosition(pair.old.position, { reason }).catch((error) => {
      add("position", pair.created.name, "WARN", error.message);
    });
  }

  await redirectCommunityChannels(guild, mapping);

  for (const channel of oldChildren.values()) {
    await channel.delete(reason);
    add("delete", `${category.name}/${channel.name}`, "PASS", channel.id);
  }

  await category.delete(reason);
  add("delete", category.name, "PASS", category.id);
  add("create", category.name, "PASS", `${category.id} -> ${newCategory.id}`);

  return mapping;
}

async function redirectCommunityChannels(guild, mapping) {
  const payload = { reason };
  const changes = [];

  if (guild.rulesChannelId && mapping[guild.rulesChannelId]) {
    payload.rulesChannel = mapping[guild.rulesChannelId];
    changes.push(`rulesChannel:${guild.rulesChannelId}->${mapping[guild.rulesChannelId]}`);
  }

  if (guild.publicUpdatesChannelId && mapping[guild.publicUpdatesChannelId]) {
    payload.publicUpdatesChannel = mapping[guild.publicUpdatesChannelId];
    changes.push(`publicUpdatesChannel:${guild.publicUpdatesChannelId}->${mapping[guild.publicUpdatesChannelId]}`);
  }

  if (guild.safetyAlertsChannelId && mapping[guild.safetyAlertsChannelId]) {
    payload.safetyAlertsChannel = mapping[guild.safetyAlertsChannelId];
    changes.push(`safetyAlertsChannel:${guild.safetyAlertsChannelId}->${mapping[guild.safetyAlertsChannelId]}`);
  }

  if (changes.length === 0) {
    return;
  }

  await guild.edit(payload);
  add("community", "required channels redirected", "PASS", changes.join(", "));
  await guild.channels.fetch();
}

async function main() {
  const token = envValue("DISCORD_TOKEN");
  const guildId = envValue("GUILD_ID") || envValue("DISCORD_GUILD_ID") || envValue("DASHBOARD_GUILD_ID");

  if (!token) {
    add("env", "DISCORD_TOKEN", "FAIL", "missing");
    return printAndExit(1);
  }
  if (!guildId) {
    add("env", "GUILD_ID", "FAIL", "missing");
    return printAndExit(1);
  }

  fs.mkdirSync(runRoot, { recursive: true });

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  });

  await client.login(token);

  try {
    const guild = await client.guilds.fetch(guildId);
    await guild.channels.fetch();
    await guild.roles.fetch();
    const botMember = await guild.members.fetch(client.user.id);

    const canManage = botMember.permissions.has(PermissionsBitField.Flags.ManageChannels);
    add("discord", "bot login", "PASS", client.user.tag);
    add("discord", "guild reachable", "PASS", guild.name);
    add("permissions", "ManageChannels", canManage ? "PASS" : "FAIL", String(canManage));
    if (!canManage) {
      return printAndExit(1);
    }

    const categories = guild.channels.cache
      .filter((channel) => channel.type === ChannelType.GuildCategory && isTargetCategory(channel))
      .sort((a, b) => a.position - b.position);

    add("plan", "target categories", categories.size ? "PASS" : "FAIL", String(categories.size));

    const snapshot = snapshotGuild(guild, [...categories.values()]);
    fs.writeFileSync(path.join(runRoot, "structure-before.json"), JSON.stringify(snapshot, null, 2));

    for (const category of categories.values()) {
      const count = guild.channels.cache.filter((channel) => channel.parentId === category.id).size;
      add("plan", category.name, "PASS", `${count} channel(s)`);
    }

    if (!apply) {
      add("mode", "dry-run", "PASS", "run with --apply to execute renewal");
      return printAndExit(results.some((row) => row.status === "FAIL") ? 1 : 0);
    }

    const idMapping = {};
    for (const category of categories.values()) {
      const mapping = await renewCategory(guild, category);
      Object.assign(idMapping, mapping);
      await guild.channels.fetch();
    }

    const envChanges = updateEnvIds(idMapping);
    const report = {
      generatedAt: new Date().toISOString(),
      runRoot,
      idMapping,
      envChanges,
      results,
    };
    fs.writeFileSync(path.join(runRoot, "renew-report.json"), JSON.stringify(report, null, 2));

    return printAndExit(results.some((row) => row.status === "FAIL") ? 1 : 0);
  } finally {
    client.destroy();
  }
}

function printAndExit(code) {
  const counts = results.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {});
  const summary = {
    generatedAt: new Date().toISOString(),
    mode: apply ? "apply" : "dry-run",
    runRoot,
    counts,
    results,
  };
  fs.mkdirSync(runRoot, { recursive: true });
  fs.writeFileSync(path.join(runRoot, "summary.json"), JSON.stringify(summary, null, 2));
  console.table(results);
  console.log(`Run root: ${runRoot}`);
  process.exitCode = code;
}

main().catch((error) => {
  add("runtime", "renew discord channels", "FAIL", error.stack || error.message);
  printAndExit(1);
});
