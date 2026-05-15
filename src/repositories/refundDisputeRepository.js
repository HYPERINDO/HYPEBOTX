function createRefundDisputeRepository(database) {
    async function getAll() {
        return database.read("refundDisputes", []);
    }

    async function setAll(rows) {
        return database.write("refundDisputes", rows);
    }

    return {
        async getAll() {
            return getAll();
        },

        async findById(id) {
            const rows = await getAll();
            return rows.find((row) => row.id === id) || null;
        },

        async findByOrderId(orderId) {
            const rows = await getAll();
            return rows.filter((row) => row.orderId === orderId);
        },

        async findLatestByOrderId(orderId) {
            const rows = await getAll();
            const list = rows.filter((row) => row.orderId === orderId).sort((a, b) => String(a.id).localeCompare(String(b.id)));
            return list.length ? list[list.length - 1] : null;
        },

        async findByCustomerId(guildId, customerId) {
            const rows = await getAll();
            return rows.filter((row) => row.guildId === guildId && row.customerUserId === customerId);
        },

        async create(payload) {
            const rows = await getAll();
            const now = new Date().toISOString();
            const row = {
                id: payload.id,
                guildId: payload.guildId,
                orderId: payload.orderId,
                ticketId: payload.ticketId || null,

                customerUserId: payload.customerUserId,
                customerName: payload.customerName || "",

                type: payload.type, // refund | dispute
                status: payload.status || "requested",

                reason: payload.reason || "-",
                adminHandle: payload.adminHandle || null,
                staffHandle: payload.staffHandle || null,

                reviewerNote: payload.reviewerNote || "",
                adminDecisionAt: payload.adminDecisionAt || null,

                createdAt: payload.createdAt || now,
                updatedAt: payload.updatedAt || now,
            };

            if (rows.some((r) => r.id === row.id)) {
                throw new Error(`Duplicate refundDispute id: ${row.id}`);
            }

            rows.push(row);
            await setAll(rows);
            return row;
        },

        async updateById(id, changes) {
            const rows = await getAll();
            const idx = rows.findIndex((row) => row.id === id);
            if (idx < 0) return null;

            const now = new Date().toISOString();
            rows[idx] = { ...rows[idx], ...changes, updatedAt: now };
            await setAll(rows);
            return rows[idx];
        },
    };
}

module.exports = {
    createRefundDisputeRepository,
};
