import { BriefcaseBusiness, Gauge, History, Rows3 } from "lucide-react";
import DashboardShell from "./DashboardShell.jsx";

const navItems = [
  { to: "/penjoki/dashboard", label: "Overview", icon: Gauge },
  { to: "/penjoki/my-jobs", label: "My Jobs", icon: BriefcaseBusiness },
  { to: "/penjoki/queue", label: "Queue", icon: Rows3 },
  { to: "/penjoki/history", label: "History", icon: History },
];

export default function PenjokiLayout() {
  return <DashboardShell title="Penjoki Dashboard" navItems={navItems} />;
}
