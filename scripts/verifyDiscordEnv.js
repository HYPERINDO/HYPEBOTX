const path = require("path");
const fs = require("fs");
const { createApp } = require("../apps/bot/src/app");
const roleNames = require("../apps/bot/src/config/roles");

const envVars = [
    "TICKET_CATEGORY_ID",
    "MEMBER_ROLE_ID",
    "STAFF_ROLE_ID",
    "OWNER_ROLE_ID",
    "VERIFIED_ROLE_ID",
    "VERIFY_ROLE_ID",
    "VERIFIED_ROLE_IDS",
    "TICKET_LOG_CHANNEL_ID",
    "TRANSCRIPT_CHANNEL_ID",
];

const roleCandidates = {
    MEMBER_ROLE_ID: roleNames.member,
    STAFF_ROLE_ID: roleNames.staff,
    OWNER_ROLE_ID: roleNames.owner,
    VERIFIED_ROLE_ID: "VERIFIED",
    VERIFY_ROLE_ID: "VERIFY",
};

const channelCandidates = {
    TICKET_LOG_CHANNEL_ID: ["ticket-logs", "ticket-log", "order-logs", "admin-logs"],
    TRANSCRIPT_CHANNEL_ID: ["transcript", "transcripts", "ticket-transcript", "ticket-logs"],
};

function normalizeName(value) {
    return String(value || "").trim().toLowerCase();
}

function findRoleByName(guild, name) {
    if (!name) return null;
    const normalized = normalizeName(name);
    return guild.roles.cache.find((role) => normalizeName(role.name) === normalized) ||
        guild.roles.cache.find((role) => normalizeName(role.name).includes(normalized));
}

function findRoleByIdOrName(guild, id, name) {
    if (id && guild.roles.cache.has(id)) {
        return guild.roles.cache.get(id);
    }
    return findRoleByName(guild, name);
}

function findChannelByName(guild, name) {
    if (!name) return null;
    const normalized = normalizeName(name);
    return guild.channels.cache.find((channel) => normalizeName(channel.name) === normalized) ||
        guild.channels.cache.find((channel) => normalizeName(channel.name).includes(normalized));
}

function findChannelByIdOrName(guild, id, name) {
    if (id && guild.channels.cache.has(id)) {
        return guild.channels.cache.get(id);
    }
    return findChannelByName(guild, name);
}

function getEnvValue(name) {
    return (process.env[name] || "").trim();
}

async function main() {
    const app = createApp();
    app.client.once("ready", async () => {
        const guildId = app.client.container.botConfig.guildId;
        if (!guildId) {
            throw new Error("GUILD_ID tidak diset di .env");
        }

        const guild = app.client.guilds.cache.get(guildId) || await app.client.guilds.fetch(guildId);
        if (!guild) {
            throw new Error(`Guild ${guildId} tidak ditemukan.`);
        }

        await guild.roles.fetch();
        await guild.channels.fetch();

        const ticketCategoryName = getEnvValue("TICKET_CATEGORY_NAME") || "ACTIVE TICKETS";
        const ticketCategoryId = getEnvValue("TICKET_CATEGORY_ID");
        const ticketCategory = guild.channels.cache.get(ticketCategoryId) ||
            guild.channels.cache.find((channel) => channel.type === 4 && normalizeName(channel.name) === normalizeName(ticketCategoryName));

        const verifiedConfigured = Boolean(
            getEnvValue("VERIFIED_ROLE_ID") ||
            getEnvValue("VERIFIED_ROLE_IDS"),
        );

        const checks = [];

        checks.push({
            name: "TICKET_CATEGORY_ID",
            env: ticketCategoryId,
            found: ticketCategory?.id || null,
            description: `Category name: ${ticketCategoryName}`,
        });

        for (const [envKey, roleName] of Object.entries(roleCandidates)) {
            const envValue = getEnvValue(envKey);
            const found = roleName ? findRoleByIdOrName(guild, envValue, roleName)?.id : null;
            checks.push({
                name: envKey,
                env: envValue,
                found,
                description: roleName ? `Role name: ${roleName}` : "Role lookup",
                optional: envKey === "VERIFY_ROLE_ID" && !envValue && verifiedConfigured,
            });
        }

        for (const [envKey, names] of Object.entries(channelCandidates)) {
            const envValue = getEnvValue(envKey);
            let foundChannel = envValue ? guild.channels.cache.get(envValue) : null;
            if (!foundChannel) {
                for (const name of names) {
                    foundChannel = findChannelByName(guild, name);
                    if (foundChannel) break;
                }
            }
            checks.push({
                name: envKey,
                env: envValue,
                found: foundChannel?.id || null,
                description: `Channel search: ${names.join(", ")}`,
            });
        }

        console.log("=== Discord env sync report ===");
        for (const check of checks) {
            let status;
            if (check.env) {
                status = check.env === check.found
                    ? "OK"
                    : `MISMATCH (env:${check.env}, found:${check.found || "none"})`;
            } else if (check.optional) {
                status = `OPTIONAL (verified via VERIFIED_ROLE_ID/VERIFIED_ROLE_IDS)`;
            } else {
                status = `MISSING (found:${check.found || "none"})`;
            }

            console.log(`${check.name}: ${status}`);
            console.log(`  ${check.description}`);
            if (check.found && check.env !== check.found) {
                console.log(`  Suggested .env line: ${check.name}=${check.found}`);
            }
        }

        const syncable = checks.filter((check) => check.found && check.env !== check.found);
        if (syncable.length === 0) {
            console.log("\nAll configured env IDs are in sync with the guild data that could be matched.");
        } else {
            console.log("\nThe following env values differ from guild discovery:");
            syncable.forEach((check) => {
                console.log(`- ${check.name}: env=${check.env || "<missing>"}, found=${check.found}`);
            });
            console.log("\nUpdate .env with the suggested values above if they are correct.");
        }

        process.exit(0);
    });

    await app.start();
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
