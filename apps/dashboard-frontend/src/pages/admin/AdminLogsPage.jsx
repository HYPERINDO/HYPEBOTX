import { useState } from "react";
import ActionResourcePage from "../../components/dashboard/ActionResourcePage.jsx";

const logTypes = ["order", "payment", "ticket", "error"];

export default function AdminLogsPage() {
  const [type, setType] = useState("order");

  return (
    <main className="split-stack">
      <section className="content-panel">
        <div className="panel-heading">
          <h2>System Logs</h2>
          <select value={type} onChange={(event) => setType(event.target.value)}>
            {logTypes.map((logType) => <option key={logType} value={logType}>{logType}</option>)}
          </select>
        </div>
      </section>
      <ActionResourcePage
        title={`${type.toUpperCase()} Log`}
        endpoint={`/api/logs/${type}`}
        dataKey="logs"
        columns={[
          { label: "Time", keys: ["created_at", "createdAt", "timestamp", "time"] },
          { label: "Level", keys: ["level", "type", "status"] },
          { label: "Message", keys: ["message", "action", "event"] },
          { label: "Meta", keys: ["target_id", "order_id", "payment_id", "ticket_id"] },
        ]}
      />
    </main>
  );
}
