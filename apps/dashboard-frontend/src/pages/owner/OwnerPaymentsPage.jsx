import ActionResourcePage from "../../components/dashboard/ActionResourcePage.jsx";
import { paymentService } from "../../services/paymentService.js";

function paymentId(row) {
  return row.id || row.invoice_code || row.invoiceCode;
}

export default function OwnerPaymentsPage() {
  return (
    <ActionResourcePage
      title="Payment Control"
      endpoint="/api/payments"
      dataKey="payments"
      columns={[
        { label: "Invoice", keys: ["invoice_code", "invoiceCode", "id"] },
        { label: "Order", keys: ["order_id", "orderId"] },
        { label: "Method", keys: ["method"] },
        { label: "Amount", keys: ["amount"] },
        { label: "Status", keys: ["status"] },
        { label: "Reason", keys: ["reject_reason", "rejectReason"] },
      ]}
      actions={[
        { label: "Approve", run: (row) => paymentService.approve(paymentId(row)) },
        {
          label: "Reject",
          tone: "danger",
          run: (row) => {
            const reason = window.prompt("Alasan reject payment:", row.reject_reason || "");
            return reason !== null ? paymentService.reject(paymentId(row), reason) : Promise.resolve();
          },
        },
        { label: "Sync", run: (row) => paymentService.sync(paymentId(row)) },
      ]}
    />
  );
}
