import { env } from "./env.js";

export const discordConfig = {
  apiBaseUrl: "https://discord.com/api/v10",
  authorizeUrl: "https://discord.com/oauth2/authorize",
  clientId: env.discordClientId,
  clientSecret: env.discordClientSecret,
  redirectUri: env.discordRedirectUri,
  scopes: ["identify"],
};
