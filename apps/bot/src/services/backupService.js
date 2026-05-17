const { ChannelType } = require("discord.js");
const { createBackup } = require("../database/models/Backup");

function createBackupService({
  botConfig,
  logger,
  database,
  repositories,
  roleService,
  loggingService,
}) {
  function logBestEffort(action, context, error) {
    logger?.warn?.(`${action} failed`, {
      ...(context || {}),
      message: error?.message || String(error),
    });
    return null;
  }

  function serializeRole(role) {
    return {
      name: role.name,
      color: role.color,
      hoist: role.hoist,
      mentionable: role.mentionable,
      permissions: role.permissions.toArray(),
      position: role.position,
    };
  }

  function serializeOverwrites(channel, guild) {
    if (!channel?.permissionOverwrites?.cache) {
      return [];
    }

    return channel.permissionOverwrites.cache
      .map((overwrite) => {
        const isRoleOverwrite = overwrite.type === 0;
        const role = isRoleOverwrite ? guild.roles?.cache?.get?.(overwrite.id) || null : null;
        const member = !isRoleOverwrite ? guild.members?.cache?.get?.(overwrite.id) || null : null;

        return {
          targetType: isRoleOverwrite ? "role" : "member",
          targetId: overwrite.id,
          targetName: role?.name || member?.user?.tag || null,
          allow: overwrite.allow.toArray(),
          deny: overwrite.deny.toArray(),
        };
      })
      .filter(Boolean);
  }

  async function resolvePermissionOverwrites(guild, overwrites = []) {
    const permissionOverwrites = [];

    for (const overwrite of overwrites) {
      let target = null;

      if (overwrite.targetType === "member") {
        target =
          guild.members.cache.get(overwrite.targetId) ||
          (await guild.members.fetch(overwrite.targetId).catch((error) => {
            logBestEffort("resolve member overwrite target", {
              guildId: guild.id,
              targetId: overwrite.targetId,
            }, error);
            return null;
          }));
      } else {
        target =
          overwrite.targetName === "@everyone"
            ? guild.roles.everyone
            : guild.roles.cache.find((entry) => entry.name === overwrite.targetName);
      }

      if (target) {
        permissionOverwrites.push({
          id: target.id,
          allow: overwrite.allow,
          deny: overwrite.deny,
        });
      }
    }

    return permissionOverwrites;
  }

  async function backupStructure(guild) {
    const roleCache = guild?.roles?.cache;
    const channelCache = guild?.channels?.cache;
    if (!roleCache || !channelCache) {
      throw new Error("Guild cache belum siap untuk backup");
    }

    const snapshot = {
      guildId: guild.id,
      guildName: guild.name,
      createdAt: new Date().toISOString(),
      roles: roleCache
        .filter((role) => !role.managed && role.name !== "@everyone")
        .map((role) => serializeRole(role)),
      categories: channelCache
        .filter((channel) => channel.type === ChannelType.GuildCategory)
        .sort((a, b) => a.position - b.position)
        .map((category) => ({
          name: category.name,
          position: category.position,
          overwrites: serializeOverwrites(category, guild),
        })),
      channels: channelCache
        .filter((channel) => channel.type !== ChannelType.GuildCategory && !channel.topic?.startsWith("ticket:"))
        .sort((a, b) => a.position - b.position)
        .map((channel) => ({
          name: channel.name,
          type: channel.type,
          parent: channel.parent?.name || null,
          topic: channel.topic || null,
          position: channel.position,
          overwrites: serializeOverwrites(channel, guild),
        })),
    };

    const fileName = `${guild.id}-${Date.now()}.json`;
    await database.saveBackupFile(fileName, snapshot);
    await repositories.backupRepository.create(
      createBackup({
        id: `BKP-${Date.now()}`,
        guildId: guild.id,
        fileName,
      }),
    );

    await loggingService.logBot(guild, "Backup Created", `Backup struktur tersimpan sebagai \`${fileName}\`.`);
    logger.info("backup created", { guildId: guild.id, fileName, root: botConfig.paths.storage.backups });
    return fileName;
  }

  async function restoreStructure(guild, requestedName) {
    const backups = await database.listBackupFiles();
    const target = requestedName || backups[0];
    if (!target) {
      throw new Error("Belum ada file backup.");
    }

    const backup = await database.readBackupFile(target);

    for (const roleData of backup.roles || []) {
      const existingRole = guild.roles.cache.find((role) => role.name === roleData.name);
      const payload = {
        name: roleData.name,
        color: roleData.color,
        hoist: roleData.hoist,
        mentionable: roleData.mentionable,
        permissions: roleData.permissions,
        reason: "Restore backup role",
      };

      if (!existingRole) {
        await guild.roles.create(payload);
      } else {
        await existingRole.edit(payload);
      }
    }

    await roleService.ensureRoles(guild);

    for (const roleData of [...(backup.roles || [])].sort((a, b) => a.position - b.position)) {
      const role = guild.roles.cache.find((entry) => entry.name === roleData.name);
      if (role) {
        await role.setPosition(roleData.position).catch((error) => {
          logBestEffort("set restored role position", {
            guildId: guild.id,
            roleName: roleData.name,
            position: roleData.position,
          }, error);
        });
      }
    }

    for (const categoryData of backup.categories || []) {
      const permissionOverwrites = await resolvePermissionOverwrites(guild, categoryData.overwrites);
      let category = guild.channels.cache.find(
        (channel) => channel.type === ChannelType.GuildCategory && channel.name === categoryData.name,
      );

      if (!category) {
        category = await guild.channels.create({
          name: categoryData.name,
          type: ChannelType.GuildCategory,
          permissionOverwrites,
          reason: "Restore backup kategori",
        });
      } else {
        await category.edit({
          permissionOverwrites,
          reason: "Restore backup kategori",
        });
      }
    }

    for (const channelData of backup.channels || []) {
      const parent = channelData.parent
        ? guild.channels.cache.find(
            (channel) => channel.type === ChannelType.GuildCategory && channel.name === channelData.parent,
          )
        : null;

      const permissionOverwrites = await resolvePermissionOverwrites(guild, channelData.overwrites);

      let channel = guild.channels.cache.find(
        (entry) => entry.name === channelData.name && entry.type === channelData.type,
      );

      if (!channel) {
        const createPayload = {
          name: channelData.name,
          type: channelData.type,
          parent: parent?.id || null,
          permissionOverwrites,
          reason: "Restore backup channel",
        };

        if (channelData.topic && channelData.type !== ChannelType.GuildVoice) {
          createPayload.topic = channelData.topic;
        }

        channel = await guild.channels.create(createPayload);
      } else {
        const editPayload = {
          parent: parent?.id || null,
          permissionOverwrites,
          reason: "Restore backup channel",
        };

        if (channelData.topic && channelData.type !== ChannelType.GuildVoice) {
          editPayload.topic = channelData.topic;
        }

        await channel.edit(editPayload);
      }

      await channel.setPosition(channelData.position).catch((error) => {
        logBestEffort("set restored channel position", {
          guildId: guild.id,
          channelName: channelData.name,
          position: channelData.position,
        }, error);
      });
    }

    for (const categoryData of backup.categories || []) {
      const category = guild.channels.cache.find(
        (channel) => channel.type === ChannelType.GuildCategory && channel.name === categoryData.name,
      );
      if (category) {
        await category.setPosition(categoryData.position).catch((error) => {
          logBestEffort("set restored category position", {
            guildId: guild.id,
            categoryName: categoryData.name,
            position: categoryData.position,
          }, error);
        });
      }
    }

    await loggingService.logBot(guild, "Restore Completed", `Restore struktur dari \`${target}\` selesai.`);
    return target;
  }

  return {
    backupStructure,
    restoreStructure,
  };
}

module.exports = {
  createBackupService,
};
