import { formatRupiah } from "@hypebotx/shared";
import { jokiRepository } from "../repositories/jokiRepository.js";
import { orderRepository } from "../repositories/orderRepository.js";
import { paymentRepository } from "../repositories/paymentRepository.js";
import { stockRepository } from "../repositories/stockRepository.js";
import { ticketRepository } from "../repositories/ticketRepository.js";
import { userRepository } from "../repositories/userRepository.js";
import { auditRepository } from "../repositories/auditRepository.js";

function amountOf(row) {
  const raw = row?.amount ?? row?.price ?? row?.total ?? 0;
  const value = typeof raw === "number" ? raw : Number(String(raw).replace(/[^\d]/g, ""));
  return Number.isFinite(value) ? value : 0;
}

function newest(rows) {
  return [...rows].sort((a, b) => new Date(b.updated_at || b.updatedAt || b.created_at || b.createdAt || 0) - new Date(a.updated_at || a.updatedAt || a.created_at || a.createdAt || 0));
}

export const dashboardDataService = {
  async overview(role, discordId) {
    const [orders, payments, tickets, jobs, products, stock, staff, auditLogs] = await Promise.all([
      orderRepository.list(),
      paymentRepository.list(),
      ticketRepository.list(),
      jokiRepository.listJobs(),
      stockRepository.products.list(),
      stockRepository.stock.list(),
      userRepository.list(),
      auditRepository.list(),
    ]);

    const scopedJobs = role === "penjoki"
      ? jobs.filter((job) => [job.assigned_joki_id, job.assignedJokiId, job.claimedBy, job.userId].map(String).includes(String(discordId)))
      : jobs;
    const paidRevenue = payments
      .filter((payment) => ["paid", "success"].includes(String(payment.status || payment.payment_status || "").toLowerCase()))
      .reduce((sum, payment) => sum + amountOf(payment), 0);

    return {
      metrics: {
        ordersTotal: orders.length,
        ordersToday: orders.filter((order) => String(order.created_at || order.createdAt || "").slice(0, 10) === new Date().toISOString().slice(0, 10)).length,
        revenue: paidRevenue,
        revenueText: formatRupiah(paidRevenue),
        pendingPayments: payments.filter((payment) => ["pending", "submitted", "unpaid"].includes(String(payment.status || payment.payment_status || "").toLowerCase())).length,
        activeTickets: tickets.filter((ticket) => !["closed", "done"].includes(String(ticket.status || "").toLowerCase())).length,
        activeJoki: scopedJobs.filter((job) => !["done", "completed", "cancelled"].includes(String(job.status || "").toLowerCase())).length,
        stockAvailable: stock.filter((row) => String(row.status || "").toLowerCase() === "available").length,
        staffActive: staff.filter((row) => String(row.status || "active").toLowerCase() === "active").length,
      },
      recent: {
        orders: newest(orders).slice(0, 10),
        payments: newest(payments).slice(0, 10),
        tickets: newest(tickets).slice(0, 10),
        joki: newest(scopedJobs).slice(0, 10),
        products: newest(products).slice(0, 10),
        auditLogs: newest(auditLogs).slice(0, 20),
      },
    };
  },
};
