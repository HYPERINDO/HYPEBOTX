import { apiClient } from "./apiClient.js";

export const stockService = {
  list: () => apiClient.get("/api/stock").then((response) => response.data.stock || []),
  products: () => apiClient.get("/api/products").then((response) => response.data.products || []),
  createProduct: (payload) => apiClient.post("/api/products", payload),
  updateProduct: (id, payload) => apiClient.patch(`/api/products/${id}`, payload),
  deleteProduct: (id) => apiClient.delete(`/api/products/${id}`),
  createStock: (payload) => apiClient.post("/api/stock", payload),
  updateStock: (id, payload) => apiClient.patch(`/api/stock/${id}`, payload),
  reserve: (id, orderId) => apiClient.post(`/api/stock/${id}/reserve`, { orderId }),
  markSold: (id) => apiClient.post(`/api/stock/${id}/mark-sold`),
  deleteStock: (id) => apiClient.delete(`/api/stock/${id}`),
};
