import ActionResourcePage from "../../components/dashboard/ActionResourcePage.jsx";
import { ticketService } from "../../services/ticketService.js";

export default function AdminTicketsPage() {
  return (
    <ActionResourcePage
      title="Ticket Control"
      endpoint="/api/tickets"
      dataKey="tickets"
      columns={[
        { label: "Ticket", keys: ["id", "discord_channel_id", "channelId"] },
        { label: "Order", keys: ["order_id", "orderId"] },
        { label: "Status", keys: ["status"] },
        { label: "Claimed", keys: ["claimed_by", "claimedBy"] },
        { label: "Closed", keys: ["closed_at", "closedAt"] },
      ]}
      actions={[
        { label: "Claim", run: (row) => ticketService.claim(row.id) },
        {
          label: "Note",
          run: (row) => {
            const note = window.prompt("Catatan ticket:");
            return note ? ticketService.note(row.id, note) : Promise.resolve();
          },
        },
        { label: "Close", tone: "danger", run: (row) => ticketService.close(row.id), visible: (row) => row.status !== "closed" },
        { label: "Reopen", run: (row) => ticketService.reopen(row.id), visible: (row) => row.status === "closed" },
      ]}
    />
  );
}
