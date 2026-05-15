const roleNames = require("../config/roles");

function createRoleService({ logger, repositories, templateService }) {
  const legacyRoleAliases = {
    [roleNames.coOwner]: ["CO OWNER"],
    [roleNames.itDev]: ["IT DEV"],
    [roleNames.penjoki]: ["PENJOKI"],
    [roleNames.jokiPing]: ["JOKI PING", "BOOSTING PING"],
    [roleNames.serverBooster]: ["BOOSTING PING"],
    [roleNames.vipCustomer]: ["VIP CUSTOMER", "SULTAN HYPERINDO"],
    [roleNames.sultanHyperindo]: ["VIP CUSTOMER", "SULTAN HYPERINDO"],
  };

  function normalizeRoleName(roleName) {
    return String(roleName || "").trim().toUpperCase();
  }

  function findRole(guild, roleName) {
    const target = normalizeRoleName(roleName);
    const directMatch =
      guild.roles.cache.find((role) => normalizeRoleName(role.name) === target) || null;
    if (directMatch) {
      return directMatch;
    }

    const aliasNames = (legacyRoleAliases[roleName] || []).map(normalizeRoleName);
    if (!aliasNames.length) {
      return null;
    }

    for (const aliasName of aliasNames) {
      const aliasMatch =
        guild.roles.cache.find((role) => normalizeRoleName(role.name) === aliasName) || null;
      if (aliasMatch) {
        return aliasMatch;
      }
    }

    return null;
  }

  function getRoleMap(guild) {
    return {
      hypebotx: findRole(guild, roleNames.hypebotx),
      owner: findRole(guild, roleNames.owner),
      manager: findRole(guild, roleNames.manager),
      admin: findRole(guild, roleNames.admin),
      staff: findRole(guild, roleNames.staff),
      itDev: findRole(guild, roleNames.itDev),
      penjoki: findRole(guild, roleNames.penjoki),
      jokiPing: findRole(guild, roleNames.jokiPing),
      member: findRole(guild, roleNames.member),
      unverified: findRole(guild, roleNames.unverified),
      customer: findRole(guild, roleNames.customer),
      vipCustomer: findRole(guild, roleNames.vipCustomer),
      sultanHyperindo: findRole(guild, roleNames.sultanHyperindo),
      promoPing: findRole(guild, roleNames.promoPing),
      eventPing: findRole(guild, roleNames.eventPing),
      enhanced: findRole(guild, roleNames.enhanced),
      legacy: findRole(guild, roleNames.legacy),
      serverBooster: findRole(guild, roleNames.serverBooster),
      dj: findRole(guild, roleNames.dj),
      pramugara: findRole(guild, roleNames.pramugara),
      muted: findRole(guild, roleNames.muted),
      botWeb: findRole(guild, roleNames.botWeb),
    };
  }

  async function ensureRoles(guild) {
    const summary = { created: [], updated: [], failed: [] };
    const templates = templateService.getRoleTemplates();

    for (const template of templates) {
      try {
        // Workaround: avoid repeated noise when bot can’t manage this role due to hierarchy/permissions.
        if (template?.name === "HYPEBOTX") {
          continue;
        }

        const existing = findRole(guild, template.name);
        const payload = {
          name: template.name,
          color: template.color,
          hoist: template.hoist,
          mentionable: template.mentionable,
          permissions: template.permissions,
        };

        if (!existing) {
          await guild.roles.create(payload);
          summary.created.push(template.name);
        } else {
          await existing.edit(payload);
          summary.updated.push(template.name);
        }
      } catch (error) {
        logger.error("role ensure failed", { roleName: template.name, guildId: guild.id, error: error.message });
        summary.failed.push(template.name);
      }
    }

    try {
      const roleMap = getRoleMap(guild);
      await repositories.guildRepository.upsert(guild.id, {
        roles: Object.fromEntries(
          Object.entries(roleMap)
            .filter(([, role]) => role)
            .map(([key, role]) => [key, role.id]),
        ),
      });
    } catch (error) {
      logger.error("role map save failed", { guildId: guild.id, error: error.message });
    }

    logger.info("roles ensured", { guildId: guild.id, summary });
    return summary;
  }

  async function addRole(member, roleName) {
    try {
      if (!member || !member.guild) {
        throw new Error("Invalid member object");
      }

      if (typeof roleName !== "string" || !roleName.trim()) {
        throw new Error("Invalid role name");
      }

      const role = member.guild.roles.cache.find((entry) => entry.name === roleName);
      if (!role) {
        logger.warn("role not found", { roleName, guildId: member.guild.id });
        return null;
      }

      if (!member.roles.cache.has(role.id)) {
        await member.roles.add(role, "Role assignment by bot");
        logger.info("role added", { userId: member.id, roleName, guildId: member.guild.id });
      }

      return role;
    } catch (error) {
      logger.error("add role failed", { roleName, memberId: member?.id, error: error.message });
      throw error;
    }
  }

  async function removeRole(member, roleName) {
    try {
      if (!member || !member.guild) {
        throw new Error("Invalid member object");
      }

      if (typeof roleName !== "string" || !roleName.trim()) {
        throw new Error("Invalid role name");
      }

      const role = member.guild.roles.cache.find((entry) => entry.name === roleName);
      if (!role) {
        logger.warn("role not found for removal", { roleName, guildId: member.guild.id });
        return null;
      }

      if (member.roles.cache.has(role.id)) {
        await member.roles.remove(role, "Role removal by bot");
        logger.info("role removed", { userId: member.id, roleName, guildId: member.guild.id });
      }

      return role;
    } catch (error) {
      logger.error("remove role failed", { roleName, memberId: member?.id, error: error.message });
      throw error;
    }
  }

  return {
    ensureRoles,
    getRoleMap,
    addRole,
    removeRole,
  };
}

module.exports = {
  createRoleService,
};
