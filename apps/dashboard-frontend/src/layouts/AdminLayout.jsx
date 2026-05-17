import { ClipboardList, CreditCard, FileText, Gauge, Headphones, PackageCheck, Rows3, Users } from "lucide-react";
import DashboardShell from "./DashboardShell.jsx";

const navItems = [
  { to: "/admin/dashboard", label: "Overview", icon: Gauge },
  { to: "/admin/orders", label: "Orders", icon: ClipboardList },
  { to: "/admin/payments", label: "Payments", icon: CreditCard },
  { to: "/admin/tickets", label: "Tickets", icon: Headphones },
  { to: "/admin/joki-queue", label: "Joki Queue", icon: Rows3 },
  { to: "/admin/delivery", label: "Delivery", icon: PackageCheck },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/logs", label: "Logs", icon: FileText },
];

export default function AdminLayout() {
  return <DashboardShell title="Admin Dashboard" navItems={navItems} />;
}
