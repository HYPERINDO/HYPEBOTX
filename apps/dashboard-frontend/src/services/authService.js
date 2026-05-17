import { API_BASE_URL, apiClient } from "./apiClient.js";

export const authService = {
  loginWithDiscord() {
    window.location.href = `${API_BASE_URL}/api/auth/discord`;
  },
  async me() {
    const response = await apiClient.get("/api/auth/me");
    return response.data.user;
  },
  async logout() {
    await apiClient.post("/api/auth/logout");
  },
};
