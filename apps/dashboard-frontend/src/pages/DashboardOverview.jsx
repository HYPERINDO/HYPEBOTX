import StatCard from "../components/ui/StatCard.jsx";
import { useApi } from "../hooks/useApi.js";

const metricLabels = {
  ordersTotal: "Total Order",
  ordersToday: "Order Hari Ini",
  revenueText: "Omzet",
  pendingPayments: "Pending Payment",
  activeTickets: "Ticket Aktif",
  activeJoki: "Queue Joki",
  stockAvailable: "Stock Ready",
  staffActive: "Staff Aktif",
};

export default function DashboardOverview({ title }) {
  const { data, loading, error } = useApi("/api/dashboard/overview");
  const metrics = data?.metrics || {};
  const auditLogs = data?.recent?.auditLogs || [];

  return (
    <main className="overview-grid">
      <section className="content-panel hero-panel">
        <div>
          <h2>{title}</h2>
          <p>{loading ? "Sinkronisasi data..." : "Status operasional HYPEBOTX"}</p>
        </div>
        {error ? <span className="inline-alert">Backend belum siap atau session berakhir.</span> : <span className="status-dot">Online</span>}
      </section>
      <section className="stats-grid">
        {Object.entries(metricLabels).map(([key, label]) => (
          <StatCard key={key} label={label} value={metrics[key] ?? "-"} />
        ))}
      </section>
      <section className="content-panel">
        <div className="panel-heading">
          <h2>Audit Terbaru</h2>
          <span>{auditLogs.length} log</span>
        </div>
        <div className="audit-list">
          {auditLogs.slice(0, 8).map((log) => (
            <div key={log.id || `${log.action}-${log.created_at}`} className="audit-row">
              <strong>{log.action}</strong>
              <span>{log.actor_username || log.actor_role || "system"}</span>
              <time>{String(log.created_at || "").replace("T", " ").slice(0, 19)}</time>
            </div>
          ))}
          {!auditLogs.length ? <p>Belum ada audit log.</p> : null}
        </div>
      </section>
    </main>
  );
}
