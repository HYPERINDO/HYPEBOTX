import ActionResourcePage from "../../components/dashboard/ActionResourcePage.jsx";
import { customerService } from "../../services/customerService.js";

function customerId(row) {
  return row.id || row.discordId || row.discord_id || row.userId;
}

export default function AdminCustomersPage() {
  return (
    <ActionResourcePage
      title="Customer CRM"
      endpoint="/api/customers"
      dataKey="customers"
      columns={[
        { label: "Customer", keys: ["discordId", "discord_id", "userId", "id"] },
        { label: "Username", keys: ["username", "displayName"] },
        { label: "Orders", keys: ["orders_count", "ordersCount", "totalOrders"] },
        { label: "Spent", keys: ["total_spent", "totalSpent"] },
        { label: "Status", keys: ["status"] },
        { label: "Notes", keys: ["notes", "internal_note"] },
      ]}
      actions={[
        {
          label: "Note",
          run: (row) => {
            const note = window.prompt("Catatan customer:", row.notes || "");
            return note ? customerService.note(customerId(row), note) : Promise.resolve();
          },
        },
        {
          label: "Blacklist",
          tone: "danger",
          run: (row) => {
            const reason = window.prompt("Alasan request blacklist:");
            return reason ? customerService.blacklistRequest(customerId(row), reason) : Promise.resolve();
          },
        },
      ]}
    />
  );
}
