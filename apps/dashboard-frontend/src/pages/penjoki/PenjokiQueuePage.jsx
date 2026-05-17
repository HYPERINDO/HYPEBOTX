import ActionResourcePage from "../../components/dashboard/ActionResourcePage.jsx";
import { jokiService } from "../../services/jokiService.js";

export default function PenjokiQueuePage() {
  return (
    <ActionResourcePage
      title="Available Queue"
      endpoint="/api/joki/queue"
      dataKey="queue"
      columns={[
        { label: "Job", keys: ["id", "order_id", "orderId"] },
        { label: "Package", keys: ["package_name", "packageName", "orderLabel"] },
        { label: "Status", keys: ["status"] },
        { label: "ETA", keys: ["etaAt", "deadline", "estimatedSeconds"] },
      ]}
      actions={[
        { label: "Claim", run: (row) => jokiService.claim(row.id) },
      ]}
    />
  );
}
