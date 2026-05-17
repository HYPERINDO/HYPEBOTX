import { apiClient } from "./apiClient.js";

export const staffService = {
  list: () => apiClient.get("/api/staff").then((response) => response.data.staff || []),
  create: (payload) => apiClient.post("/api/staff", payload),
  update: (id, payload) => apiClient.patch(`/api/staff/${id}`, payload),
  suspend: (id) => apiClient.post(`/api/staff/${id}/suspend`),
  activate: (id) => apiClient.post(`/api/staff/${id}/activate`),
  remove: (id) => apiClient.delete(`/api/staff/${id}`),
};
