import ActionResourcePage from "../../components/dashboard/ActionResourcePage.jsx";
import QuickCreateForm from "../../components/forms/QuickCreateForm.jsx";
import { stockService } from "../../services/stockService.js";

const stockStatusOptions = [
  { value: "available", label: "Available" },
  { value: "reserved", label: "Reserved" },
  { value: "sold", label: "Sold" },
  { value: "disabled", label: "Disabled" },
];

function productId(row) {
  return row.id || row.product_id || row.productId;
}

export default function OwnerStockPage() {
  return (
    <main className="split-stack">
      <ActionResourcePage
        title="Product Catalog"
        endpoint="/api/products"
        dataKey="products"
        columns={[
          { label: "Product", keys: ["id", "product_id", "productId"] },
          { label: "Name", keys: ["name", "title", "label"] },
          { label: "Price", keys: ["price", "amount"] },
          { label: "Active", keys: ["is_active", "isActive"] },
        ]}
        toolbar={({ reload, setError }) => (
          <QuickCreateForm
            submitLabel="Tambah Produk"
            fields={[
              { name: "name", label: "Nama", required: true },
              { name: "price", label: "Harga", type: "number", required: true },
            ]}
            onSubmit={async (values) => {
              try {
                await stockService.createProduct({ ...values, price: Number(values.price || 0), is_active: true, isActive: true });
                await reload();
              } catch (error) {
                setError(error);
              }
            }}
          />
        )}
        actions={[
          {
            label: "Edit",
            run: (row) => {
              const name = window.prompt("Nama produk:", row.name || row.title || "");
              if (name === null) return Promise.resolve();
              const price = window.prompt("Harga:", row.price || "");
              return price !== null ? stockService.updateProduct(productId(row), { name, price: Number(price || 0) }) : Promise.resolve();
            },
          },
          { label: "Disable", tone: "danger", run: (row) => stockService.deleteProduct(productId(row)) },
        ]}
      />

      <ActionResourcePage
        title="Stock Units"
        endpoint="/api/stock"
        dataKey="stock"
        columns={[
          { label: "Stock", keys: ["id"] },
          { label: "Product", keys: ["product_id", "productId", "itemId"] },
          { label: "Status", keys: ["status"] },
          { label: "Secret", keys: ["hasSecretContent"] },
          { label: "Reserved", keys: ["reserved_by_order_id", "reservedByOrderId"] },
        ]}
        toolbar={({ reload, setError }) => (
          <QuickCreateForm
            submitLabel="Tambah Stock"
            fields={[
              { name: "product_id", label: "Product ID", required: true },
              { name: "label", label: "Label" },
              { name: "status", label: "Status", type: "select", options: stockStatusOptions, defaultValue: "available", required: true },
            ]}
            onSubmit={async (values) => {
              try {
                await stockService.createStock(values);
                await reload();
              } catch (error) {
                setError(error);
              }
            }}
          />
        )}
        actions={[
          {
            label: "Status",
            run: (row) => {
              const status = window.prompt("Status: available, reserved, sold, disabled", row.status || "available");
              return status ? stockService.updateStock(row.id, { status }) : Promise.resolve();
            },
          },
          {
            label: "Reserve",
            run: (row) => {
              const orderId = window.prompt("Order ID untuk reserve:", row.reserved_by_order_id || row.reservedByOrderId || "");
              return orderId ? stockService.reserve(row.id, orderId) : Promise.resolve();
            },
          },
          { label: "Sold", run: (row) => stockService.markSold(row.id) },
          { label: "Disable", tone: "danger", run: (row) => stockService.deleteStock(row.id) },
        ]}
      />
    </main>
  );
}
