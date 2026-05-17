import ResourcePage from "../../components/dashboard/ResourcePage.jsx";

export default function OwnerAuditLogPage() {
  return <ResourcePage title="Audit Log" endpoint="/api/audit-logs" dataKey="auditLogs" columns={[
    { label: "Action", keys: ["action"] },
    { label: "Actor", keys: ["actor_username", "actor_role", "actor_id"] },
    { label: "Target", keys: ["target_type", "target_id"] },
    { label: "Time", keys: ["created_at", "createdAt"] },
  ]} />;
}
