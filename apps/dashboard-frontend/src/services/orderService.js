import { apiClient } from "./apiClient.js";

export const orderService = {
  list: () => apiClient.get("/api/orders").then((response) => response.data.orders || []),
  updateStatus: (id, status) => apiClient.patch(`/api/orders/${id}/status`, { status }),
  assignAdmin: (id, adminId) => apiClient.patch(`/api/orders/${id}/assign-admin`, { adminId }),
  assignJoki: (id, jokiId) => apiClient.patch(`/api/orders/${id}/assign-joki`, { jokiId }),
  note: (id, note) => apiClient.post(`/api/orders/${id}/note`, { note }),
  cancel: (id) => apiClient.post(`/api/orders/${id}/cancel`),
  refund: (id) => apiClient.post(`/api/orders/${id}/refund`),
};
