const test = require("node:test");
const assert = require("node:assert/strict");

const {
    createTestDatabase,
    createAllRepositories,
    createFakeGuild,
    createFakeInteraction,
    createFakeMember,
} = require("../business/helpers");

const jokiSyncAllCommand = require("../../src/commands/admin/jokiSyncAll");

function createSilentLogger() {
    return { info() { }, warn() { }, error() { }, debug() { } };
}

test("feature joki-sync-all: dry_run:true tidak memanggil sync; dry_run:false memanggil sync dan report valid", async () => {
    const { database } = createTestDatabase("features-sync-all");
    const repositories = createAllRepositories(database);

    const guild = createFakeGuild();
    const staff = createFakeMember({ userId: "staff-1", roles: ["STAFF"] });

    // Seed queue with two orders, one with ticketId and one without (minimal for scanning)
    const q1 = await repositories.jokiRepository.addToQueue(guild.id, {
        ticketId: "t-1",
        userId: staff.user.id,
        orderLabel: "🎮 ENHANCED\nOrderSync1\nORDER ID: HYP-0301",
        totalHeist: 10,
        completedHeist: 0,
        remainingHeist: 10,
        dailyLimitHeist: 20,
        progressDate: "2026-05-12",
    });
    await repositories.jokiRepository.setOrderStatus(guild.id, q1.id, { status: "processing", ticketId: "t-1" });

    const q2 = await repositories.jokiRepository.addToQueue(guild.id, {
        ticketId: null,
        userId: staff.user.id,
        orderLabel: "🎮 ENHANCED\nOrderSync2\nORDER ID: HYP-0302",
        totalHeist: 10,
        completedHeist: 0,
        remainingHeist: 10,
        dailyLimitHeist: 20,
        progressDate: "2026-05-12",
    });
    await repositories.jokiRepository.setOrderStatus(guild.id, q2.id, { status: "hold", ticketId: null });

    // Seed tickets minimal: candidateTickets uses (meta.type === "order") and meta fields heuristically.
    // We create ticket rows only if repository supports create/add; otherwise command will still scan empty list.
    // Best-effort: if ticketRepository.addTicket/create exists, use it; else, rely on minimal queue fallback scan.
    if (typeof repositories.ticketRepository?.addTicket === "function") {
        await repositories.ticketRepository.addTicket({
            id: "t-1",
            guildId: guild.id,
            channelId: "ch-1",
            status: "open",
            type: "order",
            meta: { formType: "order", paymentNote: "ok" },
        });
    }

    let syncCallCount = 0;
    const statusSyncService = {
        syncTicketOrderQueueStatus: async () => {
            syncCallCount += 1;
            return { ok: true, errors: [] };
        },
    };

    // Fake client container expected shape:
    const client = {
        container: {
            services: { statusSyncService },
            repositories,
        },
    };

    // 1) dry_run:true => no sync calls
    {
        syncCallCount = 0;
        const interaction = createFakeInteraction({
            guildId: guild.id,
            userId: staff.user.id,
            roles: ["STAFF"],
            options: { dry_run: true },
        });

        await jokiSyncAllCommand.execute(interaction, client);

        const content = String(interaction._lastReplyContent || "");
        assert.ok(/DRY RUN/i.test(content) || /dry-run/i.test(content), "report should mention dry-run");
        assert.equal(syncCallCount, 0, "dry_run should not call sync service");
    }

    // 2) dry_run:false => sync calls happen, report valid
    {
        syncCallCount = 0;
        const interaction = createFakeInteraction({
            guildId: guild.id,
            userId: staff.user.id,
            roles: ["STAFF"],
            options: { dry_run: false },
        });

        await jokiSyncAllCommand.execute(interaction, client);

        const content = String(interaction._lastReplyContent || "");
        assert.ok(/Sync All selesai/i.test(content), "report should include sync-all finished header");
        assert.ok(/Berhasil sync/i.test(content), "report should include success count");
        assert.ok(/Dilewati/i.test(content), "report should include skipped count");
        assert.ok(/Gagal/i.test(content), "report should include fail count");
        assert.ok(syncCallCount > 0, "dry_run:false should call sync service");
    }
});
