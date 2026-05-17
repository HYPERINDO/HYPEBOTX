import { ORDER_STATUS_VALUES } from "@hypebotx/shared";
import ActionResourcePage from "../../components/dashboard/ActionResourcePage.jsx";
import { orderService } from "../../services/orderService.js";

function orderId(row) {
  return row.id || row.order_code || row.orderCode;
}

export default function OwnerOrdersPage() {
  return (
    <ActionResourcePage
      title="Order Control"
      endpoint="/api/orders"
      dataKey="orders"
      columns={[
        { label: "Order", keys: ["order_code", "orderCode", "id"] },
        { label: "Customer", keys: ["customer_discord_id", "userId", "customerId"] },
        { label: "Service", keys: ["service_type", "serviceType", "category"] },
        { label: "Status", keys: ["status"] },
        { label: "Payment", keys: ["payment_status", "paymentStatus"] },
        { label: "Admin", keys: ["assigned_admin_id", "assignedAdminId"] },
        { label: "Joki", keys: ["assigned_joki_id", "assignedJokiId"] },
      ]}
      actions={[
        {
          label: "Status",
          run: (row) => {
            const status = window.prompt(`Status baru:\n${ORDER_STATUS_VALUES.join(", ")}`, row.status || "processing");
            return status ? orderService.updateStatus(orderId(row), status) : Promise.resolve();
          },
        },
        {
          label: "Admin",
          run: (row) => {
            const adminId = window.prompt("Discord ID admin:", row.assigned_admin_id || row.assignedAdminId || "");
            return adminId ? orderService.assignAdmin(orderId(row), adminId) : Promise.resolve();
          },
        },
        {
          label: "Joki",
          run: (row) => {
            const jokiId = window.prompt("Discord ID penjoki:", row.assigned_joki_id || row.assignedJokiId || "");
            return jokiId ? orderService.assignJoki(orderId(row), jokiId) : Promise.resolve();
          },
        },
        {
          label: "Note",
          run: (row) => {
            const note = window.prompt("Catatan order:", row.notes || "");
            return note ? orderService.note(orderId(row), note) : Promise.resolve();
          },
        },
        { label: "Cancel", tone: "danger", run: (row) => orderService.cancel(orderId(row)) },
        { label: "Refund", tone: "warning", run: (row) => orderService.refund(orderId(row)) },
      ]}
    />
  );
}
