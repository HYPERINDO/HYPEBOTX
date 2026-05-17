import crypto from "node:crypto";
import axios from "axios";
import { discordConfig } from "../config/discord.js";

export const discordOAuthService = {
  createState() {
    return crypto.randomBytes(24).toString("hex");
  },
  getAuthorizeUrl(state) {
    const url = new URL(discordConfig.authorizeUrl);
    url.searchParams.set("client_id", discordConfig.clientId);
    url.searchParams.set("redirect_uri", discordConfig.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", discordConfig.scopes.join(" "));
    url.searchParams.set("state", state);
    return url.toString();
  },
  async exchangeCode(code) {
    if (!discordConfig.clientId || !discordConfig.clientSecret) {
      throw new Error("Discord OAuth belum dikonfigurasi.");
    }

    const body = new URLSearchParams({
      client_id: discordConfig.clientId,
      client_secret: discordConfig.clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: discordConfig.redirectUri,
    });

    try {
      const response = await axios.post(`${discordConfig.apiBaseUrl}/oauth2/token`, body, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      return response.data;
    } catch (error) {
      const details = error?.response?.data || error?.message || String(error);
      throw new Error(`Discord token exchange failed: ${JSON.stringify(details)}`);
    }
  },
  async fetchUser(accessToken) {
    const response = await axios.get(`${discordConfig.apiBaseUrl}/users/@me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.data;
  },
};
