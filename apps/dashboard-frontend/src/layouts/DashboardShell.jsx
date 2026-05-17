import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import Sidebar from "../components/Sidebar.jsx";

export default function DashboardShell({ title, navItems }) {
  return (
    <div className="dashboard-shell">
      <Sidebar items={navItems} />
      <section className="workspace">
        <Navbar title={title} />
        <Outlet />
      </section>
    </div>
  );
}
