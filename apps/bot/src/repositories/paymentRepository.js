function createPaymentRepository(database) {
  return {
    async getAll() {
      return database.read("payments", []);
    },
    async findById(id) {
      const rows = await database.read("payments", []);
      return rows.find((row) => row.id === id) || null;
    },
    async findByOrderId(orderId) {
      const rows = await database.read("payments", []);
      return rows.filter((row) => row.orderId === orderId || row.ticketId === String(orderId).replace(/^ORD-/, ""));
    },
    async findByTicketId(ticketId) {
      const rows = await database.read("payments", []);
      return rows.filter((row) => row.ticketId === ticketId);
    },
    async create(payment) {
      const rows = await database.read("payments", []);
      rows.push(payment);
      await database.write("payments", rows);
      return payment;
    },
    async updateById(id, changes) {
      const rows = await database.read("payments", []);
      const index = rows.findIndex((row) => row.id === id);
      if (index < 0) return null;

      rows[index] = { ...rows[index], ...changes };
      await database.write("payments", rows);
      return rows[index];
    },
  };
}

module.exports = {
  createPaymentRepository,
};
