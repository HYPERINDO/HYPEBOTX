import ActionResourcePage from "../../components/dashboard/ActionResourcePage.jsx";

const doneStatuses = new Set(["approved", "done", "rejected", "cancelled"]);

export default function PenjokiHistoryPage() {
  return (
    <ActionResourcePage
      title="History Job"
      endpoint="/api/joki/my-jobs"
      dataKey="jobs"
      transformRows={(rows) => rows.filter((row) => doneStatuses.has(String(row.status || "").toLowerCase()))}
      columns={[
        { label: "Job", keys: ["id", "order_id", "orderId"] },
        { label: "Status", keys: ["status"] },
        { label: "Completed", keys: ["completed_at", "completedAt", "updated_at", "updatedAt"] },
        { label: "Proof", keys: ["proof_url", "proofUrl"] },
      ]}
    />
  );
}
