const { PermissionFlagsBits } = require("discord.js");

module.exports = {
  adminCommand: PermissionFlagsBits.ManageGuild,
  staffCommand: PermissionFlagsBits.ManageChannels,
  adminRolePermissions: [
    PermissionFlagsBits.ManageGuild,
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ManageMessages,
    PermissionFlagsBits.ModerateMembers,
    PermissionFlagsBits.ViewAuditLog,
    PermissionFlagsBits.ManageThreads,
    PermissionFlagsBits.UseApplicationCommands,
  ],
  staffRolePermissions: [
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ManageMessages,
    PermissionFlagsBits.ModerateMembers,
    PermissionFlagsBits.ViewAuditLog,
    PermissionFlagsBits.ManageThreads,
    PermissionFlagsBits.UseApplicationCommands,
  ],
  ownerRolePermissions: [PermissionFlagsBits.Administrator],
};
