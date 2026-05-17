const crypto = require("crypto");
const express = require("express");
const { hasAdminPermission, hasJokiCrewAccess, hasNamedRole, isOwnerOrStaff } = require("../utils/permissionCheck");
const roleNames = require("../config/roles");
const { isPaymentTerminal } = require("../utils/paymentStatus");

const DISCORD_API = "https://discord.com/api/v10";
const DEFAULT_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function parseCookie(header = "") {
  return String(header || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const index = part.indexOf("=");
      if (index <= 0) return acc;
      acc[decodeURIComponent(part.slice(0, index))] = decodeURIComponent(part.slice(index + 1));
      return acc;
    }, {});
}

function sendJson(res, status, payload) {
  res.status(status).type("application/json; charset=utf-8").send(JSON.stringify(payload, null, 2));
}

function formatCurrency(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function parseAmount(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const normalized = String(value || "").replace(/[^\d]/g, "");
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nowIso() {
  return new Date().toISOString();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function createWebDashboardService({ botConfig, logger, repositories, services }) {
  const sessions = new Map();
  const oauthStates = new Map();
  let server = null;
  let dashboardUrl = null;
  let dashboardClient = null;
  const authHits = new Map();

  function getConfig() {
    const host = process.env.DASHBOARD_HOST || process.env.OWNER_DASHBOARD_HOST || "127.0.0.1";
    const port = Number(process.env.DASHBOARD_PORT || process.env.OWNER_DASHBOARD_PORT || 3001);
    const publicUrl = String(process.env.DASHBOARD_PUBLIC_URL || process.env.DASHBOARD_BASE_URL || `http://${host}:${port}`).replace(/\/+$/, "");
    return {
      enabled: ["1", "true", "yes", "on"].includes(String(process.env.DASHBOARD_ENABLED || "false").toLowerCase()),
      host,
      port,
      publicUrl,
      redirectUri: process.env.DASHBOARD_DISCORD_REDIRECT_URI || process.env.DISCORD_REDIRECT_URI || `${publicUrl}/api/auth/discord/callback`,
      clientId: process.env.DASHBOARD_DISCORD_CLIENT_ID || process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID || botConfig.clientId,
      clientSecret: process.env.DASHBOARD_DISCORD_CLIENT_SECRET || process.env.DISCORD_CLIENT_SECRET || "",
      guildId: process.env.DASHBOARD_GUILD_ID || process.env.GUILD_ID || botConfig.guildId,
      adminRoleId: process.env.ADMIN_ROLE_ID || process.env.DASHBOARD_ADMIN_ROLE_ID || "",
      penjokiRoleId: process.env.PENJOKI_ROLE_ID || process.env.DASHBOARD_PENJOKI_ROLE_ID || "",
      ownerDiscordIds: String(process.env.OWNER_DISCORD_IDS || "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
      cookieSecure: ["1", "true", "yes", "on"].includes(String(process.env.DASHBOARD_COOKIE_SECURE || "false").toLowerCase()),
      sessionTtlMs: Number(process.env.DASHBOARD_SESSION_TTL_MS || DEFAULT_SESSION_TTL_MS),
    };
  }

  function rateLimitAuth(req, res, next) {
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    const now = Date.now();
    const hit = authHits.get(ip) || { count: 0, resetAt: now + 60 * 1000 };
    if (hit.resetAt <= now) {
      hit.count = 0;
      hit.resetAt = now + 60 * 1000;
    }
    hit.count += 1;
    authHits.set(ip, hit);
    if (hit.count > 30) {
      res.status(429).send("Terlalu banyak request login. Coba lagi sebentar.");
      return;
    }
    next();
  }

  function pruneSessions() {
    const now = Date.now();
    for (const [token, session] of sessions.entries()) {
      if (!session || session.expiresAt <= now) sessions.delete(token);
    }
    for (const [state, entry] of oauthStates.entries()) {
      if (!entry || entry.expiresAt <= now) oauthStates.delete(state);
    }
  }

  function setSessionCookie(res, token) {
    const config = getConfig();
    const secure = config.cookieSecure ? "; Secure" : "";
    res.setHeader(
      "Set-Cookie",
      `hypebotx_dashboard=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(config.sessionTtlMs / 1000)}${secure}`,
    );
  }

  function clearSessionCookie(res) {
    res.setHeader("Set-Cookie", "hypebotx_dashboard=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
  }

  async function writeAuditLog({ session = null, action, targetType = "dashboard", targetId = "-", oldValue = null, newValue = null, ip = null }) {
    const payload = {
      guildId: session?.guildId || getConfig().guildId || null,
      actorId: session?.user?.id || null,
      actorUsername: session?.user?.globalName || session?.user?.username || null,
      actorRole: session?.role || null,
      action,
      targetType,
      targetId,
      oldValue: oldValue === null || oldValue === undefined ? null : JSON.stringify(oldValue).slice(0, 1000),
      newValue: newValue === null || newValue === undefined ? null : JSON.stringify(newValue).slice(0, 1000),
      ipAddress: ip || null,
      createdAt: new Date().toISOString(),
    };
    await repositories.opsRepository?.auditLogs?.create?.(payload).catch((error) => {
      logger?.warn?.("dashboard audit log failed", { action, message: error?.message || String(error) });
    });
    return payload;
  }

  async function fetchDiscordUser(code) {
    const config = getConfig();
    if (!config.clientId || !config.clientSecret) {
      throw new Error("Discord OAuth belum dikonfigurasi. Isi DASHBOARD_DISCORD_CLIENT_SECRET.");
    }

    const tokenResponse = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: config.redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const text = await tokenResponse.text().catch(() => "");
      throw new Error(`Discord token exchange gagal: ${tokenResponse.status} ${text.slice(0, 200)}`);
    }

    const token = await tokenResponse.json();
    const userResponse = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });

    if (!userResponse.ok) {
      throw new Error(`Discord user fetch gagal: ${userResponse.status}`);
    }

    return userResponse.json();
  }

  async function resolveMember(discordUserId) {
    const config = getConfig();
    const guild = config.guildId
      ? clientGuild(config.guildId)
      : null;
    if (!guild) return null;
    return guild.members.cache.get(discordUserId) ||
      await guild.members.fetch(discordUserId).catch(() => null);
  }

  function clientGuild(guildId) {
    return dashboardClient?.guilds?.cache?.get?.(guildId) || null;
  }

  function resolveDashboardRole(member) {
    if (!member) return "none";
    const config = getConfig();
    if (config.ownerDiscordIds.includes(String(member.id))) return "owner";
    const owner = Boolean(member.guild?.ownerId && member.id && member.guild.ownerId === member.id) ||
      hasNamedRole(member, roleNames.owner);
    if (owner) return "owner";
    if (config.adminRoleId && member.roles?.cache?.has?.(config.adminRoleId)) return "admin";
    if (config.penjokiRoleId && member.roles?.cache?.has?.(config.penjokiRoleId)) return "penjoki";
    if (hasAdminPermission(member) || isOwnerOrStaff(member)) return "admin";
    if (hasJokiCrewAccess(member)) return "penjoki";
    return "none";
  }

  async function resolveStaffProfile(guildId, user, memberRole) {
    const existing = await repositories.userRepository?.find?.(guildId, user.id).catch(() => null);
    const profileRole = String(existing?.dashboardRole || existing?.staffRole || existing?.role || "").toLowerCase();
    const status = String(existing?.status || "active").toLowerCase();
    if (["suspended", "inactive", "disabled"].includes(status)) {
      return { role: "none", status, existing };
    }
    if (["owner", "admin", "penjoki"].includes(profileRole)) {
      return { role: profileRole, status, existing };
    }
    return { role: memberRole, status, existing };
  }

  function canAccess(role, area) {
    if (role === "owner") return true;
    if (role === "admin") return !["owner", "security"].includes(area);
    if (role === "penjoki") return ["me", "overview", "joki"].includes(area);
    return area === "me";
  }

  async function createSession(user) {
    const member = await resolveMember(user.id);
    const config = getConfig();
    const memberRole = member
      ? resolveDashboardRole(member)
      : config.ownerDiscordIds.includes(String(user.id))
        ? "owner"
        : "none";
    const staffProfile = member?.guild?.id
      ? await resolveStaffProfile(member.guild.id, user, memberRole)
      : { role: memberRole, status: "active" };
    const role = staffProfile.role;
    if (role === "none") {
      await writeAuditLog({
        action: "LOGIN_FAILED",
        targetType: "auth",
        targetId: user.id,
        newValue: { username: user.username, reason: "unauthorized" },
      });
      throw new Error("Akun Discord kamu belum punya akses dashboard di server ini.");
    }

    const token = crypto.randomBytes(32).toString("base64url");
    sessions.set(token, {
      token,
      user: {
        id: user.id,
        username: user.username,
        globalName: user.global_name || user.username,
        avatar: user.avatar || null,
      },
      role,
      guildId: member?.guild?.id || config.guildId,
      loginAt: new Date().toISOString(),
      createdAt: Date.now(),
      expiresAt: Date.now() + config.sessionTtlMs,
    });
    await writeAuditLog({
      session: sessions.get(token),
      action: "LOGIN_SUCCESS",
      targetType: "auth",
      targetId: user.id,
      newValue: { role },
    });
    return token;
  }

  function requireSession(area = "overview") {
    return (req, res, next) => {
      pruneSessions();
      const token = parseCookie(req.headers.cookie).hypebotx_dashboard;
      const session = token ? sessions.get(token) : null;
      if (!session) {
        writeAuditLog({
          action: "UNAUTHORIZED_ACCESS",
          targetType: "route",
          targetId: req.path,
          ip: req.ip,
          newValue: { reason: "missing_session" },
        });
        return sendJson(res, 401, { ok: false, message: "Login required." });
      }
      if (!canAccess(session.role, area)) {
        writeAuditLog({
          session,
          action: "UNAUTHORIZED_ACCESS",
          targetType: "route",
          targetId: req.path,
          ip: req.ip,
          newValue: { reason: "forbidden", area },
        });
        return sendJson(res, 403, { ok: false, message: "Akses dashboard ditolak." });
      }
      req.dashboardSession = session;
      return next();
    };
  }

  function requirePageSession(area = "overview") {
    return (req, res, next) => {
      pruneSessions();
      const token = parseCookie(req.headers.cookie).hypebotx_dashboard;
      const session = token ? sessions.get(token) : null;
      if (!session) {
        return res.redirect("/login");
      }
      if (!canAccess(session.role, area)) {
        writeAuditLog({
          session,
          action: "UNAUTHORIZED_ACCESS",
          targetType: "route",
          targetId: req.path,
          ip: req.ip,
          newValue: { reason: "forbidden", area },
        });
        return res.redirect("/unauthorized");
      }
      req.dashboardSession = session;
      return next();
    };
  }

  function redirectForRole(role) {
    if (role === "owner") return "/owner/dashboard";
    if (role === "admin") return "/admin/dashboard";
    if (role === "penjoki") return "/penjoki/dashboard";
    return "/unauthorized";
  }

  async function getDashboardData(guildId) {
    const [
      tickets,
      orders,
      payments,
      queues,
      users,
      stockItems,
      stockUnits,
      coupons,
      auditLogs,
    ] = await Promise.all([
      Promise.resolve(repositories.ticketRepository?.getAllByGuildId?.(guildId) || []).catch(() => []),
      Promise.resolve(repositories.orderRepository?.getAllByGuildId?.(guildId) || []).catch(() => []),
      Promise.resolve(repositories.paymentRepository?.getAll?.() || []).catch(() => []),
      Promise.resolve(repositories.jokiRepository?.listQueues?.() || []).catch(() => []),
      Promise.resolve(repositories.userRepository?.getAll?.() || []).catch(() => []),
      Promise.resolve(repositories.stockRepository?.stockItems?.getAll?.(guildId) || []).catch(() => []),
      Promise.resolve(repositories.stockRepository?.stockUnits?.getAll?.(guildId) || []).catch(() => []),
      Promise.resolve(repositories.opsRepository?.coupons?.getAll?.() || []).catch(() => []),
      Promise.resolve(repositories.opsRepository?.auditLogs?.getAll?.() || []).catch(() => []),
    ]);

    const scopedPayments = payments.filter((row) => !row.guildId || row.guildId === guildId);
    const scopedUsers = users.filter((row) => !row.guildId || row.guildId === guildId);
    const scopedQueues = queues.filter((row) => !row.guildId || row.guildId === guildId);
    const scopedCoupons = coupons.filter((row) => !row.guildId || row.guildId === guildId);
    const scopedAuditLogs = auditLogs.filter((row) => !row.guildId || row.guildId === guildId);
    const revenue = scopedPayments
      .filter((row) => String(row.status || "").toLowerCase() === "paid")
      .reduce((sum, row) => sum + parseAmount(row.amount), 0);

    const activeJoki = scopedQueues.reduce(
      (sum, queue) => sum + (queue?.orders || []).filter((order) => ["queued", "processing", "hold"].includes(String(order.status || "").toLowerCase())).length,
      0,
    );

    return {
      overview: {
        ticketsOpen: tickets.filter((row) => !["closed", "completed"].includes(String(row.status || "").toLowerCase())).length,
        ordersTotal: orders.length,
        ordersPending: orders.filter((row) => ["pending", "waiting", "queued", "processing", "hold"].includes(String(row.status || "").toLowerCase())).length,
        paymentsPending: scopedPayments.filter((row) => !isPaymentTerminal(row.status)).length,
        revenue,
        revenueText: formatCurrency(revenue),
        activeJoki,
        stockAvailable: stockUnits.filter((row) => row.status === "available").length,
        customers: scopedUsers.length,
      },
      orders: orders
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
        .slice(0, 80),
      payments: scopedPayments
        .sort((a, b) => new Date(b.checkedAt || b.createdAt || 0) - new Date(a.checkedAt || a.createdAt || 0))
        .slice(0, 80),
      tickets: tickets
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
        .slice(0, 80),
      joki: scopedQueues.flatMap((queue) => (queue.orders || []).map((order) => ({ ...order, guildId: queue.guildId }))).slice(0, 80),
      stock: stockItems.map((item) => ({
        ...item,
        available: stockUnits.filter((unit) => unit.itemId === item.id && unit.status === "available").length,
        reserved: stockUnits.filter((unit) => unit.itemId === item.id && unit.status === "reserved").length,
        sold: stockUnits.filter((unit) => unit.itemId === item.id && unit.status === "sold").length,
      })).slice(0, 80),
      customers: scopedUsers
        .sort((a, b) => Number(b.totalOrder || 0) - Number(a.totalOrder || 0))
        .slice(0, 80),
      staff: scopedUsers
        .filter((row) => row.dashboardRole || row.staffRole || ["owner", "admin", "penjoki"].includes(String(row.role || "").toLowerCase()))
        .slice(0, 80),
      coupons: scopedCoupons.slice(0, 80),
      auditLogs: scopedAuditLogs
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 80),
      health: await services.backlogService?.getHealthSnapshot?.(dashboardClient).catch(() => null),
    };
  }

  async function listAuditLogs(guildId, limit = 100) {
    const rows = await repositories.opsRepository?.auditLogs?.getAll?.().catch(() => []) || [];
    return rows
      .filter((row) => !row.guildId || row.guildId === guildId)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, limit);
  }

  function renderLoginHtml({ loggedOut = false } = {}) {
    return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Login - HYPEBOTX Dashboard</title>
  <style>
    body { margin:0; min-height:100vh; display:grid; place-items:center; background:#090f1c; color:#eef4ff; font:14px/1.5 "Segoe UI", Arial, sans-serif; }
    .box { width:min(460px, calc(100vw - 32px)); border:1px solid #22314d; background:#111a2e; border-radius:10px; padding:28px; box-shadow:0 20px 70px rgba(0,0,0,.35); }
    .logo { font-weight:800; font-size:20px; margin-bottom:10px; }
    h1 { margin:0 0 8px; font-size:24px; }
    p { color:#9fb0ca; }
    a { display:inline-block; margin-top:10px; padding:11px 14px; border-radius:8px; background:#5865f2; color:white; text-decoration:none; font-weight:700; }
    footer { margin-top:22px; color:#71809a; font-size:12px; }
    .notice { color:#86efac; }
  </style>
</head>
<body>
  <div class="box">
    <div class="logo">HYPEBOTX</div>
    <h1>HYPEBOTX Dashboard</h1>
    ${loggedOut ? "<p class='notice'>Anda sudah logout. Silakan login kembali menggunakan akun Discord.</p>" : ""}
    <p>Masuk menggunakan akun Discord yang sudah terdaftar sebagai Owner, Admin, atau Penjoki.</p>
    <a href="/api/auth/discord">Login dengan Discord</a>
    <footer>Dashboard khusus staff HYPEBOTX.<br />&copy; HYPEBOTX</footer>
  </div>
</body>
</html>`;
  }

  function renderUnauthorizedHtml() {
    return `<!doctype html>
<html lang="id">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Akses Ditolak</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0f172a;color:#e5e7eb;font-family:Segoe UI,Arial,sans-serif">
  <main style="max-width:520px;padding:28px;border:1px solid #334155;border-radius:10px;background:#111827">
    <h1>AKSES DITOLAK</h1>
    <p>Akun Discord kamu belum terdaftar sebagai staff HYPEBOTX.</p>
    <p>Hubungi Owner jika kamu seharusnya memiliki akses dashboard.</p>
    <form method="post" action="/api/auth/logout" style="display:inline"><button style="padding:10px 12px">Logout</button></form>
    <a href="/api/auth/discord" style="color:#93c5fd;margin-left:12px">Login dengan akun Discord lain</a>
  </main>
</body>
</html>`;
  }

  function renderHtml() {
    return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>HYPEBOTX Dashboard</title>
  <style>
    :root { --bg:#f6f8fc; --panel:#ffffff; --ink:#152033; --muted:#637083; --line:#dce5f3; --blue:#2563eb; --green:#16a34a; --amber:#b7791f; --red:#dc2626; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font:14px/1.45 "Segoe UI", Arial, sans-serif; }
    header { height:64px; display:flex; align-items:center; justify-content:space-between; padding:0 22px; background:#101827; color:white; position:sticky; top:0; z-index:2; }
    header h1 { margin:0; font-size:18px; letter-spacing:0; }
    header .user { display:flex; gap:12px; align-items:center; }
    a, button { font:inherit; }
    button, .btn { border:1px solid var(--line); background:white; color:var(--ink); border-radius:7px; padding:8px 11px; cursor:pointer; text-decoration:none; }
    button.primary, .btn.primary { background:var(--blue); border-color:var(--blue); color:white; }
    button.danger { background:var(--red); border-color:var(--red); color:white; }
    .layout { display:grid; grid-template-columns:220px 1fr; min-height:calc(100vh - 64px); }
    nav { border-right:1px solid var(--line); background:white; padding:14px; }
    nav button { width:100%; text-align:left; margin-bottom:7px; }
    nav button.active { background:#e8f0ff; color:#174ea6; border-color:#b9cdfa; }
    main { padding:18px; overflow:auto; }
    .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin-bottom:16px; }
    .card, section { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:14px; }
    .card .label { color:var(--muted); font-size:12px; }
    .card .value { font-size:24px; font-weight:700; margin-top:4px; }
    .toolbar { display:flex; gap:8px; align-items:center; justify-content:space-between; margin:0 0 12px; }
    input, select { border:1px solid var(--line); border-radius:7px; padding:8px 10px; min-width:220px; }
    table { width:100%; border-collapse:collapse; background:white; }
    th, td { padding:9px 10px; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; }
    th { color:var(--muted); font-weight:600; font-size:12px; }
    .badge { display:inline-block; padding:2px 7px; border-radius:999px; background:#eef2ff; color:#3730a3; font-size:12px; }
    .login { min-height:100vh; display:grid; place-items:center; padding:20px; }
    .login .box { max-width:440px; background:white; border:1px solid var(--line); border-radius:8px; padding:24px; }
    .muted { color:var(--muted); }
    .hidden { display:none; }
    @media (max-width: 760px) { .layout { grid-template-columns:1fr; } nav { display:flex; overflow:auto; gap:7px; border-right:0; border-bottom:1px solid var(--line); } nav button { min-width:140px; } }
  </style>
</head>
<body>
  <div id="login" class="login hidden">
    <div class="box">
      <h2>HYPEBOTX Dashboard</h2>
      <p class="muted">Login menggunakan akun Discord. Akses ditentukan dari role owner, admin/staff, atau penjoki di server.</p>
      <a class="btn primary" href="/auth/discord">Login dengan Discord</a>
    </div>
  </div>
  <div id="app" class="hidden">
    <header>
      <h1>HYPEBOTX Commerce Dashboard</h1>
      <div class="user"><span id="who"></span><a class="btn" href="/logout">Logout</a></div>
    </header>
    <div class="layout">
      <nav id="nav"></nav>
      <main>
        <div id="cards" class="grid"></div>
        <section>
          <div class="toolbar">
            <h2 id="title">Overview</h2>
            <div><input id="filter" placeholder="Cari..." /><button onclick="loadData()">Refresh</button></div>
          </div>
          <div id="content"></div>
        </section>
      </main>
    </div>
  </div>
  <script>
    const state = { me:null, data:null, tab:"overview" };
    const tabs = [
      ["overview","Overview","overview"], ["orders","Orders","admin"], ["payments","Payment Proof","admin"],
      ["tickets","Tickets","tickets"], ["joki","Joki Queue","joki"], ["myjobs","My Job","joki"],
      ["stock","Stock","admin"], ["products","Products","owner"], ["pricelist","Pricelist","owner"],
      ["staff","Staff","owner"], ["customers","Customers","admin"], ["coupons","Coupon","admin"],
      ["reports","Reports","admin"], ["audit","Audit Log","admin"], ["owner","Owner Tools","owner"]
    ];
    async function api(path, options) {
      const res = await fetch(path, options);
      if (res.status === 401) throw new Error("login");
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    }
    function can(tabRole) {
      const role = state.me?.role;
      if (role === "owner") return true;
      if (role === "admin") return !["owner"].includes(tabRole);
      if (role === "penjoki") return ["overview","joki"].includes(tabRole);
      return false;
    }
    function row(values) { return "<tr>" + values.map(v => "<td>" + (v ?? "-") + "</td>").join("") + "</tr>"; }
    function table(headers, rows) {
      return "<table><thead><tr>" + headers.map(h => "<th>" + h + "</th>").join("") + "</tr></thead><tbody>" + rows.join("") + "</tbody></table>";
    }
    function renderCards() {
      const o = state.data.overview;
      const cards = [
        ["Open Tickets", o.ticketsOpen], ["Total Orders", o.ordersTotal], ["Pending Orders", o.ordersPending],
        ["Pending Payments", o.paymentsPending], ["Revenue", o.revenueText], ["Active Joki", o.activeJoki],
        ["Stock Available", o.stockAvailable], ["Customers", o.customers]
      ];
      document.getElementById("cards").innerHTML = cards.map(([label,value]) => '<div class="card"><div class="label">'+label+'</div><div class="value">'+value+'</div></div>').join("");
    }
    async function postJson(path, payload) {
      await api(path, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload || {}) });
      await loadData();
    }
    async function patchJson(path, payload) {
      await api(path, { method:"PATCH", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload || {}) });
      await loadData();
    }
    function actionsForOrder(x) {
      if (!can("admin")) return "";
      return '<button onclick="patchJson(\\'/api/orders/'+x.id+'/status\\',{status:\\'processing\\'})">Processing</button> <button onclick="patchJson(\\'/api/orders/'+x.id+'/status\\',{status:\\'completed\\'})">Done</button>';
    }
    function actionsForJoki(x) {
      let html = '';
      if (state.me.role === "penjoki" || state.me.role === "admin" || state.me.role === "owner") html += '<button onclick="postJson(\\'/api/joki/jobs/'+x.id+'/claim\\',{})">Claim</button> ';
      if (state.me.role !== "penjoki") html += '<button onclick="postJson(\\'/api/joki/jobs/'+x.id+'/approve\\',{})">Approve</button> ';
      html += '<button onclick="postJson(\\'/api/joki/jobs/'+x.id+'/progress\\',{status:\\'processing\\',progress:50,note:\\'Update dari dashboard\\'})">Progress</button>';
      return html;
    }
    function pickRows(tab) {
      if (tab === "reports") return [];
      if (tab === "owner") return [];
      if (tab === "myjobs") return (state.data.joki || []).filter(x => x.claimedBy === state.me.user.id || x.userId === state.me.user.id);
      if (tab === "products" || tab === "pricelist") return state.data.stock || [];
      if (tab === "staff") return state.data.staff || [];
      if (tab === "audit") return state.data.auditLogs || [];
      return state.data[tab] || [];
    }
    function render() {
      renderCards();
      document.getElementById("title").textContent = tabs.find(t => t[0] === state.tab)?.[1] || "Overview";
      document.querySelectorAll("nav button").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === state.tab));
      const q = document.getElementById("filter").value.toLowerCase();
      const rows = pickRows(state.tab).filter(item => JSON.stringify(item).toLowerCase().includes(q));
      if (state.tab === "overview") {
        document.getElementById("content").innerHTML = "<p class='muted'>Dashboard terpadu untuk owner, admin, dan penjoki. Gunakan tab kiri untuk operasional.</p>";
      } else if (state.tab === "orders") {
        document.getElementById("content").innerHTML = table(["Order ID","Customer","Layanan","Paket","Status","Payment","Action"], rows.map(x => row(["<code>"+x.id+"</code>", x.customerName || x.userId, x.service || x.category, x.packageName || x.package, "<span class='badge'>"+(x.status||"-")+"</span>", x.paymentStatus, actionsForOrder(x)])));
      } else if (state.tab === "payments") {
        document.getElementById("content").innerHTML = table(["Payment ID","Order","Ticket","Status","Amount","Action"], rows.map(x => row(["<code>"+x.id+"</code>", x.orderId, x.ticketId, "<span class='badge'>"+(x.status||"-")+"</span>", x.amount || "-", can("admin") ? '<button onclick="postJson(\\'/api/payments/'+x.id+'/approve\\',{})">Approve</button> <button onclick="postJson(\\'/api/payments/'+x.id+'/reject\\',{reason:\\'Rejected from dashboard\\'})">Reject</button>' : ""])));
      } else if (state.tab === "tickets") {
        document.getElementById("content").innerHTML = table(["Ticket","Type","Owner","Status","Channel"], rows.map(x => row(["<code>"+x.id+"</code>", x.type, x.openerId, "<span class='badge'>"+(x.status||x.orderStatus||"open")+"</span>", x.channelId])));
      } else if (state.tab === "joki" || state.tab === "myjobs") {
        document.getElementById("content").innerHTML = table(["Queue","Ticket","User","Status","Progress","Action"], rows.map(x => row(["<code>"+(x.id||x.orderId)+"</code>", x.ticketId, x.userId, "<span class='badge'>"+(x.status||"-")+"</span>", (x.completedHeist||0)+"/"+(x.totalHeist||"-"), actionsForJoki(x)])));
      } else if (state.tab === "stock") {
        document.getElementById("content").innerHTML = table(["SKU","Produk","Harga","Available","Reserved","Sold"], rows.map(x => row([x.sku || x.id, x.name, x.price, x.available, x.reserved, x.sold])));
      } else if (state.tab === "customers") {
        document.getElementById("content").innerHTML = table(["User","Tier","Status","Total Order","Last Order"], rows.map(x => row([x.username || x.userId, x.tier, x.status, x.totalOrder || 0, x.lastOrderAt])));
      } else if (state.tab === "coupons") {
        document.getElementById("content").innerHTML = table(["Code","Type","Value","Limit","Active"], rows.map(x => row([x.code, x.discountType || x.type, x.discountValue || x.value, x.maxRedemptions || x.limit, x.active !== false ? "yes" : "no"])));
      } else if (state.tab === "staff") {
        document.getElementById("content").innerHTML = table(["User","Role","Status","Total Order"], rows.map(x => row([x.username || x.userId, x.dashboardRole || x.staffRole || x.role || "-", x.status || "active", x.totalOrder || 0])));
      } else if (state.tab === "audit") {
        document.getElementById("content").innerHTML = table(["Time","Action","Actor","Role","Target"], rows.map(x => row([x.createdAt, x.action, x.actorUsername || x.actorId, x.actorRole, x.targetType + ":" + x.targetId])));
      } else if (state.tab === "reports") {
        const h = state.data.health || {};
        document.getElementById("content").innerHTML = "<pre>"+JSON.stringify(h, null, 2)+"</pre>";
      } else if (state.tab === "owner") {
        document.getElementById("content").innerHTML = "<p><b>Owner Tools</b></p><p class='muted'>Backup, recovery, whitelist, maintenance, dan PM2 action tetap dijalankan dari panel Discord dengan reason + confirm gate. Dashboard ini menampilkan status dan data operasional.</p>";
      }
    }
    async function loadData() {
      state.data = await api("/api/dashboard");
      render();
    }
    async function boot() {
      try {
        state.me = await api("/api/me");
        document.getElementById("login").classList.add("hidden");
        document.getElementById("app").classList.remove("hidden");
        document.getElementById("who").textContent = state.me.user.globalName + " / " + state.me.role;
        document.getElementById("nav").innerHTML = tabs.filter(t => can(t[2])).map(t => '<button data-tab="'+t[0]+'">'+t[1]+'</button>').join("");
        document.querySelectorAll("nav button").forEach(btn => btn.onclick = () => { state.tab = btn.dataset.tab; render(); });
        await loadData();
      } catch (e) {
        document.getElementById("app").classList.add("hidden");
        document.getElementById("login").classList.remove("hidden");
      }
    }
    document.getElementById("filter").addEventListener("input", render);
    boot();
  </script>
</body>
</html>`;
  }

  function createExpressApp() {
    const app = express();
    app.disable("x-powered-by");
    app.use(express.json({ limit: "64kb" }));
    app.use(express.urlencoded({ extended: false, limit: "64kb" }));

    function requestIp(req) {
      return req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || null;
    }

    function requireSameOrigin(req, res, next) {
      if (!["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) return next();
      const host = req.headers.host;
      const origin = req.headers.origin || req.headers.referer;
      if (origin && host) {
        try {
          const url = new URL(origin);
          if (url.host !== host) {
            return sendJson(res, 403, { ok: false, message: "CSRF validation failed." });
          }
        } catch {
          return sendJson(res, 403, { ok: false, message: "CSRF validation failed." });
        }
      }
      return next();
    }

    function routeArea(path) {
      if (path.includes("/owner") || path.includes("/settings")) return "owner";
      if (path.includes("/products")) return "owner";
      if (path.includes("/penjoki")) return "joki";
      if (path.includes("/joki")) return "joki";
      if (path.includes("/tickets")) return "tickets";
      return "admin";
    }

    function publicSession(req) {
      pruneSessions();
      const token = parseCookie(req.headers.cookie).hypebotx_dashboard;
      return token ? sessions.get(token) : null;
    }

    async function findOrder(guildId, id) {
      return repositories.orderRepository?.findByIdScoped?.(guildId, id)
        || repositories.orderRepository?.findById?.(id)
        || null;
    }

    async function updateOrder(req, res, id, changes, action) {
      const session = req.dashboardSession;
      const before = await findOrder(session.guildId, id);
      if (!before) return sendJson(res, 404, { ok: false, message: "Order tidak ditemukan." });
      const updated = await repositories.orderRepository?.updateByIdScoped?.(session.guildId, id, changes)
        || await repositories.orderRepository?.updateById?.(id, changes);
      await writeAuditLog({
        session,
        action,
        targetType: "order",
        targetId: id,
        oldValue: before,
        newValue: updated,
        ip: requestIp(req),
      });
      return sendJson(res, 200, { ok: true, order: updated });
    }

    function getJokiRows(guildId) {
      if (!repositories.jokiRepository?.getQueue) return Promise.resolve([]);
      return repositories.jokiRepository.getQueue(guildId)
        .then((queue) => asArray(queue?.orders).map((order) => ({ ...order, guildId })));
    }

    async function findJokiJob(guildId, id) {
      const rows = await getJokiRows(guildId).catch(() => []);
      return rows.find((row) => row.id === id) || null;
    }

    async function updateJokiStatus(req, res, id, updates, action) {
      const session = req.dashboardSession;
      const before = await findJokiJob(session.guildId, id);
      if (!before) return sendJson(res, 404, { ok: false, message: "Job joki tidak ditemukan." });
      if (session.role === "penjoki" && before.claimedBy && before.claimedBy !== session.user.id) {
        return sendJson(res, 403, { ok: false, message: "Penjoki hanya bisa mengubah job sendiri." });
      }
      await repositories.jokiRepository?.setOrderStatus?.(session.guildId, id, updates);
      const after = await findJokiJob(session.guildId, id);
      await writeAuditLog({
        session,
        action,
        targetType: "joki_job",
        targetId: id,
        oldValue: before,
        newValue: after || updates,
        ip: requestIp(req),
      });
      return sendJson(res, 200, { ok: true, job: after || updates });
    }

    async function renderProtectedDashboard(req, res) {
      res.type("text/html; charset=utf-8").send(renderHtml());
    }

    app.get("/login", (req, res) => {
      const session = publicSession(req);
      if (session) return res.redirect(redirectForRole(session.role));
      return res.type("text/html; charset=utf-8").send(renderLoginHtml({ loggedOut: req.query.logged_out === "1" }));
    });

    app.get("/unauthorized", (_req, res) => {
      res.type("text/html; charset=utf-8").send(renderUnauthorizedHtml());
    });

    app.get("/", requirePageSession("overview"), renderProtectedDashboard);
    app.get("/dashboard", requirePageSession("overview"), renderProtectedDashboard);
    app.get("/owner/dashboard", requirePageSession("owner"), renderProtectedDashboard);
    app.get("/admin/dashboard", requirePageSession("admin"), renderProtectedDashboard);
    app.get("/penjoki/dashboard", requirePageSession("joki"), renderProtectedDashboard);
    for (const page of ["/orders", "/payments", "/tickets", "/joki", "/stock", "/products", "/settings"]) {
      app.get(page, requirePageSession(routeArea(page)), renderProtectedDashboard);
    }

    app.get(["/auth/discord", "/api/auth/discord"], rateLimitAuth, (_req, res) => {
      const config = getConfig();
      if (!config.clientId || !config.clientSecret) {
        res.status(500).send("Dashboard Discord OAuth belum dikonfigurasi.");
        return;
      }
      const state = crypto.randomBytes(18).toString("base64url");
      oauthStates.set(state, { expiresAt: Date.now() + 10 * 60 * 1000 });
      const url = new URL("https://discord.com/oauth2/authorize");
      url.searchParams.set("client_id", config.clientId);
      url.searchParams.set("redirect_uri", config.redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "identify");
      url.searchParams.set("state", state);
      res.redirect(url.toString());
    });

    app.get(["/auth/discord/callback", "/api/auth/discord/callback"], rateLimitAuth, async (req, res) => {
      try {
        const state = String(req.query.state || "");
        const code = String(req.query.code || "");
        const stored = oauthStates.get(state);
        oauthStates.delete(state);
        if (!stored || stored.expiresAt < Date.now() || !code) {
          await writeAuditLog({
            action: "LOGIN_FAILED",
            targetType: "auth",
            targetId: "oauth",
            ip: requestIp(req),
            newValue: { reason: "invalid_state" },
          });
          res.status(400).send("OAuth state invalid atau expired.");
          return;
        }
        const user = await fetchDiscordUser(code);
        const token = await createSession(user);
        setSessionCookie(res, token);
        const session = sessions.get(token);
        res.redirect(redirectForRole(session.role));
      } catch (error) {
        logger?.warn?.("dashboard oauth failed", { message: error.message });
        res.redirect("/unauthorized");
      }
    });

    async function logout(req, res) {
      const token = parseCookie(req.headers.cookie).hypebotx_dashboard;
      const session = token ? sessions.get(token) : null;
      if (session) {
        await writeAuditLog({
          session,
          action: "LOGOUT",
          targetType: "auth",
          targetId: session.user.id,
          ip: requestIp(req),
        });
        sessions.delete(token);
      }
      clearSessionCookie(res);
      res.redirect("/login?logged_out=1");
    }

    app.get("/logout", logout);
    app.post("/api/auth/logout", requireSameOrigin, logout);

    app.get(["/api/me", "/api/auth/me"], requireSession("me"), (req, res) => {
      const { user, role, guildId, loginAt } = req.dashboardSession;
      sendJson(res, 200, {
        ok: true,
        discord_id: user.id,
        username: user.globalName || user.username,
        avatar: user.avatar,
        role,
        login_at: loginAt,
        user,
        guildId,
      });
    });

    app.use("/api", requireSameOrigin);

    app.get("/api/dashboard", requireSession("overview"), async (req, res) => {
      const data = await getDashboardData(req.dashboardSession.guildId).catch((error) => ({ error: error.message }));
      sendJson(res, data.error ? 500 : 200, data.error ? { ok: false, message: data.error } : data);
    });

    app.get("/api/owner/overview", requireSession("owner"), async (req, res) => {
      const data = await getDashboardData(req.dashboardSession.guildId).catch((error) => ({ error: error.message }));
      sendJson(res, data.error ? 500 : 200, data.error ? { ok: false, message: data.error } : { ok: true, overview: data.overview });
    });
    app.get("/api/owner/stats", requireSession("owner"), async (req, res) => {
      const data = await getDashboardData(req.dashboardSession.guildId).catch((error) => ({ error: error.message }));
      sendJson(res, data.error ? 500 : 200, data.error ? { ok: false, message: data.error } : { ok: true, stats: data.overview });
    });
    app.get("/api/owner/audit-logs", requireSession("owner"), async (req, res) => {
      sendJson(res, 200, { ok: true, auditLogs: await listAuditLogs(req.dashboardSession.guildId) });
    });
    app.get("/api/owner/bot-status", requireSession("owner"), async (_req, res) => {
      const health = await services.backlogService?.getHealthSnapshot?.(dashboardClient).catch(() => null);
      sendJson(res, 200, { ok: true, status: health || { dashboard: Boolean(server), url: dashboardUrl } });
    });
    app.get("/api/owner/ai-usage", requireSession("owner"), async (req, res) => {
      const rows = await repositories.opsRepository?.aiLogs?.getAll?.().catch(() => []) || [];
      sendJson(res, 200, { ok: true, aiUsage: rows.filter((row) => !row.guildId || row.guildId === req.dashboardSession.guildId).slice(-100) });
    });
    for (const action of ["restart", "stop", "start"]) {
      app.post(`/api/owner/bot/${action}`, requireSession("owner"), async (req, res) => {
        await writeAuditLog({
          session: req.dashboardSession,
          action: `BOT_${action.toUpperCase()}_REQUESTED`,
          targetType: "bot",
          targetId: action,
          newValue: { reason: req.body?.reason || "" },
          ip: requestIp(req),
        });
        sendJson(res, 202, { ok: true, message: "Permintaan tercatat. Eksekusi PM2 tetap lewat owner confirm gate Discord/terminal." });
      });
    }
    app.post("/api/owner/backup", requireSession("owner"), async (req, res) => {
      await writeAuditLog({
        session: req.dashboardSession,
        action: "BACKUP_REQUESTED",
        targetType: "backup",
        targetId: "dashboard",
        newValue: { reason: req.body?.reason || "" },
        ip: requestIp(req),
      });
      sendJson(res, 202, { ok: true, message: "Backup request tercatat. Jalankan backup final lewat owner confirm gate." });
    });

    app.get("/api/orders", requireSession("admin"), async (req, res) => {
      const rows = await repositories.orderRepository?.getAllByGuildId?.(req.dashboardSession.guildId).catch(() => []) || [];
      sendJson(res, 200, { ok: true, orders: rows });
    });
    app.get("/api/orders/:id", requireSession("admin"), async (req, res) => {
      const row = await findOrder(req.dashboardSession.guildId, req.params.id);
      sendJson(res, row ? 200 : 404, row ? { ok: true, order: row } : { ok: false, message: "Order tidak ditemukan." });
    });
    app.patch("/api/orders/:id/status", requireSession("admin"), async (req, res) => {
      const status = String(req.body?.status || "").trim().toLowerCase();
      if (!status) return sendJson(res, 400, { ok: false, message: "Status wajib diisi." });
      return updateOrder(req, res, req.params.id, { status, dashboardUpdatedAt: nowIso() }, "ORDER_STATUS_CHANGED");
    });
    app.patch("/api/orders/:id/assign-admin", requireSession("admin"), async (req, res) => {
      const assignedAdminId = String(req.body?.adminId || req.dashboardSession.user.id).trim();
      return updateOrder(req, res, req.params.id, { assignedAdminId }, "ORDER_ASSIGNED_ADMIN");
    });
    app.patch("/api/orders/:id/assign-joki", requireSession("admin"), async (req, res) => {
      const assignedJokiId = String(req.body?.jokiId || "").trim();
      if (!assignedJokiId) return sendJson(res, 400, { ok: false, message: "jokiId wajib diisi." });
      return updateOrder(req, res, req.params.id, { assignedJokiId }, "ORDER_ASSIGNED_JOKI");
    });
    app.post("/api/orders/:id/note", requireSession("admin"), async (req, res) => {
      const note = String(req.body?.note || "").trim().slice(0, 1000);
      return updateOrder(req, res, req.params.id, { internalNote: note }, "ORDER_UPDATED");
    });
    app.post("/api/orders/:id/cancel", requireSession("owner"), async (req, res) => {
      return updateOrder(req, res, req.params.id, { status: "cancelled", cancelReason: String(req.body?.reason || "").slice(0, 500) }, "ORDER_CANCELLED");
    });
    app.post("/api/orders/:id/refund", requireSession("owner"), async (req, res) => {
      return updateOrder(req, res, req.params.id, { status: "refunded", paymentStatus: "refunded", refundReason: String(req.body?.reason || "").slice(0, 500) }, "ORDER_REFUNDED");
    });

    app.get("/api/payments", requireSession("admin"), async (req, res) => {
      const rows = await repositories.paymentRepository?.getAll?.().catch(() => []) || [];
      sendJson(res, 200, { ok: true, payments: rows.filter((row) => !row.guildId || row.guildId === req.dashboardSession.guildId) });
    });
    app.get("/api/payments/:id", requireSession("admin"), async (req, res) => {
      const row = await repositories.paymentRepository?.findById?.(req.params.id).catch(() => null);
      sendJson(res, row ? 200 : 404, row ? { ok: true, payment: row } : { ok: false, message: "Payment tidak ditemukan." });
    });
    app.post("/api/payments/:id/approve", requireSession("admin"), async (req, res) => {
      const before = await repositories.paymentRepository?.findById?.(req.params.id).catch(() => null);
      if (!before) return sendJson(res, 404, { ok: false, message: "Payment tidak ditemukan." });
      const payment = await repositories.paymentRepository?.updateById?.(req.params.id, {
        status: "paid",
        approvedBy: req.dashboardSession.user.id,
        approvedAt: nowIso(),
      });
      if (payment?.orderId) {
        await repositories.orderRepository?.updateByIdScoped?.(req.dashboardSession.guildId, payment.orderId, {
          paymentStatus: "paid",
          status: "processing",
        });
      }
      await writeAuditLog({ session: req.dashboardSession, action: "PAYMENT_APPROVED", targetType: "payment", targetId: req.params.id, oldValue: before, newValue: payment, ip: requestIp(req) });
      sendJson(res, 200, { ok: true, payment });
    });
    app.post("/api/payments/:id/reject", requireSession("admin"), async (req, res) => {
      const before = await repositories.paymentRepository?.findById?.(req.params.id).catch(() => null);
      if (!before) return sendJson(res, 404, { ok: false, message: "Payment tidak ditemukan." });
      const payment = await repositories.paymentRepository?.updateById?.(req.params.id, {
        status: "rejected",
        rejectedBy: req.dashboardSession.user.id,
        rejectReason: String(req.body?.reason || "").slice(0, 500),
        rejectedAt: nowIso(),
      });
      await writeAuditLog({ session: req.dashboardSession, action: "PAYMENT_REJECTED", targetType: "payment", targetId: req.params.id, oldValue: before, newValue: payment, ip: requestIp(req) });
      sendJson(res, 200, { ok: true, payment });
    });
    app.post("/api/payments/:id/sync", requireSession("admin"), async (req, res) => {
      await writeAuditLog({ session: req.dashboardSession, action: "PAYMENT_SYNCED", targetType: "payment", targetId: req.params.id, ip: requestIp(req) });
      sendJson(res, 202, { ok: true, message: "Payment sync request tercatat." });
    });

    app.get("/api/tickets", requireSession("admin"), async (req, res) => {
      const rows = await repositories.ticketRepository?.getAllByGuildId?.(req.dashboardSession.guildId).catch(() => []) || [];
      sendJson(res, 200, { ok: true, tickets: rows });
    });
    app.get("/api/tickets/:id", requireSession("admin"), async (req, res) => {
      const rows = await repositories.ticketRepository?.getAllByGuildId?.(req.dashboardSession.guildId).catch(() => []) || [];
      const ticket = rows.find((row) => row.id === req.params.id || row.channelId === req.params.id);
      sendJson(res, ticket ? 200 : 404, ticket ? { ok: true, ticket } : { ok: false, message: "Ticket tidak ditemukan." });
    });
    for (const [route, status, action] of [["claim", "claimed", "TICKET_CLAIMED"], ["close", "closed", "TICKET_CLOSED"], ["reopen", "open", "TICKET_REOPENED"]]) {
      app.post(`/api/tickets/:id/${route}`, requireSession("admin"), async (req, res) => {
        const rows = await repositories.ticketRepository?.getAllByGuildId?.(req.dashboardSession.guildId).catch(() => []) || [];
        const before = rows.find((row) => row.id === req.params.id || row.channelId === req.params.id);
        if (!before) return sendJson(res, 404, { ok: false, message: "Ticket tidak ditemukan." });
        const updated = await repositories.ticketRepository?.update?.(before.id, {
          status,
          claimedBy: route === "claim" ? req.dashboardSession.user.id : before.claimedBy,
          closedBy: route === "close" ? req.dashboardSession.user.id : before.closedBy,
          closedAt: route === "close" ? nowIso() : route === "reopen" ? null : before.closedAt,
        });
        await writeAuditLog({ session: req.dashboardSession, action, targetType: "ticket", targetId: before.id, oldValue: before, newValue: updated, ip: requestIp(req) });
        sendJson(res, 200, { ok: true, ticket: updated });
      });
    }
    app.post("/api/tickets/:id/note", requireSession("admin"), async (req, res) => {
      await writeAuditLog({ session: req.dashboardSession, action: "TICKET_NOTE_ADDED", targetType: "ticket", targetId: req.params.id, newValue: { note: String(req.body?.note || "").slice(0, 500) }, ip: requestIp(req) });
      sendJson(res, 200, { ok: true });
    });

    app.get("/api/joki/queue", requireSession("joki"), async (req, res) => {
      const queue = await repositories.jokiRepository?.getQueue?.(req.dashboardSession.guildId).catch(() => null);
      sendJson(res, 200, { ok: true, queue: asArray(queue?.orders) });
    });
    app.get("/api/joki/my-jobs", requireSession("joki"), async (req, res) => {
      const rows = await getJokiRows(req.dashboardSession.guildId).catch(() => []);
      const myJobs = req.dashboardSession.role === "penjoki"
        ? rows.filter((row) => row.claimedBy === req.dashboardSession.user.id || row.userId === req.dashboardSession.user.id)
        : rows;
      sendJson(res, 200, { ok: true, jobs: myJobs });
    });
    app.get("/api/joki/jobs/:id", requireSession("joki"), async (req, res) => {
      const job = await findJokiJob(req.dashboardSession.guildId, req.params.id);
      if (job && req.dashboardSession.role === "penjoki" && job.claimedBy && job.claimedBy !== req.dashboardSession.user.id) {
        return sendJson(res, 403, { ok: false, message: "Penjoki hanya bisa melihat job sendiri." });
      }
      sendJson(res, job ? 200 : 404, job ? { ok: true, job } : { ok: false, message: "Job tidak ditemukan." });
    });
    app.post("/api/joki/jobs/:id/claim", requireSession("joki"), async (req, res) => {
      const result = await repositories.jokiRepository?.claimOrder?.(req.dashboardSession.guildId, req.params.id, req.dashboardSession.user.id);
      await writeAuditLog({ session: req.dashboardSession, action: "JOKI_JOB_CLAIMED", targetType: "joki_job", targetId: req.params.id, newValue: result, ip: requestIp(req) });
      sendJson(res, result?.ok ? 200 : 409, { ok: Boolean(result?.ok), message: result?.message || "Job claimed." });
    });
    app.post("/api/joki/jobs/:id/progress", requireSession("joki"), async (req, res) => {
      return updateJokiStatus(req, res, req.params.id, {
        status: req.body?.status || "processing",
        progress: Number(req.body?.progress || 0),
        progressNote: String(req.body?.note || "").slice(0, 500),
      }, "JOKI_PROGRESS_UPDATED");
    });
    app.post("/api/joki/jobs/:id/submit-done", requireSession("joki"), async (req, res) => {
      return updateJokiStatus(req, res, req.params.id, {
        status: "hold",
        progress: 99,
        progressNote: String(req.body?.note || "Submitted done, waiting admin review.").slice(0, 500),
        adminReviewStatus: "pending",
      }, "JOKI_SUBMITTED_DONE");
    });
    app.post("/api/joki/jobs/:id/approve", requireSession("admin"), async (req, res) => {
      const result = await repositories.jokiRepository?.completeOrder?.(req.dashboardSession.guildId, req.params.id, req.dashboardSession.user.id);
      await writeAuditLog({ session: req.dashboardSession, action: "JOKI_APPROVED", targetType: "joki_job", targetId: req.params.id, newValue: result, ip: requestIp(req) });
      sendJson(res, result?.ok ? 200 : 409, { ok: Boolean(result?.ok), message: result?.message || "Job approved." });
    });
    app.post("/api/joki/jobs/:id/reject", requireSession("admin"), async (req, res) => {
      return updateJokiStatus(req, res, req.params.id, { status: "hold", adminReviewStatus: "rejected", progressNote: String(req.body?.reason || "").slice(0, 500) }, "JOKI_REJECTED");
    });
    app.post("/api/joki/jobs/:id/reassign", requireSession("admin"), async (req, res) => {
      const jokiId = String(req.body?.jokiId || "").trim();
      if (!jokiId) return sendJson(res, 400, { ok: false, message: "jokiId wajib diisi." });
      return updateJokiStatus(req, res, req.params.id, { claimedBy: jokiId, claimedAt: nowIso() }, "JOKI_REASSIGNED");
    });

    app.get("/api/products", requireSession("admin"), async (req, res) => {
      const rows = await repositories.stockRepository?.stockItems?.getAll?.(req.dashboardSession.guildId).catch(() => []) || [];
      sendJson(res, 200, { ok: true, products: rows });
    });
    app.post("/api/products", requireSession("owner"), async (req, res) => {
      const product = await repositories.stockRepository?.stockItems?.create?.({ ...req.body, guildId: req.dashboardSession.guildId });
      await writeAuditLog({ session: req.dashboardSession, action: "PRODUCT_CREATED", targetType: "product", targetId: product?.id, newValue: product, ip: requestIp(req) });
      sendJson(res, 201, { ok: true, product });
    });
    app.get("/api/products/:id", requireSession("admin"), async (req, res) => {
      const product = await repositories.stockRepository?.stockItems?.findById?.(req.params.id).catch(() => null);
      sendJson(res, product ? 200 : 404, product ? { ok: true, product } : { ok: false, message: "Produk tidak ditemukan." });
    });
    app.patch("/api/products/:id", requireSession("owner"), async (req, res) => {
      const before = await repositories.stockRepository?.stockItems?.findById?.(req.params.id).catch(() => null);
      const product = await repositories.stockRepository?.stockItems?.updateById?.(req.params.id, req.body || {});
      await writeAuditLog({ session: req.dashboardSession, action: "PRODUCT_UPDATED", targetType: "product", targetId: req.params.id, oldValue: before, newValue: product, ip: requestIp(req) });
      sendJson(res, product ? 200 : 404, product ? { ok: true, product } : { ok: false, message: "Produk tidak ditemukan." });
    });
    app.delete("/api/products/:id", requireSession("owner"), async (req, res) => {
      const before = await repositories.stockRepository?.stockItems?.findById?.(req.params.id).catch(() => null);
      const product = await repositories.stockRepository?.stockItems?.updateById?.(req.params.id, { isActive: false });
      await writeAuditLog({ session: req.dashboardSession, action: "PRODUCT_DISABLED", targetType: "product", targetId: req.params.id, oldValue: before, newValue: product, ip: requestIp(req) });
      sendJson(res, product ? 200 : 404, product ? { ok: true, product } : { ok: false, message: "Produk tidak ditemukan." });
    });

    app.get("/api/pricelist", requireSession("admin"), async (req, res) => {
      const products = await repositories.stockRepository?.stockItems?.getAll?.(req.dashboardSession.guildId).catch(() => []) || [];
      sendJson(res, 200, { ok: true, pricelist: products.map((row) => ({ id: row.id, sku: row.sku, name: row.name, price: row.price, active: row.isActive !== false })) });
    });
    app.post("/api/pricelist", requireSession("owner"), async (req, res) => {
      const product = await repositories.stockRepository?.stockItems?.create?.({ ...req.body, guildId: req.dashboardSession.guildId });
      await writeAuditLog({ session: req.dashboardSession, action: "PRICELIST_CREATED", targetType: "pricelist", targetId: product?.id, newValue: product, ip: requestIp(req) });
      sendJson(res, 201, { ok: true, pricelist: product });
    });
    app.patch("/api/pricelist/:id", requireSession("owner"), async (req, res) => {
      const product = await repositories.stockRepository?.stockItems?.updateById?.(req.params.id, { price: req.body?.price, isActive: req.body?.active });
      await writeAuditLog({ session: req.dashboardSession, action: "PRICELIST_UPDATED", targetType: "pricelist", targetId: req.params.id, newValue: product, ip: requestIp(req) });
      sendJson(res, product ? 200 : 404, product ? { ok: true, pricelist: product } : { ok: false, message: "Pricelist tidak ditemukan." });
    });
    app.delete("/api/pricelist/:id", requireSession("owner"), async (req, res) => {
      const product = await repositories.stockRepository?.stockItems?.updateById?.(req.params.id, { isActive: false });
      await writeAuditLog({ session: req.dashboardSession, action: "PRICELIST_DISABLED", targetType: "pricelist", targetId: req.params.id, newValue: product, ip: requestIp(req) });
      sendJson(res, product ? 200 : 404, product ? { ok: true, pricelist: product } : { ok: false, message: "Pricelist tidak ditemukan." });
    });

    app.get("/api/stock", requireSession("admin"), async (req, res) => {
      const rows = await repositories.stockRepository?.stockUnits?.getAll?.(req.dashboardSession.guildId).catch(() => []) || [];
      const safeRows = rows.map(({ valueEncrypted, ...row }) => ({ ...row, hasValue: Boolean(valueEncrypted) }));
      sendJson(res, 200, { ok: true, stock: safeRows });
    });
    app.post("/api/stock", requireSession("admin"), async (req, res) => {
      const unit = await repositories.stockRepository?.stockUnits?.create?.({ ...req.body, guildId: req.dashboardSession.guildId, addedBy: req.dashboardSession.user.id });
      await writeAuditLog({ session: req.dashboardSession, action: "STOCK_CREATED", targetType: "stock", targetId: unit?.id, newValue: { ...unit, valueEncrypted: unit?.valueEncrypted ? "[masked]" : null }, ip: requestIp(req) });
      sendJson(res, 201, { ok: true, stock: unit ? { ...unit, valueEncrypted: undefined, hasValue: Boolean(unit.valueEncrypted) } : null });
    });
    app.patch("/api/stock/:id", requireSession("admin"), async (req, res) => {
      const changes = { ...req.body };
      delete changes.valueEncrypted;
      const unit = await repositories.stockRepository?.stockUnits?.updateById?.(req.params.id, changes);
      await writeAuditLog({ session: req.dashboardSession, action: "STOCK_UPDATED", targetType: "stock", targetId: req.params.id, newValue: unit ? { ...unit, valueEncrypted: unit.valueEncrypted ? "[masked]" : null } : null, ip: requestIp(req) });
      sendJson(res, unit ? 200 : 404, unit ? { ok: true, stock: { ...unit, valueEncrypted: undefined, hasValue: Boolean(unit.valueEncrypted) } } : { ok: false, message: "Stock tidak ditemukan." });
    });
    app.delete("/api/stock/:id", requireSession("owner"), async (req, res) => {
      const unit = await repositories.stockRepository?.stockUnits?.updateById?.(req.params.id, { status: "disabled" });
      await writeAuditLog({ session: req.dashboardSession, action: "STOCK_DELETED", targetType: "stock", targetId: req.params.id, newValue: { status: "disabled" }, ip: requestIp(req) });
      sendJson(res, unit ? 200 : 404, unit ? { ok: true } : { ok: false, message: "Stock tidak ditemukan." });
    });
    app.post("/api/stock/:id/reserve", requireSession("admin"), async (req, res) => {
      const unit = await repositories.stockRepository?.stockUnits?.updateById?.(req.params.id, { status: "reserved", reservedByOrderId: req.body?.orderId || null, reservedAt: nowIso() });
      await writeAuditLog({ session: req.dashboardSession, action: "STOCK_RESERVED", targetType: "stock", targetId: req.params.id, newValue: unit ? { ...unit, valueEncrypted: unit.valueEncrypted ? "[masked]" : null } : null, ip: requestIp(req) });
      sendJson(res, unit ? 200 : 404, unit ? { ok: true } : { ok: false, message: "Stock tidak ditemukan." });
    });
    app.post("/api/stock/:id/mark-sold", requireSession("admin"), async (req, res) => {
      const unit = await repositories.stockRepository?.stockUnits?.updateById?.(req.params.id, { status: "sold", soldToOrderId: req.body?.orderId || null, deliveredAt: nowIso() });
      await writeAuditLog({ session: req.dashboardSession, action: "STOCK_SOLD", targetType: "stock", targetId: req.params.id, newValue: unit ? { ...unit, valueEncrypted: unit.valueEncrypted ? "[masked]" : null } : null, ip: requestIp(req) });
      sendJson(res, unit ? 200 : 404, unit ? { ok: true } : { ok: false, message: "Stock tidak ditemukan." });
    });

    app.get("/api/staff", requireSession("owner"), async (req, res) => {
      const rows = await repositories.userRepository?.getAll?.().catch(() => []) || [];
      sendJson(res, 200, { ok: true, staff: rows.filter((row) => !row.guildId || row.guildId === req.dashboardSession.guildId) });
    });
    app.post("/api/staff", requireSession("owner"), async (req, res) => {
      const userId = String(req.body?.discordId || req.body?.userId || "").trim();
      const role = String(req.body?.role || "admin").toLowerCase();
      if (!userId || !["owner", "admin", "penjoki"].includes(role)) return sendJson(res, 400, { ok: false, message: "discordId dan role valid wajib diisi." });
      const staff = await repositories.userRepository?.upsert?.({ guildId: req.dashboardSession.guildId, userId, username: req.body?.username || "", dashboardRole: role, status: "active" });
      await writeAuditLog({ session: req.dashboardSession, action: "STAFF_CREATED", targetType: "staff", targetId: userId, newValue: staff, ip: requestIp(req) });
      sendJson(res, 201, { ok: true, staff });
    });
    app.patch("/api/staff/:id", requireSession("owner"), async (req, res) => {
      const existing = await repositories.userRepository?.find?.(req.dashboardSession.guildId, req.params.id).catch(() => null);
      const staff = await repositories.userRepository?.upsert?.({ ...(existing || {}), guildId: req.dashboardSession.guildId, userId: req.params.id, ...req.body });
      await writeAuditLog({ session: req.dashboardSession, action: "STAFF_ROLE_CHANGED", targetType: "staff", targetId: req.params.id, oldValue: existing, newValue: staff, ip: requestIp(req) });
      sendJson(res, 200, { ok: true, staff });
    });
    app.delete("/api/staff/:id", requireSession("owner"), async (req, res) => {
      const existing = await repositories.userRepository?.find?.(req.dashboardSession.guildId, req.params.id).catch(() => null);
      const staff = await repositories.userRepository?.upsert?.({ ...(existing || {}), guildId: req.dashboardSession.guildId, userId: req.params.id, status: "inactive" });
      await writeAuditLog({ session: req.dashboardSession, action: "STAFF_DELETED", targetType: "staff", targetId: req.params.id, oldValue: existing, newValue: staff, ip: requestIp(req) });
      sendJson(res, 200, { ok: true, staff });
    });
    app.post("/api/staff/:id/suspend", requireSession("owner"), async (req, res) => {
      const staff = await repositories.userRepository?.upsert?.({ guildId: req.dashboardSession.guildId, userId: req.params.id, status: "suspended" });
      await writeAuditLog({ session: req.dashboardSession, action: "STAFF_SUSPENDED", targetType: "staff", targetId: req.params.id, newValue: staff, ip: requestIp(req) });
      sendJson(res, 200, { ok: true, staff });
    });
    app.post("/api/staff/:id/activate", requireSession("owner"), async (req, res) => {
      const staff = await repositories.userRepository?.upsert?.({ guildId: req.dashboardSession.guildId, userId: req.params.id, status: "active" });
      await writeAuditLog({ session: req.dashboardSession, action: "STAFF_ACTIVATED", targetType: "staff", targetId: req.params.id, newValue: staff, ip: requestIp(req) });
      sendJson(res, 200, { ok: true, staff });
    });

    app.get("/api/customers", requireSession("admin"), async (req, res) => {
      const rows = await repositories.userRepository?.getAll?.().catch(() => []) || [];
      sendJson(res, 200, { ok: true, customers: rows.filter((row) => !row.guildId || row.guildId === req.dashboardSession.guildId) });
    });
    app.get("/api/customers/:id", requireSession("admin"), async (req, res) => {
      const customer = await repositories.userRepository?.find?.(req.dashboardSession.guildId, req.params.id).catch(() => null);
      sendJson(res, customer ? 200 : 404, customer ? { ok: true, customer } : { ok: false, message: "Customer tidak ditemukan." });
    });
    app.post("/api/customers/:id/note", requireSession("admin"), async (req, res) => {
      const existing = await repositories.userRepository?.find?.(req.dashboardSession.guildId, req.params.id).catch(() => null);
      const customer = await repositories.userRepository?.upsert?.({ ...(existing || {}), guildId: req.dashboardSession.guildId, userId: req.params.id, internalNote: String(req.body?.note || "").slice(0, 1000) });
      await writeAuditLog({ session: req.dashboardSession, action: "CUSTOMER_NOTE_ADDED", targetType: "customer", targetId: req.params.id, oldValue: existing, newValue: customer, ip: requestIp(req) });
      sendJson(res, 200, { ok: true, customer });
    });
    app.post("/api/customers/:id/blacklist-request", requireSession("admin"), async (req, res) => {
      await writeAuditLog({ session: req.dashboardSession, action: "BLACKLIST_REQUESTED", targetType: "customer", targetId: req.params.id, newValue: { reason: String(req.body?.reason || "").slice(0, 500) }, ip: requestIp(req) });
      sendJson(res, 202, { ok: true, message: "Request blacklist tercatat untuk owner review." });
    });

    app.get("/api/logs/order", requireSession("admin"), async (req, res) => {
      const rows = await listAuditLogs(req.dashboardSession.guildId);
      sendJson(res, 200, { ok: true, logs: rows.filter((row) => String(row.action || "").startsWith("ORDER_")) });
    });
    app.get("/api/logs/payment", requireSession("admin"), async (req, res) => {
      const rows = await listAuditLogs(req.dashboardSession.guildId);
      sendJson(res, 200, { ok: true, logs: rows.filter((row) => String(row.action || "").startsWith("PAYMENT_")) });
    });
    app.get("/api/logs/ticket", requireSession("admin"), async (req, res) => {
      const rows = await listAuditLogs(req.dashboardSession.guildId);
      sendJson(res, 200, { ok: true, logs: rows.filter((row) => String(row.action || "").startsWith("TICKET_")) });
    });
    app.get("/api/logs/error", requireSession("admin"), async (req, res) => {
      sendJson(res, 200, { ok: true, logs: [] });
    });
    app.get("/api/audit-logs", requireSession("admin"), async (req, res) => {
      sendJson(res, 200, { ok: true, auditLogs: await listAuditLogs(req.dashboardSession.guildId) });
    });

    app.get("/health.json", async (_req, res) => {
      sendJson(res, 200, {
        ok: true,
        dashboard: Boolean(server),
        url: dashboardUrl,
        sessions: sessions.size,
      });
    });

    return app;
  }

  async function start(client) {
    if (server) return { url: dashboardUrl };
    dashboardClient = client;
    const config = getConfig();
    const app = createExpressApp();

    await new Promise((resolve, reject) => {
      server = app.listen(config.port, config.host, resolve);
      server.once("error", reject);
    }).catch((error) => {
      server = null;
      throw error;
    });

    dashboardUrl = config.publicUrl;
    logger?.info?.("web dashboard started", { dashboardUrl });
    return { url: dashboardUrl };
  }

  async function stop() {
    if (!server) return;
    await new Promise((resolve) => server.close(resolve));
    server = null;
    dashboardUrl = null;
    dashboardClient = null;
    sessions.clear();
    oauthStates.clear();
  }

  return {
    start,
    stop,
    getDashboardUrl: () => dashboardUrl,
    isEnabled: () => getConfig().enabled,
    _private: {
      canAccess,
      getDashboardData,
      parseCookie,
      resolveDashboardRole,
    },
  };
}

module.exports = {
  createWebDashboardService,
};
