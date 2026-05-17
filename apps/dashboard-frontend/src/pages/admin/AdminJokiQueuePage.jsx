import ActionResourcePage from "../../components/dashboard/ActionResourcePage.jsx";
import { jokiService } from "../../services/jokiService.js";

export default function AdminJokiQueuePage() {
  return (
    <ActionResourcePage
      title="Joki Review"
      endpoint="/api/joki/queue"
      dataKey="queue"
      columns={[
        { label: "Job", keys: ["id", "order_id", "orderId"] },
        { label: "Package", keys: ["package_name", "packageName", "orderLabel"] },
        { label: "Status", keys: ["status"] },
        { label: "Penjoki", keys: ["assigned_joki_id", "claimedBy", "assignedJokiId"] },
        { label: "Proof", keys: ["proof_url", "proofUrl"] },
      ]}
      actions={[
        { label: "Approve", run: (row) => jokiService.approve(row.id) },
        {
          label: "Reject",
          tone: "danger",
          run: (row) => {
            const reason = window.prompt("Alasan reject job:");
            return reason !== null ? jokiService.reject(row.id, reason) : Promise.resolve();
          },
        },
        {
          label: "Reassign",
          run: (row) => {
            const jokiId = window.prompt("Discord ID penjoki baru:", row.assigned_joki_id || row.assignedJokiId || row.claimedBy || "");
            return jokiId ? jokiService.reassign(row.id, jokiId) : Promise.resolve();
          },
        },
      ]}
    />
  );
}
