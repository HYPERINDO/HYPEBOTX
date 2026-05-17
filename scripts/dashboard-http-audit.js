const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");

const repoRoot = path.resolve(__dirname, "..");

for (const file of [".env.local", ".env"]) {
  const envPath = path.join(repoRoot, file);
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
    break;
  }
}

const backendUrl = String(process.env.BACKEND_URL || "http://localhost:4000").replace(/\/+$/, "");
const frontendUrl = String(process.env.FRONTEND_URL || process.env.DASHBOARD_PUBLIC_URL || "http://localhost:5173").replace(/\/+$/, "");
const expectedRedirectUri = process.env.DISCORD_REDIRECT_URI || process.env.DASHBOARD_DISCORD_REDIRECT_URI || `${backendUrl}/api/auth/discord/callback`;
const results = [];

function add(area, name, status, detail = "") {
  results.push({ area, name, status, detail });
}

function hasCookieFlag(setCookie, flag) {
  return setCookie.some((cookie) => cookie.toLowerCase().includes(flag.toLowerCase()));
}

async function main() {
  const health = await fetch(`${backendUrl}/api/health`);
  add("backend", "health", health.ok ? "PASS" : "FAIL", `${health.status}`);
  add("security", "helmet x-frame-options", health.headers.has("x-frame-options") ? "PASS" : "FAIL", health.headers.get("x-frame-options") || "missing");
  add("security", "helmet x-content-type-options", health.headers.get("x-content-type-options") === "nosniff" ? "PASS" : "FAIL", health.headers.get("x-content-type-options") || "missing");
  add("security", "helmet content-security-policy", health.headers.has("content-security-policy") ? "PASS" : "WARN", health.headers.has("content-security-policy") ? "present" : "missing");

  const me = await fetch(`${backendUrl}/api/auth/me`, { headers: { Origin: frontendUrl } });
  add("auth", "/api/auth/me requires login", me.status === 401 ? "PASS" : "FAIL", `${me.status}`);
  add("cors", "allowed origin header", me.headers.get("access-control-allow-origin") === frontendUrl ? "PASS" : "FAIL", me.headers.get("access-control-allow-origin") || "missing");

  const evilOrigin = "https://evil.example";
  const evil = await fetch(`${backendUrl}/api/auth/me`, { headers: { Origin: evilOrigin } });
  add("cors", "evil origin not allowed", evil.headers.get("access-control-allow-origin") !== evilOrigin ? "PASS" : "FAIL", evil.headers.get("access-control-allow-origin") || "missing");

  const login = await fetch(`${backendUrl}/api/auth/discord`, { redirect: "manual", headers: { Origin: frontendUrl } });
  const location = login.headers.get("location") || "";
  const setCookie = login.headers.getSetCookie ? login.headers.getSetCookie() : String(login.headers.get("set-cookie") || "").split(/,(?=\s*hypebotx\.sid=)/);
  add("oauth", "login redirects to Discord", login.status >= 300 && login.status < 400 && location.includes("discord.com/oauth2/authorize") ? "PASS" : "FAIL", `${login.status}`);

  if (location) {
    const url = new URL(location);
    const redirectUri = url.searchParams.get("redirect_uri");
    add("oauth", "redirect_uri matches env", redirectUri === expectedRedirectUri ? "PASS" : "FAIL", redirectUri || "missing");
    add("oauth", "state exists", url.searchParams.has("state") ? "PASS" : "FAIL", url.searchParams.has("state") ? "present" : "missing");
    add("oauth", "scope identify", (url.searchParams.get("scope") || "").includes("identify") ? "PASS" : "FAIL", url.searchParams.get("scope") || "missing");
  }

  add("cookie", "httpOnly", hasCookieFlag(setCookie, "HttpOnly") ? "PASS" : "FAIL", "dashboard session cookie");
  add("cookie", "SameSite", hasCookieFlag(setCookie, "SameSite=Lax") || hasCookieFlag(setCookie, "SameSite=Strict") ? "PASS" : "FAIL", setCookie.join("; ").replace(/hypebotx\.sid=[^;]+/g, "hypebotx.sid=[masked]"));
  const secureExpected = backendUrl.startsWith("https://") || String(process.env.DASHBOARD_COOKIE_SECURE || "").toLowerCase() === "true";
  add("cookie", "Secure when HTTPS/production-like", secureExpected ? (hasCookieFlag(setCookie, "Secure") ? "PASS" : "FAIL") : "WARN", secureExpected ? "expected Secure" : "local HTTP run, Secure not expected");

  const invalidCallback = await fetch(`${backendUrl}/api/auth/discord/callback?code=fake&state=fake`, { redirect: "manual" });
  const invalidText = await invalidCallback.text();
  add("oauth", "invalid callback fails safely", invalidCallback.status >= 300 && invalidCallback.status < 400 ? "PASS" : "FAIL", `${invalidCallback.status}`);
  add("security", "invalid callback no stack trace", /stack|trace|client_secret|token/i.test(invalidText) ? "FAIL" : "PASS", "response body checked");

  const logout = await fetch(`${backendUrl}/api/auth/logout`, { method: "POST", headers: { Origin: frontendUrl } });
  add("auth", "logout idempotent", logout.ok ? "PASS" : "FAIL", `${logout.status}`);

  const frontend = await fetch(frontendUrl);
  add("frontend", "dashboard reachable", frontend.ok ? "PASS" : "FAIL", `${frontend.status}`);

  printAndExit(results.some((row) => row.status === "FAIL") ? 1 : 0);
}

function printAndExit(code) {
  const counts = results.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {});
  const report = { generatedAt: new Date().toISOString(), backendUrl, frontendUrl, expectedRedirectUri, counts, results };
  const reportDir = path.join(repoRoot, "logs", "qa");
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `dashboard-http-audit-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.table(results);
  console.log(`Report: ${reportPath}`);
  process.exitCode = code;
}

main().catch((error) => {
  add("runtime", "dashboard HTTP audit", "FAIL", error.message);
  printAndExit(1);
});
