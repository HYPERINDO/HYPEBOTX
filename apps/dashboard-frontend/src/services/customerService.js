import { apiClient } from "./apiClient.js";

export const customerService = {
  note: (id, note) => apiClient.post(`/api/customers/${id}/note`, { note }),
  blacklistRequest: (id, reason) => apiClient.post(`/api/customers/${id}/blacklist-request`, { reason }),
};
