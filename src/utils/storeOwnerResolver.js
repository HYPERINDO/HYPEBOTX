const { PermissionsBitField } = require("discord.js");

function normalize(value) {
    return String(value || "").toLowerCase().trim();
}

function isOwnerQuestion(text) {
    const t = normalize(text);

    const hasOwnerWord = t.includes("owner");
    const hasOwnerWord2 = t.includes("pemilik") || t.includes("pemilik toko");
    const hasHyperindo = t.includes("hyperindo");

    const ownerHyperindo = hasHyperindo && (hasOwnerWord || t.includes("pemilik"));
    const ownerOwnerQuery = (t.includes("siapa owner") || t.includes("siapa pemilik") || (hasOwnerWord && hasHyperindo));
    const tokoRule = t.includes("pemilik toko") || (t.includes("pemilik") && t.includes("toko"));

    return ownerHyperindo || ownerOwnerQuery || tokoRule || hasOwnerWord || hasOwnerWord2;
}

function parseCommaList(value) {
    return String(value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

function resolveRoleMembersById(guild, roleIds) {
    if (!guild || !Array.isArray(roleIds) || !roleIds.length) return [];
    const roles = roleIds
        .map((id) => guild.roles.cache.get(id) || null)
        .filter(Boolean);
    return roles;
}

function buildMemberSummary(member) {
    if (!member || !member.user) return null;
    return {
        userId: member.user.id,
        username: member.user.username,
        displayName: member.displayName || member.user.username,
    };
}

/**
 * Returns a list of user mentions for given role names.
 * Falls back to role mentions if members cache is empty.
 */
async function resolveRoleMemberMentionsById(guild, roleIds) {
    if (!guild || !Array.isArray(roleIds) || roleIds.length === 0) return [];

    const mentions = [];
    for (const roleId of roleIds) {
        if (!roleId) continue;
        const role = guild.roles.cache.get(roleId) || (await guild.roles.fetch(roleId).catch(() => null));
        if (!role) continue;

        const membersCache = role.members?.cache ? role.members.cache : null;
        const members = membersCache && membersCache.size > 0
            ? Array.from(membersCache.values())
            : [];

        if (!members.length) {
            try {
                const fetched = await role.members.fetch({ limit: 10 }).catch(() => null);
                if (fetched && fetched.size > 0) {
                    members.push(...Array.from(fetched.values()));
                }
            } catch {
                // ignore
            }
        }

        mentions.push(...members
            .filter((m) => m?.user?.id)
            .slice(0, 10)
            .map((m) => `<@${m.user.id}>`));
    }

    return mentions;
}

function buildOwnerAnswer(mentionsByOwner, mentionsByCoOwner, fallbackText = "Owner toko adalah anggota yang memiliki role OWNER (dan CO-OWNER bila relevan).") {
    const ownerMentions = mentionsByOwner || [];
    const coOwnerMentions = mentionsByCoOwner || [];

    if (ownerMentions.length === 0 && coOwnerMentions.length === 0) return fallbackText;

    const ownerLine = ownerMentions.length > 0 ? `• OWNER: ${ownerMentions.join(", ")}` : `• OWNER: (tidak dapat dimuat)`;
    const coOwnerLine = coOwnerMentions.length > 0 ? `• CO-OWNER: ${coOwnerMentions.join(", ")}` : `• CO-OWNER: (tidak ada / tidak dapat dimuat)`;

    return `Owner toko Hyperindo:\n${ownerLine}\n${coOwnerLine}\n\nKalau kamu butuh akses atau info khusus, silakan hubungi salah satu di atas.`;
}

async function tryResolveOwnerAnswer({ guild, question }) {
    if (!guild) return null;
    if (!isOwnerQuestion(question)) return null;

    const ownerRoleIds = parseCommaList(process.env.OWNER_ROLE_IDS);
    const coOwnerRoleIds = parseCommaList(process.env.CO_OWNER_ROLE_IDS);

    const ownerMentions = await resolveRoleMemberMentionsById(guild, ownerRoleIds);
    const coOwnerMentions = await resolveRoleMemberMentionsById(guild, coOwnerRoleIds);

    if (ownerMentions.length === 0 && coOwnerMentions.length === 0) {
        const configuredOwnerName = String(process.env.OWNER_NAME || "").trim();
        const configuredOwnerUserId = String(process.env.OWNER_USER_ID || "").trim();
        if (configuredOwnerUserId) {
            const mention = `<@${configuredOwnerUserId}>`;
            return buildOwnerAnswer(ownerMentions.length ? ownerMentions : [mention], coOwnerMentions);
        }
    }

    return buildOwnerAnswer(ownerMentions, coOwnerMentions);
}

module.exports = {
    isOwnerQuestion,
    tryResolveOwnerAnswer,
};
