import { createBrowserRouter, Navigate } from "react-router-dom";
import ProtectedRoute from "../components/ProtectedRoute.jsx";
import AdminLayout from "../layouts/AdminLayout.jsx";
import OwnerLayout from "../layouts/OwnerLayout.jsx";
import PenjokiLayout from "../layouts/PenjokiLayout.jsx";
import LoginPage from "../pages/LoginPage.jsx";
import UnauthorizedPage from "../pages/UnauthorizedPage.jsx";
import AdminDashboardPage from "../pages/admin/AdminDashboardPage.jsx";
import AdminDeliveryPage from "../pages/admin/AdminDeliveryPage.jsx";
import AdminJokiQueuePage from "../pages/admin/AdminJokiQueuePage.jsx";
import AdminCustomersPage from "../pages/admin/AdminCustomersPage.jsx";
import AdminOrdersPage from "../pages/admin/AdminOrdersPage.jsx";
import AdminPaymentsPage from "../pages/admin/AdminPaymentsPage.jsx";
import AdminTicketsPage from "../pages/admin/AdminTicketsPage.jsx";
import AdminLogsPage from "../pages/admin/AdminLogsPage.jsx";
import OwnerAuditLogPage from "../pages/owner/OwnerAuditLogPage.jsx";
import OwnerDashboardPage from "../pages/owner/OwnerDashboardPage.jsx";
import OwnerOrdersPage from "../pages/owner/OwnerOrdersPage.jsx";
import OwnerPaymentsPage from "../pages/owner/OwnerPaymentsPage.jsx";
import OwnerSettingsPage from "../pages/owner/OwnerSettingsPage.jsx";
import OwnerStaffPage from "../pages/owner/OwnerStaffPage.jsx";
import OwnerStockPage from "../pages/owner/OwnerStockPage.jsx";
import PenjokiDashboardPage from "../pages/penjoki/PenjokiDashboardPage.jsx";
import PenjokiHistoryPage from "../pages/penjoki/PenjokiHistoryPage.jsx";
import PenjokiMyJobsPage from "../pages/penjoki/PenjokiMyJobsPage.jsx";
import PenjokiQueuePage from "../pages/penjoki/PenjokiQueuePage.jsx";

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/login" replace /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/unauthorized", element: <UnauthorizedPage /> },
  {
    path: "/owner",
    element: (
      <ProtectedRoute roles={["owner"]}>
        <OwnerLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/owner/dashboard" replace /> },
      { path: "dashboard", element: <OwnerDashboardPage /> },
      { path: "orders", element: <OwnerOrdersPage /> },
      { path: "payments", element: <OwnerPaymentsPage /> },
      { path: "staff", element: <OwnerStaffPage /> },
      { path: "stock", element: <OwnerStockPage /> },
      { path: "audit-logs", element: <OwnerAuditLogPage /> },
      { path: "settings", element: <OwnerSettingsPage /> },
    ],
  },
  {
    path: "/admin",
    element: (
      <ProtectedRoute roles={["owner", "admin"]}>
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/admin/dashboard" replace /> },
      { path: "dashboard", element: <AdminDashboardPage /> },
      { path: "orders", element: <AdminOrdersPage /> },
      { path: "payments", element: <AdminPaymentsPage /> },
      { path: "tickets", element: <AdminTicketsPage /> },
      { path: "joki-queue", element: <AdminJokiQueuePage /> },
      { path: "delivery", element: <AdminDeliveryPage /> },
      { path: "customers", element: <AdminCustomersPage /> },
      { path: "logs", element: <AdminLogsPage /> },
    ],
  },
  {
    path: "/penjoki",
    element: (
      <ProtectedRoute roles={["owner", "admin", "penjoki"]}>
        <PenjokiLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/penjoki/dashboard" replace /> },
      { path: "dashboard", element: <PenjokiDashboardPage /> },
      { path: "my-jobs", element: <PenjokiMyJobsPage /> },
      { path: "queue", element: <PenjokiQueuePage /> },
      { path: "history", element: <PenjokiHistoryPage /> },
    ],
  },
  { path: "/orders", element: <Navigate to="/admin/orders" replace /> },
  { path: "/payments", element: <Navigate to="/admin/payments" replace /> },
  { path: "/tickets", element: <Navigate to="/admin/tickets" replace /> },
  { path: "/joki", element: <Navigate to="/penjoki/queue" replace /> },
  { path: "/stock", element: <Navigate to="/owner/stock" replace /> },
  { path: "/staff", element: <Navigate to="/owner/staff" replace /> },
  { path: "/customers", element: <Navigate to="/admin/customers" replace /> },
  { path: "/logs", element: <Navigate to="/admin/logs" replace /> },
  { path: "/settings", element: <Navigate to="/owner/settings" replace /> },
  { path: "*", element: <Navigate to="/login" replace /> },
]);
