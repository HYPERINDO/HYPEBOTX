import { env } from "./env.js";

export const corsOptions = {
  origin: env.frontendUrl,
  credentials: true,
};
