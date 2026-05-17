import { apiClient } from "./apiClient.js";

export const jokiService = {
  queue: () => apiClient.get("/api/joki/queue").then((response) => response.data.queue || []),
  myJobs: () => apiClient.get("/api/joki/my-jobs").then((response) => response.data.jobs || []),
  claim: (id) => apiClient.post(`/api/joki/jobs/${id}/claim`),
  progress: (id, payload) => apiClient.post(`/api/joki/jobs/${id}/progress`, payload),
  submitDone: (id, proofUrl) => apiClient.post(`/api/joki/jobs/${id}/submit-done`, { proofUrl }),
  approve: (id) => apiClient.post(`/api/joki/jobs/${id}/approve`),
  reject: (id, reason) => apiClient.post(`/api/joki/jobs/${id}/reject`, { reason }),
  reassign: (id, jokiId) => apiClient.post(`/api/joki/jobs/${id}/reassign`, { jokiId }),
};
