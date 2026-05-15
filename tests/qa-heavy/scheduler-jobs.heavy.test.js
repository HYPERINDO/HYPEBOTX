const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");

const { createDatabase } = require("../../src/database/connection");
const { createTicketRepository } = require("../../src/repositories/ticketRepository");
const { createOrderRepository } = require("../../src/repositories/orderRepository");
const { createTicketService } = require("../../src/services/ticketService");

function createTempPaths() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "hypebotx-qa-heavy-scheduler-"));
    return {
        root,
        storage: {
            root: path.join(root, "storage"),
            backups: path.join(root, "storage", "backups"),
            temp: path.join(root, "storage", "temp"),
            transcripts: path.join(root, "storage", "transcripts"),
        },
    };
}

function createSilentLogger() {
    return { info() { }, warn() { }, error() { } };
}

test("scheduler jobs heavy: auto close inactive ticket, ignore critical ones", async () => {
    const paths = createTempPaths();
    fs.mkdirSync(paths.storage.transcripts, { recursive: true });
    
    const logger = createSilentLogger();
    const database = createDatabase(paths, logger);
    database.init();

    const ticketRepository = createTicketRepository(database);
    const orderRepository = createOrderRepository(database);
    
    let deletedChannels = [];
    const mockClientChannels = {
        cache: {
            get: (id) => ({
                id,
                isTextBased: () => true,
                delete: async () => { deletedChannels.push(id); },
                send: async () => ({ id: "m-1", createdTimestamp: Date.now() }),
                messages: { fetch: async () => ({ size: 0, first: () => null }) },
                createdTimestamp: Date.now() - 25 * 60 * 60 * 1000
            })
        }
    };
    const mockClient = {
        isReady: () => true,
        token: "mock-token",
        guilds: {
            cache: { get: () => ({ id: "g-1", channels: mockClientChannels }) },
            fetch: async () => ({ id: "g-1", channels: mockClientChannels })
        },
        channels: mockClientChannels
    };
    
    // Seed Tickets
    const now = Date.now();
    const oneDayOld = new Date(now - 25 * 60 * 60 * 1000).toISOString();
    
    // 1. Inactive ticket (no order attached) -> should be closed
    await ticketRepository.create({ id: "T-1", channelId: "C-1", type: "support", status: "open", createdAt: oneDayOld });
    
    // 2. Ticket with active order -> should NOT be closed
    await ticketRepository.create({ id: "T-2", channelId: "C-2", type: "order", status: "open", createdAt: oneDayOld });
    await orderRepository.create({ id: "O-2", ticketId: "T-2", status: "processing" });
    
    // 3. Ticket with paid order -> should NOT be closed
    await ticketRepository.create({ id: "T-3", channelId: "C-3", type: "order", status: "open", createdAt: oneDayOld });
    await orderRepository.create({ id: "O-3", ticketId: "T-3", status: "paid" });
    
    // 4. Ticket with completed order, already closed -> should be ignored
    await ticketRepository.create({ id: "T-4", channelId: "C-4", type: "order", status: "closed", createdAt: oneDayOld });
    
    // 5. Very old completed ticket -> could be closed if we clean up open tickets with completed orders
    await ticketRepository.create({ id: "T-5", channelId: "C-5", type: "order", status: "open", createdAt: oneDayOld });
    await orderRepository.create({ id: "O-5", ticketId: "T-5", status: "completed" });
    
    const botConfig = { jobs: { autoCloseTicket: { maxInactiveHours: 24, checkIntervalMinutes: 60, sendWarningFirst: false } } };
    
    const ticketService = createTicketService({
        botConfig,
        logger,
        database,
        repositories: { ticketRepository, orderRepository, userRepository: null, simpleStoreRepository: null },
        loggingService: null,
    });
    
    await ticketService.sweepInactiveTickets(mockClient);
    
    const allTickets = await ticketRepository.getAll();
    
    // T-1 closed
    assert.equal(allTickets.find(t => t.id === "T-1").status, "closed");
    // T-2 open
    assert.equal(allTickets.find(t => t.id === "T-2").status, "open");
    // T-3 open
    assert.equal(allTickets.find(t => t.id === "T-3").status, "open");
    // T-5 closed
    assert.equal(allTickets.find(t => t.id === "T-5").status, "closed");
});
