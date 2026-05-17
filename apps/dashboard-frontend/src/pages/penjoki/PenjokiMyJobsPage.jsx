import { JOKI_STATUS_VALUES } from "@hypebotx/shared";
import ActionResourcePage from "../../components/dashboard/ActionResourcePage.jsx";
import { jokiService } from "../../services/jokiService.js";

export default function PenjokiMyJobsPage() {
  return (
    <ActionResourcePage
      title="My Jobs"
      endpoint="/api/joki/my-jobs"
      dataKey="jobs"
      columns={[
        { label: "Job", keys: ["id", "order_id", "orderId"] },
        { label: "Package", keys: ["package_name", "packageName", "orderLabel"] },
        { label: "Status", keys: ["status"] },
        { label: "Progress", keys: ["progress", "progress_note"] },
        { label: "Proof", keys: ["proof_url", "proofUrl"] },
      ]}
      actions={[
        {
          label: "Progress",
          run: (row) => {
            const status = window.prompt(`Status:\n${JOKI_STATUS_VALUES.join(", ")}`, row.status || "on_progress");
            if (!status) return Promise.resolve();
            const note = window.prompt("Catatan progress:", row.progress_note || "");
            return jokiService.progress(row.id, { status, note });
          },
        },
        {
          label: "Submit",
          run: (row) => {
            const proofUrl = window.prompt("URL bukti selesai:", row.proof_url || row.proofUrl || "");
            return proofUrl !== null ? jokiService.submitDone(row.id, proofUrl) : Promise.resolve();
          },
        },
      ]}
    />
  );
}
