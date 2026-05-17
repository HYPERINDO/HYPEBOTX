import { apiClient } from "./apiClient.js";

export const ticketService = {
  list: () => apiClient.get("/api/tickets").then((response) => response.data.tickets || []),
  claim: (id) => apiClient.post(`/api/tickets/${id}/claim`),
  close: (id) => apiClient.post(`/api/tickets/${id}/close`),
  reopen: (id) => apiClient.post(`/api/tickets/${id}/reopen`),
  note: (id, note) => apiClient.post(`/api/tickets/${id}/note`, { note }),
};
