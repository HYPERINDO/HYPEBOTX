import { apiClient } from "./apiClient.js";

export const paymentService = {
  list: () => apiClient.get("/api/payments").then((response) => response.data.payments || []),
  approve: (id) => apiClient.post(`/api/payments/${id}/approve`),
  reject: (id, reason) => apiClient.post(`/api/payments/${id}/reject`, { reason }),
  sync: (id) => apiClient.post(`/api/payments/${id}/sync`),
};
