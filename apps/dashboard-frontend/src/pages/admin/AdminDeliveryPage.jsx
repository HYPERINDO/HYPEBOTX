import ResourcePage from "../../components/dashboard/ResourcePage.jsx";

export default function AdminDeliveryPage() {
  return <ResourcePage title="Delivery Panel" endpoint="/api/orders" dataKey="orders" columns={[
    { label: "Order", keys: ["order_code", "orderCode", "id"] },
    { label: "Product", keys: ["product_id", "productId", "package_name"] },
    { label: "Status", keys: ["status"] },
    { label: "Payment", keys: ["payment_status", "paymentStatus"] },
  ]} />;
}
