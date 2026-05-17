import ActionResourcePage from "../../components/dashboard/ActionResourcePage.jsx";
import QuickCreateForm from "../../components/forms/QuickCreateForm.jsx";
import { staffService } from "../../services/staffService.js";

function staffId(row) {
  return row.id || row.discordId || row.discord_id || row.userId;
}

const roleOptions = [
  { value: "admin", label: "Admin" },
  { value: "penjoki", label: "Penjoki" },
  { value: "owner", label: "Owner" },
];

export default function OwnerStaffPage() {
  return (
    <ActionResourcePage
      title="Staff Manager"
      endpoint="/api/staff"
      dataKey="staff"
      columns={[
        { label: "Discord ID", keys: ["discordId", "discord_id", "userId"] },
        { label: "Username", keys: ["username"] },
        { label: "Role", keys: ["role"] },
        { label: "Status", keys: ["status"] },
      ]}
      toolbar={({ reload, setError }) => (
        <QuickCreateForm
          submitLabel="Tambah Staff"
          fields={[
            { name: "discordId", label: "Discord ID", required: true },
            { name: "username", label: "Username" },
            { name: "role", label: "Role", type: "select", options: roleOptions, defaultValue: "admin", required: true },
          ]}
          onSubmit={async (values) => {
            try {
              await staffService.create(values);
              await reload();
            } catch (error) {
              setError(error);
            }
          }}
        />
      )}
      actions={[
        {
          label: "Role",
          run: (row) => {
            const role = window.prompt("Role baru: owner, admin, penjoki", row.role || "admin");
            return role ? staffService.update(staffId(row), { role }) : Promise.resolve();
          },
        },
        { label: "Suspend", tone: "warning", run: (row) => staffService.suspend(staffId(row)), visible: (row) => row.status !== "suspended" },
        { label: "Activate", run: (row) => staffService.activate(staffId(row)), visible: (row) => row.status !== "active" },
        { label: "Remove", tone: "danger", run: (row) => staffService.remove(staffId(row)) },
      ]}
    />
  );
}
