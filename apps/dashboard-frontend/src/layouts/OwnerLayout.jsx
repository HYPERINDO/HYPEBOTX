import { Boxes, ClipboardList, CreditCard, FileText, Gauge, ScrollText, Settings, ShieldCheck, Users } from "lucide-react";
import DashboardShell from "./DashboardShell.jsx";

const navItems = [
  { to: "/owner/dashboard", label: "Overview", icon: Gauge },
  { to: "/owner/orders", label: "Orders", icon: ClipboardList },
  { to: "/owner/payments", label: "Payments", icon: CreditCard },
  { to: "/owner/staff", label: "Staff", icon: Users },
  { to: "/owner/stock", label: "Stock", icon: Boxes },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/owner/audit-logs", label: "Audit", icon: ScrollText },
  { to: "/admin/logs", label: "Logs", icon: FileText },
  { to: "/owner/settings", label: "Settings", icon: Settings },
];

export default function OwnerLayout() {
  return <DashboardShell title="Owner Dashboard" navItems={navItems} icon={ShieldCheck} />;
}
