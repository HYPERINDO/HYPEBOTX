import { env } from "./env.js";

export const sessionOptions = {
  name: "hypebotx.sid",
  secret: env.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: "lax",
    maxAge: env.sessionTtlMs,
  },
};
