import { apiClient } from "./apiClient.js";

export const ownerService = {
  botStatus: () => apiClient.get("/api/owner/bot-status").then((response) => response.data),
  botAction: (action) => apiClient.post(`/api/owner/bot/${action}`).then((response) => response.data),
  backup: () => apiClient.post("/api/owner/backup").then((response) => response.data),
  aiUsage: () => apiClient.get("/api/owner/ai-usage").then((response) => response.data),
};
