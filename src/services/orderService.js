const { createOrder } = require("../database/models/Order");
const roles = require("../config/roles");
const { createEmbed } = require("../utils/embed");
const {
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const { componentIds } = require("../utils/constants");
const { safeReply } = require("../utils/discordResponse");
const { isOwnerOrStaff } = require("../utils/permissionCheck");

function getModalValue(fields, ...candidateIds) {
  for (const fieldId of candidateIds) {
    if (!fieldId) continue;
    try {
      const raw = fields.getTextInputValue(fieldId);
      if (typeof raw === "string") {
        const value = raw.trim();
        if (value) return value;
      }
    } catch {
      // Ignore missing field IDs to keep backward compatibility.
    }
  }
  return "";
}

function extractProductFromText(raw, fallback = "Order") {
  if (!raw) return fallback;
  const firstChunk = raw.split(/\r?\n|\|/)[0] || "";
  const normalized = firstChunk
    .replace(/^game\s*:\s*/i, "")
    .replace(/^service\s*:\s*/i, "")
    .replace(/^item\s*:\s*/i, "")
    .replace(/^paket\s*\/\s*nominal\s*top\s*up\s*:\s*/i, "")
    .trim();
  return normalized || fallback;
}

function clampEmbedDescription(text, limit = 4096) {
  if (!text || typeof text !== "string") {
    return "-";
  }

  if (text.length <= limit) {
    return text;
  }

  const marker = "\n\n[Dipotong karena terlalu panjang]";
  return `${text.slice(0, Math.max(0, limit - marker.length))}${marker}`;
}

function firstMatch(text, patterns, fallback = "-") {
  const raw = String(text || "");
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return fallback;
}

function parseKeyValueText(...chunks) {
  const result = {};
  const text = chunks
    .filter(Boolean)
    .map((chunk) => String(chunk))
    .join("\n");

  for (const part of text.split(/\r?\n|\|/)) {
    const match = part.match(/^\s*([^:=]+?)\s*[:=]\s*(.+?)\s*$/);
    if (!match) continue;

    const key = match[1]
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    const value = match[2].trim();
    if (key && value) {
      result[key] = value;
    }
  }

  return result;
}

function pickParsed(parsed, keys, fallback = "-") {
  for (const key of keys) {
    if (parsed[key]) return parsed[key];
  }
  return fallback;
}

function detectPlatform(text) {
  const raw = String(text || "").toLowerCase();
  if (raw.includes("steam")) return "steam";
  if (raw.includes("epic")) return "epic";
  if (raw.includes("rockstar")) return "rockstar";
  if (raw.includes("ps5") || raw.includes("playstation")) return "playstation";
  if (raw.includes("xbox")) return "xbox";
  return "-";
}

function detectVersion(text, member) {
  const raw = String(text || "").toLowerCase();
  if (raw.includes("enhanced")) return "enhanced";
  if (raw.includes("legacy")) return "legacy";

  const roleNames = [...(member?.roles?.cache?.values?.() || [])]
    .map((role) => String(role.name || "").toLowerCase());
  if (roleNames.includes("enhanced")) return "enhanced";
  if (roleNames.includes("legacy")) return "legacy";
  return "-";
}

function normalizeLookupKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function normalizeJokiMethodKey(value, label = "") {
  const raw = `${String(value || "")} ${String(label || "")}`.toLowerCase();
  if (raw.includes("invite") || raw.includes("mabar")) return "via_invite_mabar";
  if (raw.includes("login")) return "login_akun";
  return normalizeLookupKey(value || label);
}

function normalizeJokiPlatformKey(value) {
  const raw = String(value || "").toLowerCase();
  if (raw.includes("steam")) return "steam";
  if (raw.includes("epic")) return "epic";
  if (raw.includes("rgl")) return "rockstar";
  if (raw === "rs" || raw === "r*") return "rockstar";
  if (raw.includes("rockstar")) return "rockstar";
  return "-";
}

function pickFirstNonEmptyField(formData, keys = [], fallback = "") {
  if (!formData || typeof formData !== "object") return fallback;
  for (const key of keys) {
    const value = formData?.[key];
    if (value === undefined || value === null) continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
  return fallback;
}

function normalizeJokiFormData(formData) {
  const source = formData && typeof formData === "object" ? formData : {};
  return {
    ...source,
    customer_name: pickFirstNonEmptyField(source, ["customer_name", "nama_customer", "customer"]),
    purchase_platform: pickFirstNonEmptyField(source, [
      "purchase_platform",
      "platform_pembelian",
      "platform_game",
      "platform",
    ]),
    launcher_login: pickFirstNonEmptyField(source, [
      "launcher_login",
      "launcher_account",
      "login_launcher",
      "login_steam_epic",
      "steam_epic_login",
    ]),
    rockstar_login: pickFirstNonEmptyField(source, [
      "rockstar_login",
      "rockstar_account",
      "login_rockstar",
      "rockstar_credentials",
    ]),
    target_order: pickFirstNonEmptyField(source, [
      "target_order",
      "target",
      "order_target",
      "targetrequest",
      "request_target",
    ]),
    rockstar_id: pickFirstNonEmptyField(source, [
      "rockstar_id",
      "account_id",
      "rockstar_username",
      "rockstar_user_id",
    ]),
    notes: pickFirstNonEmptyField(source, ["notes", "catatan", "note"]),
  };
}

function inferJokiPlatformKey(formData, launcherCred, rockstarCred) {
  const launcherRaw = String(formData?.launcher_login || "").trim();
  const composed = [
    String(formData?.purchase_platform || ""),
    String(formData?.launcher_login || ""),
    String(formData?.rockstar_login || ""),
  ].join(" ");
  const inferredByText = normalizeJokiPlatformKey(composed);
  if (inferredByText !== "-") return inferredByText;

  if (launcherRaw === "-" && rockstarCred.account && rockstarCred.password) {
    return "rockstar";
  }

  if (!launcherCred.account && !launcherCred.password && rockstarCred.account && rockstarCred.password) {
    return "rockstar";
  }

  return "-";
}

function formatJokiPlatformLabel(platformKey) {
  if (platformKey === "steam") return "Steam";
  if (platformKey === "epic") return "Epic Games";
  if (platformKey === "rockstar") return "Rockstar";
  return "-";
}

function parseCredentialPair(rawValue) {
  const raw = String(rawValue || "").trim();
  if (!raw || raw === "-") {
    return { account: "", password: "" };
  }

  const normalized = raw.replace(/\r?\n/g, " ").trim();
  let parts = null;
  const delimiters = ["|", ":", ";", " / ", " - "];
  for (const delimiter of delimiters) {
    if (!normalized.includes(delimiter)) continue;
    const candidate = normalized.split(delimiter).map((part) => part.trim()).filter(Boolean);
    if (candidate.length >= 2) {
      parts = candidate;
      break;
    }
  }

  if (!parts) {
    parts = normalized.split("|").map((part) => part.trim()).filter(Boolean);
  }
  if (parts.length < 2) {
    return { account: normalized, password: "" };
  }
  return {
    account: parts[0],
    password: parts.slice(1).join(" | "),
  };
}

const CHECKOUT_STEP = {
  SERVICE: "service",
  PRODUCT: "product",
  PACKAGE: "package",
  METHOD: "method",
  NEED_TYPE: "need_type",
  PAYMENT: "payment",
  CONFIRM: "confirm",
  COMPLETED: "completed",
};

const CHECKOUT_STEP_RANK = {
  [CHECKOUT_STEP.SERVICE]: 0,
  [CHECKOUT_STEP.PRODUCT]: 1,
  [CHECKOUT_STEP.PACKAGE]: 2,
  [CHECKOUT_STEP.METHOD]: 3,
  [CHECKOUT_STEP.NEED_TYPE]: 3,
  [CHECKOUT_STEP.PAYMENT]: 4,
  [CHECKOUT_STEP.CONFIRM]: 5,
  [CHECKOUT_STEP.COMPLETED]: 6,
};

function slugOption(label) {
  return String(label || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 90) || "option";
}

function option(label, value = null, description = "") {
  return {
    label,
    value: value || slugOption(label),
    description,
  };
}

const PAYMENT_OPTIONS = [
  option("QRIS"),
  option("DANA"),
  option("GOPAY"),
  option("OVO"),
  option("Bank Transfer", "bank_transfer"),
  option("Tanya Admin", "tanya_admin"),
];

function pricedOption(label, price, value = null, description = "") {
  const base = price ? `${label} - ${price}` : label;
  return option(base, value || slugOption(`${label}_${price || "item"}`), description);
}

const DIGITAL_PRICE_MAP = {
  windows_office_package: "Mulai Rp50.000",
  epic_games: "Mulai Rp180.000++",
  rockstar: "Rp180.000",
  steam: "Rp150.000",
};

const JOKI_PACKAGE_OPTIONS = [
  pricedOption("Paket Saudagar", "Rp89.000", "paket_saudagar"),
  pricedOption("Paket Juragan", "Rp149.000", "paket_juragan"),
  pricedOption("Paket Ningrat", "Rp299.000", "paket_ningrat"),
  pricedOption("Paket Raja", "Rp449.000", "paket_raja"),
  pricedOption("Paket Sultan", "Rp649.000", "paket_sultan"),
  option("Custom / Tanya Admin", "custom_admin"),
];

const JOKI_NONPAKET_OPTIONS = {
  special_bonus: [
    pricedOption("Ganti Gender", "Rp15.000"),
    pricedOption("Cayo + Casino Max Prep", "Rp20.000"),
    pricedOption("LSCM Prize Ride", "Rp20.000"),
    pricedOption("Casino Podium Car", "Rp20.000"),
  ],
  recovery: [
    pricedOption("K/D Reset", "Rp10.000"),
    pricedOption("Bad Sport Clean", "Rp15.000"),
    pricedOption("Race Wins", "Rp10.000"),
    pricedOption("Skill Unlock", "Rp10.000"),
  ],
  kendaraan: [
    pricedOption("1 Kendaraan", "Rp5.000"),
    pricedOption("5 Kendaraan", "Rp20.000"),
    pricedOption("10 Kendaraan", "Rp35.000"),
    pricedOption("15 Kendaraan", "Rp50.000"),
    pricedOption("20 Kendaraan", "Rp65.000"),
  ],
  money_heist: [
    pricedOption("1x Heist", "Rp2.500"),
    pricedOption("5x Heist", "Rp12.500"),
    pricedOption("10x Heist", "Rp25.000"),
    pricedOption("20x Heist", "Rp50.000"),
    pricedOption("50x Heist", "Rp120.000"),
    pricedOption("100x Heist", "Rp240.000"),
  ],
  rank_boost: [
    pricedOption("+100 Rank", "Rp20.000"),
    pricedOption("+250 Rank", "Rp35.000"),
    pricedOption("+500 Rank", "Rp60.000"),
    pricedOption("+1000 Rank", "Rp100.000"),
    pricedOption("+8000 Rank", "Rp200.000"),
    pricedOption("+1000 LSCM Rep", "Rp25.000"),
    pricedOption("Request Crew Rank", "Rp15.000"),
  ],
  max_stats: [
    pricedOption("Stamina", "Rp8.000"),
    pricedOption("Strength", "Rp8.000"),
    pricedOption("Shooting", "Rp8.000"),
    pricedOption("Stealth", "Rp8.000"),
    pricedOption("Driving", "Rp8.000"),
    pricedOption("Flying", "Rp8.000"),
    pricedOption("Lung Capacity", "Rp8.000"),
    pricedOption("Full Max Stats", "Rp35.000"),
  ],
  unlock_package: [
    pricedOption("All DLC", "Rp25.000"),
    pricedOption("Rare Weapons", "Rp15.000"),
    pricedOption("Services", "Rp15.000"),
    pricedOption("Fast Run", "Rp15.000"),
    pricedOption("Arena War", "Rp15.000"),
    pricedOption("All Trophies", "Rp15.000"),
    pricedOption("All Weapons", "Rp15.000"),
    pricedOption("All Ammo", "Rp10.000"),
    pricedOption("All Outfits", "Rp15.000"),
    pricedOption("All Liveries", "Rp15.000"),
    pricedOption("All Tattoos", "Rp10.000"),
    pricedOption("All Hairstyles", "Rp10.000"),
    pricedOption("All Masks", "Rp10.000"),
    pricedOption("All Accessories", "Rp10.000"),
    pricedOption("1 Modded Outfit", "Rp20.000"),
  ],
  property_bisnis: [
    pricedOption("CEO Office", "Rp10.000"),
    pricedOption("Kosatka", "Rp10.000"),
    pricedOption("Agency", "Rp10.000"),
    pricedOption("Arcade", "Rp10.000"),
    pricedOption("Nightclub", "Rp10.000"),
    pricedOption("Bunker", "Rp10.000"),
    pricedOption("Facility", "Rp10.000"),
    pricedOption("Auto Shop", "Rp10.000"),
    pricedOption("MC Clubhouse", "Rp8.000"),
    pricedOption("Hangar", "Rp10.000"),
    pricedOption("Penthouse", "Rp10.000"),
    pricedOption("Yacht", "Rp10.000"),
    pricedOption("Terrorbyte", "Rp15.000"),
    pricedOption("Avenger", "Rp15.000"),
    pricedOption("1 Mansion", "Rp10.000"),
    pricedOption("3 Mansion", "Rp20.000"),
    pricedOption("5 High-End Apartment", "Rp15.000"),
    pricedOption("8 High-End Apartment", "Rp20.000"),
    pricedOption("10 High-End Apartment", "Rp25.000"),
  ],
  migrasi: [
    pricedOption("Migrasi Legacy <-> Enhanced", "Rp10.000", "migrasi_legacy_enhanced"),
    option("Custom / Tanya Admin", "custom_admin"),
  ],
};

const CHECKOUT_SERVICES = {
  topup: {
    key: "topup",
    label: "Top Up",
    formType: "topup",
    productLabel: "Pilih game top up",
    packageLabel: "Pilih nominal / package top up",
    products: [
      option("Mobile Legends"),
      option("Free Fire"),
      option("Genshin Impact"),
      option("PUBG Mobile"),
      option("Custom / Tanya Admin", "custom_admin"),
    ],
    packages: [
      option("Basic"),
      option("Pro"),
      option("Sultan"),
      option("Custom Nominal", "custom_nominal"),
      option("Tanya Admin", "tanya_admin"),
    ],
    modalId: componentIds.orderTopupModal,
    modalTitle: "Form Data Order Top Up",
    formFields: [
      { id: "customer_name", label: "Nama customer", style: TextInputStyle.Short, required: true, maxLength: 80 },
      { id: "uid_game", label: "UID / ID game", style: TextInputStyle.Short, required: true, maxLength: 120 },
      { id: "username_game", label: "Username game (jika perlu)", style: TextInputStyle.Short, required: false, maxLength: 120 },
      { id: "server_zone", label: "Server / zone (jika ada)", style: TextInputStyle.Short, required: false, maxLength: 120 },
      { id: "nominal_topup", label: "Nominal top up", style: TextInputStyle.Short, required: true, maxLength: 120 },
      { id: "notes", label: "Catatan tambahan", style: TextInputStyle.Paragraph, required: false, maxLength: 500 },
    ],
  },
  joki: {
    key: "joki",
    label: "Joki",
    formType: "joki",
    productLabel: "Pilih kategori joki",
    packageLabel: "Pilih paket/item pricelist",
    products: [
      option("Paket Joki GTA V", "joki_paket"),
      option("Non Paket - Special / Bonus", "special_bonus"),
      option("Non Paket - Recovery", "recovery"),
      option("Non Paket - Kendaraan", "kendaraan"),
      option("Non Paket - Money Heist", "money_heist"),
      option("Non Paket - Rank Boost", "rank_boost"),
      option("Non Paket - Max Stats", "max_stats"),
      option("Non Paket - Unlock Package", "unlock_package"),
      option("Non Paket - Property / Bisnis", "property_bisnis"),
      option("Migrasi Saat Proses", "migrasi"),
      option("Custom / Tanya Admin", "custom_admin"),
    ],
    getPackages(draft) {
      const selectedProduct = String(draft?.data?.productValue || "");
      if (selectedProduct === "joki_paket") return JOKI_PACKAGE_OPTIONS;
      if (selectedProduct === "custom_admin") return [option("Custom / Tanya Admin", "custom_admin")];
      return [
        ...(JOKI_NONPAKET_OPTIONS[selectedProduct] || []),
        option("Custom / Tanya Admin", "custom_admin"),
      ];
    },
    followupStep: CHECKOUT_STEP.METHOD,
    followupLabel: "Pilih metode joki",
    followupOptions: [
      option("Login Akun", "login_akun"),
      option("Via Invite / Mabar", "via_invite_mabar"),
    ],
    collectFormAfterFollowup: true,
    resolveModalConfig(draft) {
      const method = normalizeJokiMethodKey(draft?.data?.methodValue, draft?.data?.methodLabel);
      if (method === "via_invite_mabar") {
        return {
          modalId: componentIds.orderJokiModal,
          modalTitle: "Form Joki GTA V - Via Invite / Mabar",
          formFields: [
            { id: "customer_name", label: "Nama customer", style: TextInputStyle.Short, required: true, maxLength: 80 },
            { id: "rockstar_id", label: "Username / ID Rockstar", style: TextInputStyle.Short, required: true, maxLength: 120 },
            { id: "target_order", label: "Target order", style: TextInputStyle.Paragraph, required: true, maxLength: 400 },
            { id: "notes", label: "Catatan tambahan", style: TextInputStyle.Paragraph, required: false, maxLength: 500 },
          ],
        };
      }

      return {
        modalId: componentIds.orderJokiModal,
        modalTitle: "Form Joki GTA V - Login Akun",
        formFields: [
          { id: "customer_name", label: "Nama customer", style: TextInputStyle.Short, required: true, maxLength: 80 },
          {
            id: "purchase_platform",
            label: "Platform pembelian game (Steam/Epic/Rockstar)",
            style: TextInputStyle.Short,
            required: true,
            maxLength: 60,
            placeholder: "Steam / Epic / Rockstar",
          },
          {
            id: "launcher_login",
            label: "Login Steam/Epic (user/email | password)",
            style: TextInputStyle.Paragraph,
            required: true,
            maxLength: 220,
            placeholder: "Isi '-' jika beli langsung di Rockstar",
          },
          {
            id: "rockstar_login",
            label: "Login Rockstar (user/email | password)",
            style: TextInputStyle.Paragraph,
            required: true,
            maxLength: 220,
          },
          { id: "target_order", label: "Target order + catatan", style: TextInputStyle.Paragraph, required: true, maxLength: 500 },
        ],
      };
    },
  },
  produk_digital: {
    key: "produk_digital",
    label: "Produk Digital",
    formType: "produkDigital",
    productLabel: "Pilih kategori produk digital",
    packageLabel: "Pilih item pricelist",
    products: [
      option("Windows / Office", "windows_office"),
      option("Game Account", "game_account"),
    ],
    getPackages(draft) {
      const selectedProduct = String(draft?.data?.productValue || "");
      if (selectedProduct === "windows_office") {
        return [
          option("Paket Windows / Office - Mulai Rp50.000", "windows_office_package"),
        ];
      }
      if (selectedProduct === "game_account") {
        return [
          option("Epic Games - Mulai Rp180.000++", "epic_games"),
          option("Rockstar - Rp180.000", "rockstar"),
          option("Steam - Rp150.000", "steam"),
        ];
      }
      return [];
    },
    resolveModalConfig(draft) {
      const selectedProduct = String(draft?.data?.productValue || "");
      if (selectedProduct === "game_account") {
        return {
          modalId: componentIds.orderGameAccountModal,
          modalTitle: "Form Data Game Account",
          formFields: [
            { id: "customer_name", label: "Nama customer", style: TextInputStyle.Short, required: true, maxLength: 80 },
            { id: "platform_account", label: "Platform akun (Steam/Epic/Rockstar)", style: TextInputStyle.Short, required: true, maxLength: 120 },
            { id: "game_name", label: "Game yang dicari", style: TextInputStyle.Short, required: true, maxLength: 120 },
            { id: "account_type", label: "Tipe akun", style: TextInputStyle.Short, required: true, maxLength: 120 },
            { id: "budget", label: "Budget", style: TextInputStyle.Short, required: true, maxLength: 120 },
            { id: "notes", label: "Catatan tambahan", style: TextInputStyle.Paragraph, required: false, maxLength: 500 },
          ],
        };
      }
      return {
        modalId: componentIds.orderWindowsModal,
        modalTitle: "Form Data Windows / Office",
        formFields: [
          { id: "customer_name", label: "Nama customer", style: TextInputStyle.Short, required: true, maxLength: 80 },
          { id: "version_name", label: "Versi Windows / Office", style: TextInputStyle.Short, required: true, maxLength: 120 },
          { id: "need_type", label: "Tipe kebutuhan", style: TextInputStyle.Short, required: true, maxLength: 120 },
          { id: "device_name", label: "Device / Laptop / PC", style: TextInputStyle.Short, required: true, maxLength: 120 },
          { id: "notes", label: "Catatan tambahan", style: TextInputStyle.Paragraph, required: false, maxLength: 500 },
        ],
      };
    },
  },
};

const CHECKOUT_SERVICE_KEY_ALIASES = {
  topup: "topup",
  top_up: "topup",
  joki: "joki",
  produk_digital: "produk_digital",
  produkdigital: "produk_digital",
  digital: "produk_digital",
};

function normalizeOrderStatusForDisplay(order) {
  const status = String(order?.status || "").toLowerCase();
  const paymentStatus = String(order?.paymentStatus || "").toLowerCase();

  if (["completed", "done", "selesai"].includes(status)) return "SELESAI";
  if (["cancelled", "canceled", "rejected", "declined"].includes(status) || ["cancelled", "canceled", "rejected", "declined"].includes(paymentStatus)) {
    return "DIBATALKAN";
  }
  if (["processing", "paid", "queued", "hold", "proses"].includes(status) || ["paid", "lunas"].includes(paymentStatus)) {
    return "DIPROSES";
  }
  if (["submitted", "waiting_confirmation", "waiting-confirmation"].includes(paymentStatus)) {
    return "MENUNGGU KONFIRMASI";
  }
  if (["waiting_admin", "admin_review"].includes(paymentStatus)) {
    return "MENUNGGU ADMIN";
  }
  if (["waiting", "pending", "waiting_payment", "waiting-payment"].includes(status) || ["unpaid", "waiting"].includes(paymentStatus)) {
    return "MENUNGGU PEMBAYARAN";
  }

  return "MENUNGGU ADMIN";
}

function mapRawStatusToFlowLabel(status) {
  const raw = String(status || "").toLowerCase();
  if (["completed", "done", "selesai"].includes(raw)) return "SELESAI";
  if (["cancelled", "canceled", "reject", "rejected", "declined"].includes(raw)) return "DIBATALKAN";
  if (["paid", "processing", "queued", "hold", "proses"].includes(raw)) return "DIPROSES";
  if (["waiting", "waiting_payment", "waiting-payment"].includes(raw)) return "MENUNGGU KONFIRMASI";
  if (["pending", "draft"].includes(raw)) return "MENUNGGU ADMIN";
  return "MENUNGGU ADMIN";
}

function buildOrderSummaryEmbed({ ticket, interaction, product, detail, meta, color, orderId, order }) {
  const formType = String(meta?.formType || ticket?.meta?.formType || "").toLowerCase();
  if (!["joki", "gta"].includes(formType)) {
    return null;
  }

  const gameText = meta?.gameInfo || meta?.gtaDetails || detail || "";
  const paymentText = meta?.paymentNote || meta?.budgetPayment || "";
  const parsed = parseKeyValueText(gameText, paymentText, meta?.targetDeadline);
  const item = firstMatch(gameText, [
    /item\s*[:=]\s*([^\n|]+)/i,
    /paket\s*(?:joki)?\s*[:=]\s*([^\n|]+)/i,
    /(?:money|uang)\s*[:=]\s*([^\n|]+)/i,
  ], pickParsed(parsed, ["item", "paket", "paket_joki", "money", "uang"], product || gameText || "-"));
  const price = firstMatch(paymentText, [
    /(?:harga|price|total|jumlah bayar)\s*[:=]\s*([^\n|]+)/i,
    /(rp\.?\s*[0-9][0-9.,]*)/i,
    /([0-9][0-9.,]*\s*(?:k|rb|ribu|jt|juta))/i,
  ], pickParsed(parsed, ["harga", "price", "total", "total_bayar", "jumlah_bayar"]));
  const method = firstMatch(paymentText, [
    /(?:metode|method)\s*[:=]\s*([^\n|]+)/i,
    /\b(bca|bri|dana|shopeepay|qris|gopay|ovo)\b/i,
  ], pickParsed(parsed, ["metode", "method", "metode_pembayaran", "login_via", "login"]));
  const rockstarId = firstMatch(gameText, [
    /rockstar(?:\s*id)?\s*[:=]\s*([^\n|]+)/i,
    /rid\s*[:=]\s*([^\n|]+)/i,
  ], pickParsed(parsed, ["rockstar_id", "rockstar", "rid"], meta?.customerName || "-"));
  const notes = pickParsed(parsed, ["notes", "note", "catatan", "request", "target", "deadline"], meta?.targetDeadline || meta?.budgetPayment || meta?.paymentNote || "-");
  const platform = pickParsed(parsed, ["platform"], detectPlatform(gameText));
  const version = pickParsed(parsed, ["versi", "version"], detectVersion(gameText, interaction.member));
  const paymentStatus = order?.paymentStatus || "-";
  const orderStatus = order?.status || "-";

  return createEmbed({
    title: "ORDER BARU",
    color,
    fields: [
      { name: "Order ID", value: orderId || `ORD-${ticket.id}`, inline: true },
      { name: "Nama", value: meta?.customerName || interaction.user.username || "-", inline: true },
      { name: "Service", value: product || "Joki Service", inline: true },
      { name: "Platform", value: platform || "-", inline: true },
      { name: "Versi", value: version || "-", inline: false },
      { name: "Rockstar ID", value: rockstarId || "-", inline: false },
      { name: "Item", value: item || "-", inline: false },
      { name: "Harga", value: price || "-", inline: true },
      { name: "Metode", value: method || "-", inline: true },
      { name: "Payment Status", value: paymentStatus, inline: true },
      { name: "Order Status", value: orderStatus, inline: true },
      { name: "Notes", value: notes || "-", inline: false },
    ],
    footer: interaction.guild?.name || "HYPERINDO",
  });
}

function buildInvoiceEmbed({ order, interaction }) {
  const checkoutSummary = String(order?.checkoutSummary || "").trim();
  const fallbackStatus = normalizeOrderStatusForDisplay(order);

  return createEmbed({
    title: `Invoice - ${order.id}`,
    description: checkoutSummary || undefined,
    color: 0xf1c40f,
    fields: [
      { name: "Nomor Invoice / Order ID", value: order.id, inline: false },
      { name: "Customer", value: `<@${order.userId}>`, inline: true },
      { name: "Customer Name", value: order.customerName || "-", inline: true },
      { name: "Layanan/Kategori", value: order.category || "-", inline: true },
      { name: "Produk", value: order.product || "-", inline: true },
      { name: "Paket", value: order.packageName || order.package || "-", inline: true },
      { name: "Metode/Kebutuhan", value: order.method || order.needType || "-", inline: true },
      { name: "Pembayaran", value: order.paymentMethod || "-", inline: true },
      { name: "SKU", value: order.sku || "-", inline: true },
      { name: "Total/Price", value: order.price || "-", inline: true },
      { name: "Payment Status", value: order.paymentStatus || "-", inline: true },
      { name: "Order Status", value: order.status || "-", inline: true },
      { name: "Flow Status", value: fallbackStatus, inline: true },
      { name: "Admin Handle", value: order.staffHandle ? `<@${order.staffHandle}>` : "-", inline: true },
      { name: "Admin Note", value: order.adminNote || "-", inline: false },
    ],
    footer: interaction.guild?.name || "HYPERINDO",
  });
}

function shouldShowCustomerOrderConfirm(order) {
  if (!order || typeof order !== "object") return false;
  if (order.customerConfirmedAt) return false;

  const flowStatus = normalizeOrderStatusForDisplay(order);
  return ["MENUNGGU ADMIN", "MENUNGGU PEMBAYARAN", "MENUNGGU KONFIRMASI"].includes(flowStatus);
}

function buildCustomerOrderConfirmRow(order, disabled = false) {
  if (!order?.id) return null;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(componentIds.orderCustomerConfirm)
      .setLabel(disabled ? "Order Terkonfirmasi" : "Konfirmasi Order")
      .setStyle(disabled ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setDisabled(Boolean(disabled)),
  );
}

function shouldShowAdminOrderConfirm(order) {
  if (!order || typeof order !== "object") return false;
  if (order.adminConfirmedAt) return false;
  const flowStatus = normalizeOrderStatusForDisplay(order);
  return flowStatus === "MENUNGGU ADMIN";
}

function buildAdminOrderConfirmRow(order, disabled = false) {
  if (!order?.id) return null;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(componentIds.orderAdminConfirm)
      .setLabel(disabled ? "Admin Terkonfirmasi" : "Konfirmasi Admin")
      .setStyle(disabled ? ButtonStyle.Secondary : ButtonStyle.Primary)
      .setDisabled(Boolean(disabled)),
  );
}

function buildOrderSummaryComponents(order) {
  if (!order) return [];
  const rows = [];

  if (order.customerConfirmedAt) {
    const doneRow = buildCustomerOrderConfirmRow(order, true);
    if (doneRow) rows.push(doneRow);
  } else if (shouldShowCustomerOrderConfirm(order)) {
    const customerRow = buildCustomerOrderConfirmRow(order, false);
    if (customerRow) rows.push(customerRow);
  }

  if (order.adminConfirmedAt) {
    const adminDoneRow = buildAdminOrderConfirmRow(order, true);
    if (adminDoneRow) rows.push(adminDoneRow);
  } else if (shouldShowAdminOrderConfirm(order)) {
    const adminRow = buildAdminOrderConfirmRow(order, false);
    if (adminRow) rows.push(adminRow);
  }

  return rows;
}

async function resolveInvoiceCustomerUser(interaction, order) {
  const targetUserId = String(order?.userId || "").trim();
  if (!targetUserId) return null;

  if (interaction?.user?.id === targetUserId && typeof interaction.user.send === "function") {
    return interaction.user;
  }

  const fetchedFromClient = await interaction?.client?.users?.fetch?.(targetUserId).catch(() => null);
  if (fetchedFromClient?.send) {
    return fetchedFromClient;
  }

  const member = await interaction?.guild?.members?.fetch?.(targetUserId).catch(() => null);
  if (member?.user?.send) {
    return member.user;
  }
  if (member?.send) {
    return member;
  }

  return null;
}

async function sendInvoiceEmbedToCustomer({ channel, interaction, order, orderId, repositories, invoiceEmbed, preferDm = true }) {
  const existingInvoiceMessageId = order?.invoiceMessageId || null;

  if (existingInvoiceMessageId && channel?.isTextBased?.()) {
    const existingMessage = await channel.messages.fetch(existingInvoiceMessageId).catch(() => null);
    if (existingMessage?.editable) {
      await existingMessage.edit({ embeds: [invoiceEmbed] }).catch(() => null);
      return { messageId: existingInvoiceMessageId, delivery: "ticket" };
    }
  }

  if (preferDm) {
    const dmUser = await resolveInvoiceCustomerUser(interaction, order);
    if (dmUser?.send) {
      const dmChannel = await dmUser.createDM?.().catch(() => null);
      if (existingInvoiceMessageId && dmChannel?.messages?.fetch) {
        const existingDmMessage = await dmChannel.messages.fetch(existingInvoiceMessageId).catch(() => null);
        if (existingDmMessage?.editable) {
          await existingDmMessage.edit({ embeds: [invoiceEmbed] }).catch(() => null);
          if (orderId && repositories?.orderRepository?.updateById) {
            await repositories.orderRepository.updateById(orderId, { invoiceDelivery: "dm" }).catch(() => null);
          }
          return { messageId: existingInvoiceMessageId, delivery: "dm" };
        }
      }

      const dmSent = await dmUser.send({
        embeds: [invoiceEmbed],
      }).catch(() => null);

      if (dmSent?.id) {
        if (orderId && repositories?.orderRepository?.updateById) {
          await repositories.orderRepository.updateById(orderId, {
            invoiceMessageId: dmSent.id,
            invoiceDelivery: "dm",
          }).catch(() => null);
        }
        return { messageId: dmSent.id, delivery: "dm" };
      }
    }
  }

  if (!channel?.isTextBased?.()) return null;

  const sent = await channel.send({
    content: interaction?.user ? `${interaction.user}` : undefined,
    embeds: [invoiceEmbed],
  }).catch(() => null);

  if (sent?.id && orderId && repositories?.orderRepository?.updateById) {
    await repositories.orderRepository.updateById(orderId, {
      invoiceMessageId: sent.id,
      invoiceDelivery: "ticket",
    }).catch(() => null);
  }

  if (!sent?.id) return null;
  return { messageId: sent.id, delivery: "ticket" };
}

async function sendOrEditInvoice({ channel, interaction, order, orderId, repositories }) {
  const invoiceEmbed = buildInvoiceEmbed({ order, interaction });
  await sendInvoiceEmbedToCustomer({
    channel,
    interaction,
    order,
    orderId,
    repositories,
    invoiceEmbed,
    preferDm: true,
  }).catch(() => null);
}

function buildJokiOrderFormatText({
  customerName,
  discordTag,
  whatsapp,
  gameInfo,
  targetDeadline,
  paymentNote,
}) {
  return [
    `NAMA: ${customerName || "-"}`,
    `USERNAME DISCORD: ${discordTag || "-"}`,
    `NOMOR WHATSAPP: ${whatsapp || "-"}`,
    `GAME / PLATFORM / LOGIN VIA / PAKET JOKI: ${gameInfo || "-"}`,
    `TARGET / REQUEST & DEADLINE: ${targetDeadline || "-"}`,
    `METODE PEMBAYARAN & CATATAN TAMBAHAN: ${paymentNote || "-"}`,
    "",
    "NOTE:",
    "DATA LOGIN AKUN JANGAN DIKIRIM DI CHANNEL PUBLIK.",
    "DATA LOGIN HANYA DIKIRIM MELALUI TICKET / CHAT ADMIN RESMI HYPERINDO.",
  ].join("\n");
}

function buildTopupOrderFormatText({
  customerName,
  discordTag,
  whatsapp,
  topupIdentity,
  topupPackage,
  topupPayment,
}) {
  return [
    "DATA CUSTOMER",
    `NAMA: ${customerName || "-"}`,
    `USERNAME DISCORD: ${discordTag || "-"}`,
    `NOMOR WHATSAPP: ${whatsapp || "-"}`,
    "",
    "DETAIL TOP UP",
    `GAME / NICKNAME / USER ID / SERVER ID: ${topupIdentity || "-"}`,
    `PAKET / NOMINAL / JUMLAH ORDER / CATATAN: ${topupPackage || "-"}`,
    "",
    "PAYMENT",
    `METODE PEMBAYARAN / TOTAL / BUKTI TRANSFER: ${topupPayment || "-"}`,
    "",
    "STATUS ORDER:",
    "MENUNGGU PAYMENT / PROSES / SELESAI",
  ].join("\n");
}

function buildGenericOrderFormatText({
  sections,
  customerName,
  discordTag,
  whatsapp,
  paymentInfo,
  note,
  statusLabel = "STATUS ORDER:",
  statusValue = "MENUNGGU PAYMENT / PROSES / SELESAI",
}) {
  const lines = [
    "DATA CUSTOMER",
    `NAMA: ${customerName || "-"}`,
    `USERNAME DISCORD: ${discordTag || "-"}`,
    `NOMOR WHATSAPP: ${whatsapp || "-"}`,
  ];

  for (const section of sections) {
    lines.push("", section.title);
    for (const [label, value] of section.fields) {
      lines.push(`${label}: ${value || "-"}`);
    }
  }

  if (paymentInfo !== undefined) {
    lines.push("", "PAYMENT", `METODE PEMBAYARAN / TOTAL / CATATAN: ${paymentInfo || "-"}`);
  }

  lines.push("", statusLabel, statusValue);

  if (note) {
    lines.push("", "NOTE:", note);
  }

  return lines.join("\n");
}

function createOrderService({
  botConfig,
  logger,
  repositories,
  ticketService,
  roleService,
  loggingService,
  getJokiService,
  statusSyncService,
}) {
  function logBestEffort(action, context, error) {
    logger?.warn?.(`${action} failed`, {
      ...(context || {}),
      message: error?.message || String(error),
    });
  }

  function shouldAutoQueueJoki(ticket) {
    const formType = String(ticket?.meta?.formType || "").toLowerCase();
    return ["joki", "gta"].includes(formType);
  }

  const pendingCheckoutSessions = new Map();

  async function openOrder(interaction, detail = "Order dari slash command") {
    const { ticket, channel, reused } = await ticketService.createTicketChannel(
      interaction.guild,
      interaction.member,
      "order",
      { detail },
    );

    const existingOrder = await repositories.orderRepository.findByTicketId(ticket.id);
    if (!existingOrder) {
      const newOrderId = await repositories.simpleStoreRepository.getNextOrderId(interaction.guild.id);
      await repositories.orderRepository.create(
        createOrder({
          id: newOrderId,
          guildId: interaction.guild.id,
          ticketId: ticket.id,
          channelId: ticket.channelId || channel?.id || "",
          userId: interaction.user.id,
          product: "Manual order",
          detail,
        }),
      );

      loggingService?.logOrder?.(
        interaction.guild,
        "Order Created",
        `Order \`${newOrderId}\` dibuat dari ticket #${ticket.id}.`,
        [
          { name: "Customer", value: interaction.user.tag, inline: true },
          { name: "Ticket", value: ticket.id, inline: true },
        ],
      ).catch(() => null);
    } else {
      const actorId = String(interaction.user?.id || "");
      const orderOwnerId = String(existingOrder?.userId || "");
      const ticketOwnerId = String(ticket?.openerId || "");
      const ownershipMismatch =
        (orderOwnerId && orderOwnerId !== actorId) ||
        (ticketOwnerId && ticketOwnerId !== actorId);

      // Re-open/reuse order is normal for customer flow.
      // Escalate to security log only when ownership mismatch looks suspicious.
      if (ownershipMismatch) {
        loggingService?.logSecurity?.(
          interaction.guild,
          "Order Reuse Ownership Mismatch",
          `Order reuse for ticket #${ticket.id} has ownership mismatch.`,
          [
            { name: "Actor", value: interaction.user.tag, inline: true },
            { name: "Actor ID", value: interaction.user.id, inline: true },
            { name: "Ticket", value: ticket.id, inline: true },
            { name: "TicketOwnerId", value: ticketOwnerId || "-", inline: true },
            { name: "OrderOwnerId", value: orderOwnerId || "-", inline: true },
            { name: "ExistingOrderId", value: existingOrder.id, inline: true },
          ],
        ).catch(() => null);
      }

      logger?.info?.("order reused", {
        guildId: interaction.guild?.id,
        ticketId: ticket.id,
        actorId: interaction.user?.id,
        existingOrderId: existingOrder.id,
        ownershipMismatch,
      });
    }

    return { ticket, channel, reused };
  }

  async function setOrderStatus(interaction, status) {
    const ticket = await repositories.ticketRepository.findByChannelId(interaction.channel.id);
    if (!ticket) {
      return {
        ok: false,
        message: "Command ini hanya bisa dipakai di ticket.",
      };
    }

    const syncResult = await statusSyncService?.syncTicketOrderQueueStatus({
      guildId: interaction.guild.id,
      ticketId: ticket.id,
      status,
      actorId: interaction.user.id,
      note: "Manual order status update",
      repositories,
    }).catch((error) => {
      logger?.error?.("manual order status sync failed", {
        guildId: interaction.guild.id,
        ticketId: ticket.id,
        status,
        actorId: interaction.user.id,
        message: error.message,
      });
      return null;
    });
    if (syncResult && !syncResult.ok) {
      logger?.warn?.("manual order sync partial failure", {
        guildId: interaction.guild.id,
        ticketId: ticket.id,
        status,
        errors: syncResult.errors,
      });
    }

    const nextFlowStatus = mapRawStatusToFlowLabel(status);
    await repositories.ticketRepository.update(ticket.id, {
      meta: {
        ...(ticket.meta || {}),
        orderFlowStatus: nextFlowStatus,
      },
    }).catch((error) => {
      logBestEffort("set order flow status meta", {
        guildId: interaction.guild.id,
        ticketId: ticket.id,
        status,
      }, error);
    });

    if (status === "completed") {
      const opener = await interaction.guild.members.fetch(ticket.openerId).catch((error) => {
        logBestEffort("fetch ticket opener", {
          guildId: interaction.guild.id,
          ticketId: ticket.id,
          openerId: ticket.openerId,
        }, error);
        return null;
      });
      if (opener) {
        await roleService.addRole(opener, roles.member);
      }

      await interaction.channel.send({
        content: "🎉 **Order Selesai!** Terima kasih telah mempercayakan order Anda di HYPEBOTX. Mohon luangkan waktu sejenak untuk memberikan testimoni.",
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(componentIds.testimoniButton)
              .setLabel("Berikan Testimoni")
              .setStyle(ButtonStyle.Success)
              .setEmoji("⭐")
          )
        ]
      }).catch((error) => {
        logBestEffort("send testimoni prompt", { channelId: interaction.channel.id }, error);
      });
    }

    await loggingService.logOrder(
      interaction.guild,
      "Order Status Updated",
      `Status order pada ticket #${ticket.id} diubah menjadi \`${status}\`.`,
      [{ name: "Staff", value: interaction.user.tag, inline: true }],
    );

    if (status === "paid") {
      await loggingService.logPayment(
        interaction.guild,
        "Payment Confirmed",
        `Ticket #${ticket.id} ditandai paid.`,
      );

      const result = shouldAutoQueueJoki(ticket)
        ? await getJokiService?.()?.startQueue?.(interaction, {
          ticketId: ticket.id,
          publishAction: "payment-accepted",
        }).catch((error) => {
          logger?.error?.("auto joki queue after paid status failed", {
            ticketId: ticket.id,
            message: error.message,
          });
          return null;
        })
        : null;

      if (result?.entry) {
        await interaction.channel.send(
          `[AUTO] Payment diterima. Ticket otomatis masuk antrian joki (Order ID: \`${result.entry.id}\`).`,
        ).catch((error) => {
          logBestEffort("send auto queue notice", {
            guildId: interaction.guild.id,
            ticketId: ticket.id,
            channelId: interaction.channel.id,
          }, error);
        });
      }

      const latestOrder = await repositories.orderRepository.findByTicketId(ticket.id).catch((error) => {
        logBestEffort("find latest order for paid hook", {
          guildId: interaction.guild.id,
          ticketId: ticket.id,
        }, error);
        return null;
      });
      if (latestOrder) {
        const detailText =
          ticket?.meta?.detail ||
          ticket?.meta?.paymentNote ||
          ticket?.meta?.budgetPayment ||
          latestOrder.detail ||
          "-";

        await sendOrderSummary(
          interaction.channel,
          "ORDER BARU",
          String(detailText),
          0x57f287,
          {
            ticket,
            interaction,
            product: latestOrder.product,
            order: latestOrder,
            meta: ticket?.meta || {},
          },
          latestOrder.id,
          ticket.id,
        ).catch((error) => {
          logBestEffort("send order summary in paid hook", {
            guildId: interaction.guild.id,
            ticketId: ticket.id,
            orderId: latestOrder.id,
          }, error);
        });

        await sendOrEditInvoice({
          channel: interaction.channel,
          interaction,
          order: latestOrder,
          orderId: latestOrder.id,
          repositories,
        }).catch((error) => {
          logBestEffort("send invoice in paid hook", {
            guildId: interaction.guild.id,
            ticketId: ticket.id,
            orderId: latestOrder.id,
          }, error);
        });
      }
    }

    return {
      ok: true,
      ticket,
    };
  }

  async function closeOrder(interaction, finalStatus = "completed") {
    const statusResult = await setOrderStatus(interaction, finalStatus);
    if (!statusResult.ok) {
      return statusResult;
    }

    const closedTicket = await ticketService.closeTicket(interaction, `Order closed with status ${finalStatus}`);
    return {
      ok: Boolean(closedTicket),
      ticket: closedTicket,
    };
  }

  async function upsertOrderRecord({ ticket, interaction, product, detail }) {
    const formType = ticket.meta?.formType || "general";
    const customerName = ticket.meta?.customerName || "";
    const existingOrder = await repositories.orderRepository.findByTicketId(ticket.id);
    if (!existingOrder) {
      const newOrderId = await repositories.simpleStoreRepository.getNextOrderId(interaction.guild.id);
      await repositories.orderRepository.create(
        createOrder({
          id: newOrderId,
          guildId: interaction.guild.id,
          ticketId: ticket.id,
          channelId: ticket.channelId || interaction.channel?.id || "",
          userId: interaction.user.id,
          customerName,
          category: formType,
          product,
          detail,
          status: "pending",
          paymentStatus: "unpaid",
        }),
      );
      await repositories.userRepository?.incrementOrder?.(interaction.guild.id, interaction.user.id, interaction.user.tag);
      return newOrderId;
    }

    await repositories.orderRepository.updateByTicketId(ticket.id, {
      customerName,
      category: formType,
      product,
      detail,
      status: "pending",
    });
    return existingOrder.id;
  }

  async function sendOrderSummary(channel, title, detail, color = 0x57f287, context = null, orderId = null, ticketId = null) {
    if (!channel?.isTextBased?.()) {
      return;
    }

    // Priority 1: edit the same embed (orderSummaryMessageId) if available
    let existingOrder = null;
    if (orderId && repositories?.orderRepository?.findById) {
      existingOrder = await repositories.orderRepository.findById(orderId).catch(() => null);
    }

    const summaryEmbed = context
      ? buildOrderSummaryEmbed({
        ...context,
        detail,
        color,
        orderId,
        order: context?.order || existingOrder || null,
      })
      : null;
    const fallbackEmbed = createEmbed({
      title,
      description: clampEmbedDescription(detail, 4096),
      color,
    });
    const summaryOrder = existingOrder || context?.order || null;
    const summaryComponents = buildOrderSummaryComponents(summaryOrder);

    const existingMessageId = existingOrder?.orderSummaryMessageId || null;
    if (existingMessageId) {
      const messageToEdit = await channel.messages.fetch(existingMessageId).catch(() => null);
      if (messageToEdit?.editable) {
        await messageToEdit.edit({
          content: context?.interaction?.user ? `${context.interaction.user}` : undefined,
          embeds: [summaryEmbed || fallbackEmbed],
          components: summaryComponents,
        }).catch((error) => {
          logBestEffort("edit order summary", { channelId: channel.id, messageId: existingMessageId }, error);
        });
        return;
      }
    }

    // Otherwise create a new summary message and persist messageId
    const sent = await channel.send({
      content: context?.interaction?.user ? `${context.interaction.user}` : undefined,
      embeds: [summaryEmbed || fallbackEmbed],
      components: summaryComponents,
    }).catch((error) => {
      logBestEffort("send order summary", { channelId: channel.id, title }, error);
      return null;
    });

    if (sent?.id && orderId && repositories?.orderRepository?.updateById) {
      await repositories.orderRepository.updateById(orderId, { orderSummaryMessageId: sent.id }).catch(() => null);
    }

    // Spawn Quick Action Panel after creating new order summary
    if (!existingMessageId && context?.interaction?.client?.container?.services?.backlogService?.postQuickActionPanel) {
      await context.interaction.client.container.services.backlogService.postQuickActionPanel({
        channel: channel,
        guild: channel.guild
      }).catch(() => null);
    }

    // keep backward-compat: if only ticketId is available
    if (sent?.id && !orderId && ticketId && repositories?.orderRepository?.updateByTicketId) {
      await repositories.orderRepository.updateByTicketId(ticketId, { orderSummaryMessageId: sent.id }).catch(() => null);
    }
  }

  async function saveOrderForm(interaction, {
    summaryTitle,
    product,
    detail,
    meta,
  }) {
    const relatedTicket = await repositories.ticketRepository.findByChannelId(interaction.channel.id);
    const safeDetail = clampEmbedDescription(detail, 4096);

    // Jika modal diisi dari dalam channel ticket order milik customer, update data order yang sama.
    if (relatedTicket && relatedTicket.type === "order" && relatedTicket.openerId === interaction.user.id) {
      await repositories.ticketRepository.update(relatedTicket.id, {
        meta: {
          ...(relatedTicket.meta || {}),
          ...meta,
          detail: safeDetail,
          source: "modal",
        },
      });

      const orderId = await upsertOrderRecord({
        ticket: relatedTicket,
        interaction,
        product,
        detail: safeDetail,
      });

      await interaction.editReply({
        content: `[OK] Format order tersimpan (${orderId}). Lanjut klik tombol PAYMENT untuk kirim bukti bayar.`,
      });

      await sendOrderSummary(
        interaction.channel,
        summaryTitle,
        safeDetail,
        0x57f287,
        {
          ticket: relatedTicket,
          interaction,
          product,
          meta,
          orderId,
        },
        orderId,
        relatedTicket.id,
      );
      await loggingService.logOrder(interaction.guild, summaryTitle, safeDetail, [
        { name: "Order ID", value: orderId, inline: true },
        { name: "Customer", value: interaction.user.tag, inline: true },
      ]).catch((error) => {
        logBestEffort("log order summary existing ticket", {
          guildId: interaction.guild.id,
          ticketId: relatedTicket.id,
        }, error);
      });
      return;
    }

    const { ticket, channel } = await ticketService.createTicketChannel(
      interaction.guild,
      interaction.member,
      "order",
      {
        ...meta,
        detail: safeDetail,
        source: "modal",
      },
    );

    let fullDetail = typeof safeDetail === "string" ? safeDetail : "";

    const userProfile = await repositories.userRepository?.find?.(interaction.guild.id, interaction.user.id);
    if (userProfile && userProfile.tier && userProfile.tier !== "new") {
      const tierMap = { "vip": "10%", "gold": "5%", "silver": "Prioritas Antrian" };
      const benefit = tierMap[userProfile.tier] || "";
      if (benefit) {
        fullDetail += `\n\n⭐ **Loyalty Benefit (${userProfile.tier.toUpperCase()}):** ${benefit}`;
      }
    }

    const orderId = await upsertOrderRecord({
      ticket,
      interaction,
      product,
      detail: fullDetail,
    });

    await interaction.editReply({
      content: `Order ticket kamu sudah dibuat di ${channel} (${orderId}).`,
    });

    await sendOrderSummary(channel, summaryTitle, fullDetail, 0x57f287, {
      ticket,
      interaction,
      product,
      meta,
      orderId,
    });
    await loggingService.logOrder(interaction.guild, summaryTitle, safeDetail, [
      { name: "Order ID", value: orderId, inline: true },
      { name: "Customer", value: interaction.user.tag, inline: true },
    ]).catch((error) => {
      logBestEffort("log order summary new ticket", {
        guildId: interaction.guild.id,
        ticketId: ticket.id,
      }, error);
    });
  }

  async function handleOrderFormModal(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const customerName = getModalValue(interaction.fields, "customer_name");
    const whatsapp = getModalValue(interaction.fields, "whatsapp");
    const gameInfo = getModalValue(interaction.fields, "game_info", "product");
    const targetDeadline = getModalValue(interaction.fields, "target_deadline", "detail");
    const paymentNote = getModalValue(interaction.fields, "payment_note", "contact");

    const product = extractProductFromText(gameInfo, "Order Joki");
    const detail = buildJokiOrderFormatText({
      customerName,
      discordTag: interaction.user.tag,
      whatsapp,
      gameInfo,
      targetDeadline,
      paymentNote,
    });

    await saveOrderForm(interaction, {
      summaryTitle: "FORMAT ORDER JOKI HYPERINDO",
      product,
      detail,
      meta: {
        formType: "joki",
        customerName,
        whatsapp,
        gameInfo,
        targetDeadline,
        paymentNote,
      },
    });
  }

  async function handleTopupFormModal(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const customerName = getModalValue(interaction.fields, "customer_name");
    const whatsapp = getModalValue(interaction.fields, "whatsapp");
    const topupIdentity = getModalValue(interaction.fields, "topup_identity");
    const topupPackage = getModalValue(interaction.fields, "topup_package");
    const topupPayment = getModalValue(interaction.fields, "topup_payment");

    const product = extractProductFromText(topupIdentity, "Order Top Up");
    const detail = buildTopupOrderFormatText({
      customerName,
      discordTag: interaction.user.tag,
      whatsapp,
      topupIdentity,
      topupPackage,
      topupPayment,
    });

    await saveOrderForm(interaction, {
      summaryTitle: "FORMAT ORDER TOP UP HYPERINDO",
      product,
      detail,
      meta: {
        formType: "topup",
        customerName,
        whatsapp,
        topupIdentity,
        topupPackage,
        topupPayment,
      },
    });
  }

  async function handleWarrantyModal(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const product = interaction.fields.getTextInputValue("product");
    const issue = interaction.fields.getTextInputValue("issue");
    const { channel } = await ticketService.createTicketChannel(interaction.guild, interaction.member, "warranty", {
      product,
      issue,
      source: "modal",
    });

    await interaction.editReply({
      content: `Warranty ticket kamu sudah dibuat di ${channel}.`,
    });
  }

  async function handleWindowsLicenseModal(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const customerName = getModalValue(interaction.fields, "customer_name");
    const whatsapp = getModalValue(interaction.fields, "whatsapp");
    const windowsDetails = getModalValue(interaction.fields, "windows_details");
    const activation = getModalValue(interaction.fields, "windows_status_activation");
    const paymentDetails = getModalValue(interaction.fields, "payment_details");

    const detail = buildGenericOrderFormatText({
      customerName,
      discordTag: interaction.user.tag,
      whatsapp,
      sections: [
        {
          title: "DETAIL ORDER",
          fields: [
            ["PRODUK / EDISI / JUMLAH LISENSI / DEVICE", windowsDetails],
            ["STATUS WINDOWS / BUTUH BANTU AKTIVASI", activation],
          ],
        },
      ],
      paymentInfo: paymentDetails,
      note: "PASTIKAN EDISI WINDOWS SESUAI DENGAN DEVICE KAMU.\nJANGAN KIRIM PASSWORD PC DI CHANNEL PUBLIK.",
    });

    await saveOrderForm(interaction, {
      summaryTitle: "FORMAT ORDER LISENSI WINDOWS HYPERINDO",
      product: extractProductFromText(windowsDetails, "Lisensi Windows"),
      detail,
      meta: { formType: "windows", customerName, whatsapp, windowsDetails, activation, paymentDetails },
    });
  }

  async function handleOfficeLicenseModal(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const customerName = getModalValue(interaction.fields, "customer_name");
    const whatsapp = getModalValue(interaction.fields, "whatsapp");
    const officeDetails = getModalValue(interaction.fields, "office_details");
    const activationGuide = getModalValue(interaction.fields, "activation_guide");
    const paymentDetails = getModalValue(interaction.fields, "payment_details");

    const detail = buildGenericOrderFormatText({
      customerName,
      discordTag: interaction.user.tag,
      whatsapp,
      sections: [
        {
          title: "DETAIL ORDER",
          fields: [
            ["PRODUK / JUMLAH LISENSI / DEVICE", officeDetails],
            ["BUTUH PANDUAN AKTIVASI / CATATAN", activationGuide],
          ],
        },
      ],
      paymentInfo: paymentDetails,
      note: "PASTIKAN PRODUK OFFICE SESUAI KEBUTUHAN.\nJANGAN KIRIM PASSWORD PC DI CHANNEL PUBLIK.",
    });

    await saveOrderForm(interaction, {
      summaryTitle: "FORMAT ORDER OFFICE KEY HYPERINDO",
      product: extractProductFromText(officeDetails, "Office Key"),
      detail,
      meta: { formType: "office", customerName, whatsapp, officeDetails, activationGuide, paymentDetails },
    });
  }

  async function handleOptimizerModal(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const customerName = getModalValue(interaction.fields, "customer_name");
    const whatsapp = getModalValue(interaction.fields, "whatsapp");
    const deviceSpecs = getModalValue(interaction.fields, "device_specs");
    const optimizerGoals = getModalValue(interaction.fields, "optimizer_goals");
    const additionalServices = getModalValue(interaction.fields, "additional_services");

    const detail = buildGenericOrderFormatText({
      customerName,
      discordTag: interaction.user.tag,
      whatsapp,
      sections: [
        { title: "DETAIL DEVICE", fields: [["SPESIFIKASI DEVICE", deviceSpecs]] },
        {
          title: "DETAIL OPTIMIZER",
          fields: [
            ["TUJUAN / KELUHAN UTAMA", optimizerGoals],
            ["LAYANAN TAMBAHAN / JADWAL", additionalServices],
          ],
        },
      ],
      paymentInfo: "",
      note: "JANGAN KIRIM PASSWORD PC DI CHANNEL PUBLIK.\nJIKA BUTUH REMOTE, ADMIN AKAN PANDU LEWAT TICKET / CHAT PRIVATE.",
    });

    await saveOrderForm(interaction, {
      summaryTitle: "FORMAT ORDER OPTIMIZER WINDOWS HYPERINDO",
      product: "Optimizer Windows",
      detail,
      meta: { formType: "optimizer", customerName, whatsapp, deviceSpecs, optimizerGoals, additionalServices },
    });
  }

  async function handleGameAccountModal(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const customerName = getModalValue(interaction.fields, "customer_name");
    const whatsapp = getModalValue(interaction.fields, "whatsapp");
    const gameDetails = getModalValue(interaction.fields, "game_details");
    const accountRequest = getModalValue(interaction.fields, "account_request");
    const paymentInfo = getModalValue(interaction.fields, "payment_info");

    const detail = buildGenericOrderFormatText({
      customerName,
      discordTag: interaction.user.tag,
      whatsapp,
      sections: [
        {
          title: "DETAIL AKUN",
          fields: [
            ["GAME / JENIS AKUN / PAKET / LOGIN VIA", gameDetails],
            ["REQUEST KHUSUS / BUDGET", accountRequest],
          ],
        },
      ],
      paymentInfo,
      note: "STOK AKUN TANYA ADMIN TERLEBIH DAHULU.\nDATA AKUN DIKIRIM SETELAH PAYMENT SELESAI.",
    });

    await saveOrderForm(interaction, {
      summaryTitle: "FORMAT ORDER JUAL AKUN GAME HYPERINDO",
      product: extractProductFromText(gameDetails, "Akun Game"),
      detail,
      meta: { formType: "gameAccount", customerName, whatsapp, gameDetails, accountRequest, paymentInfo },
    });
  }

  async function handleGtaAccountModal(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const customerName = getModalValue(interaction.fields, "customer_name");
    const whatsapp = getModalValue(interaction.fields, "whatsapp");
    const accountType = getModalValue(interaction.fields, "gta_account_type");
    const gtaDetails = getModalValue(interaction.fields, "gta_details");
    const budgetPayment = getModalValue(interaction.fields, "budget_payment");

    const detail = buildGenericOrderFormatText({
      customerName,
      discordTag: interaction.user.tag,
      whatsapp,
      sections: [
        {
          title: "DETAIL AKUN GTA",
          fields: [
            ["JENIS AKUN", accountType],
            ["PLATFORM / LOGIN VIA / REQUEST LEVEL-UANG-ITEM", gtaDetails],
            ["BUDGET / METODE PEMBAYARAN", budgetPayment],
          ],
        },
      ],
      paymentInfo: "",
      note: "HARGA AKUN POLOSAN MULAI DARI 150K.\nSTOK TANYA ADMIN.",
    });

    await saveOrderForm(interaction, {
      summaryTitle: "FORMAT ORDER AKUN GTA HYPERINDO",
      product: "Akun GTA",
      detail,
      meta: { formType: "gta", customerName, whatsapp, accountType, gtaDetails, budgetPayment },
    });
  }

  async function handleDiscordServerModal(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const customerName = getModalValue(interaction.fields, "customer_name");
    const whatsapp = getModalValue(interaction.fields, "whatsapp");
    const serverDetails = getModalValue(interaction.fields, "server_details");
    const serverFeatures = getModalValue(interaction.fields, "server_features");
    const paymentInfo = getModalValue(interaction.fields, "payment_info");

    const detail = buildGenericOrderFormatText({
      customerName,
      discordTag: interaction.user.tag,
      whatsapp,
      sections: [
        {
          title: "DETAIL SERVER",
          fields: [
            ["JENIS / TEMA / JUMLAH CHANNEL / JUMLAH ROLE", serverDetails],
            ["BOT / LOGO-BANNER / DEADLINE", serverFeatures],
          ],
        },
      ],
      paymentInfo,
    });

    await saveOrderForm(interaction, {
      summaryTitle: "FORMAT ORDER JASA SERVER DISCORD HYPERINDO",
      product: "Jasa Server Discord",
      detail,
      meta: { formType: "discordServer", customerName, whatsapp, serverDetails, serverFeatures, paymentInfo },
    });
  }

  async function handleBundlePackageModal(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const customerName = getModalValue(interaction.fields, "customer_name");
    const whatsapp = getModalValue(interaction.fields, "whatsapp");
    const bundleName = getModalValue(interaction.fields, "bundle_name");
    const bundleContents = getModalValue(interaction.fields, "bundle_contents");
    const paymentDeadline = getModalValue(interaction.fields, "payment_deadline");

    const detail = buildGenericOrderFormatText({
      customerName,
      discordTag: interaction.user.tag,
      whatsapp,
      sections: [
        {
          title: "DETAIL BUNDLE",
          fields: [
            ["PAKET BUNDLE YANG DIPILIH", bundleName],
            ["ISI PAKET / GAME-PRODUK / REQUEST TAMBAHAN", bundleContents],
            ["DEADLINE / METODE BAYAR / TOTAL", paymentDeadline],
          ],
        },
      ],
      paymentInfo: "",
      note: "PAKET BUNDLE BISA BERISI JOKI, AKUN, TOP UP, OPTIMIZER, WINDOWS / OFFICE KEY, ATAU JASA DISCORD.",
    });

    await saveOrderForm(interaction, {
      summaryTitle: "FORMAT ORDER PAKET BUNDLE HYPERINDO",
      product: extractProductFromText(bundleName, "Paket Bundle"),
      detail,
      meta: { formType: "bundle", customerName, whatsapp, bundleName, bundleContents, paymentDeadline },
    });
  }

  function normalizeLookupKey(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  }

  function getCheckoutServiceByKey(serviceKey) {
    if (!serviceKey) return null;
    const raw = normalizeLookupKey(serviceKey);
    const resolved = CHECKOUT_SERVICE_KEY_ALIASES[raw] || raw;
    return CHECKOUT_SERVICES[resolved] || null;
  }

  function listCheckoutServices() {
    return [
      CHECKOUT_SERVICES.topup,
      CHECKOUT_SERVICES.joki,
      CHECKOUT_SERVICES.produk_digital,
    ].filter(Boolean);
  }

  function mapOptionValueToLabel(options = [], value = "") {
    const target = String(value || "");
    const found = options.find((entry) => entry.value === target);
    return found?.label || target;
  }

  function findOptionByLabel(options = [], label = "") {
    const target = normalizeLookupKey(label);
    if (!target) return null;
    return options.find((entry) => normalizeLookupKey(entry?.label) === target) || null;
  }

  function getServiceProducts(definition) {
    return Array.isArray(definition?.products) ? definition.products : [];
  }

  function getServicePackages(definition, draft) {
    if (!definition) return [];
    if (typeof definition.getPackages === "function") {
      return definition.getPackages(draft) || [];
    }
    return Array.isArray(definition.packages) ? definition.packages : [];
  }

  function getServiceFollowupStep(definition, draft) {
    if (!definition) return null;
    if (typeof definition.resolveFollowupStep === "function") {
      return definition.resolveFollowupStep(draft);
    }
    return definition.followupStep || null;
  }

  function getServiceFollowupLabel(definition, draft) {
    if (!definition) return "";
    if (typeof definition.resolveFollowupLabel === "function") {
      return definition.resolveFollowupLabel(draft) || "";
    }
    return definition.followupLabel || "";
  }

  function getServiceFollowupOptions(definition, draft) {
    if (!definition) return [];
    if (typeof definition.resolveFollowupOptions === "function") {
      return definition.resolveFollowupOptions(draft) || [];
    }
    return Array.isArray(definition.followupOptions) ? definition.followupOptions : [];
  }

  function shouldCollectFormAfterFollowup(definition, draft) {
    if (!definition) return false;
    if (typeof definition.resolveCollectFormAfterFollowup === "function") {
      return Boolean(definition.resolveCollectFormAfterFollowup(draft));
    }
    return Boolean(definition.collectFormAfterFollowup);
  }

  function resolveCheckoutModalConfig(definition, draft) {
    if (!definition) return null;
    if (typeof definition.resolveModalConfig === "function") {
      return definition.resolveModalConfig(draft);
    }
    if (!definition.modalId || !definition.modalTitle || !Array.isArray(definition.formFields)) {
      return null;
    }
    return {
      modalId: definition.modalId,
      modalTitle: definition.modalTitle,
      formFields: definition.formFields,
    };
  }

  function getCheckoutServiceByModalId(modalId, draft = null) {
    const value = String(modalId || "");
    if (!value) return null;

    if (draft?.data?.serviceKey) {
      const serviceByDraft = getCheckoutServiceByKey(draft.data.serviceKey);
      if (serviceByDraft) {
        const modalConfig = resolveCheckoutModalConfig(serviceByDraft, draft);
        if (modalConfig?.modalId === value) return serviceByDraft;
      }
    }

    return listCheckoutServices().find((service) => {
      const probeDraft = createCheckoutDraft("probe", { data: { serviceKey: service.key, productValue: "" } });
      const modalConfig = resolveCheckoutModalConfig(service, probeDraft);
      if (modalConfig?.modalId === value) return true;
      if (service.key === "produk_digital" && [componentIds.orderWindowsModal, componentIds.orderGameAccountModal].includes(value)) {
        return true;
      }
      return false;
    }) || null;
  }

  function resolveCheckoutPrice(definition, draft) {
    const data = draft?.data || {};
    const packageValue = String(data.packageValue || "");
    const packageLabel = String(data.packageLabel || "");
    const formData = data.formData || {};

    if (definition?.key === "produk_digital") {
      return DIGITAL_PRICE_MAP[packageValue] || packageLabel || "-";
    }

    if (definition?.key === "topup") {
      return getFormFieldValue(formData, "nominal_topup", packageLabel || "-");
    }

    const priceMatch = packageLabel.match(/Rp[0-9.,+]+/i);
    if (priceMatch?.[0]) return priceMatch[0];
    return packageLabel || "-";
  }

  function buildCheckoutSessionKey(guildId, userId) {
    return `${guildId}:${userId}`;
  }

  async function getPendingCheckoutSession(guildId, userId) {
    const sessionKey = buildCheckoutSessionKey(guildId, userId);
    const inMemory = pendingCheckoutSessions.get(sessionKey);
    if (inMemory) return inMemory;

    const persisted = await repositories.simpleStoreRepository?.getPendingCheckoutSession?.(guildId, userId).catch(() => null);
    if (persisted && typeof persisted === "object") {
      pendingCheckoutSessions.set(sessionKey, persisted);
      return persisted;
    }

    return null;
  }

  async function persistPendingCheckoutSession(guildId, userId, draft) {
    const sessionKey = buildCheckoutSessionKey(guildId, userId);
    const payload = {
      ...draft,
      updatedAt: new Date().toISOString(),
    };
    pendingCheckoutSessions.set(sessionKey, payload);

    await repositories.simpleStoreRepository?.setPendingCheckoutSession?.(guildId, userId, payload).catch((error) => {
      logBestEffort("persist pending checkout session", { guildId, userId }, error);
    });

    return payload;
  }

  async function clearPendingCheckoutSession(guildId, userId) {
    const sessionKey = buildCheckoutSessionKey(guildId, userId);
    pendingCheckoutSessions.delete(sessionKey);
    await repositories.simpleStoreRepository?.clearPendingCheckoutSession?.(guildId, userId).catch((error) => {
      logBestEffort("clear pending checkout session", { guildId, userId }, error);
    });
  }

  function shouldRemoveLegacyNavigatorComponent(component) {
    const customId = String(component?.customId || component?.data?.custom_id || "");
    const rawLabel = String(component?.label || component?.data?.label || "").trim();
    const label = rawLabel.replace(/^[^\p{L}\p{N}]+/u, "").trim().toLowerCase();

    if ([componentIds.customerNavBackButton, componentIds.customerNavRepeatButton].includes(customId)) {
      return true;
    }

    return label === "kembali" || label === "ulangi";
  }

  async function cleanupLegacyNavigatorButtons(channel) {
    if (!channel?.messages?.fetch) return;

    const fetched = await channel.messages.fetch({ limit: 40 }).catch(() => null);
    if (!fetched) return;

    let messages = [];
    if (typeof fetched.values === "function") {
      messages = [...fetched.values()];
    } else if (Array.isArray(fetched)) {
      messages = fetched;
    } else {
      return;
    }

    for (const message of messages) {
      if (!message?.editable || !message?.author?.bot) continue;
      if (!Array.isArray(message.components) || !message.components.length) continue;

      let changed = false;
      const nextRows = [];

      for (const row of message.components) {
        const sourceComponents = Array.isArray(row?.components) ? row.components : [];
        if (!sourceComponents.length) continue;

        const kept = sourceComponents.filter((component) => !shouldRemoveLegacyNavigatorComponent(component));
        if (kept.length !== sourceComponents.length) {
          changed = true;
        }

        if (!kept.length) continue;
        nextRows.push({
          type: 1,
          components: kept.map((component) => (typeof component?.toJSON === "function" ? component.toJSON() : component)),
        });
      }

      if (!changed) continue;
      await message.edit({ components: nextRows }).catch(() => null);
    }
  }

  function resetCheckoutData() {
    return {
      serviceKey: "",
      serviceLabel: "",
      productValue: "",
      productLabel: "",
      packageValue: "",
      packageLabel: "",
      methodValue: "",
      methodLabel: "",
      needTypeValue: "",
      needTypeLabel: "",
      paymentValue: "",
      paymentLabel: "",
      formData: {},
    };
  }

  function createCheckoutDraft(userId, existingDraft = null) {
    const now = new Date().toISOString();
    const base = existingDraft && typeof existingDraft === "object" ? existingDraft : {};
    const data = base.data && typeof base.data === "object" ? base.data : {};

    return {
      version: 2,
      userId: base.userId || userId,
      guildId: base.guildId || "",
      channelId: base.channelId || "",
      step: base.step || CHECKOUT_STEP.SERVICE,
      history: Array.isArray(base.history) ? base.history : [],
      orderId: base.orderId || null,
      ticketId: base.ticketId || null,
      ticketChannelId: base.ticketChannelId || null,
      invoiceReady: Boolean(base.invoiceReady),
      messageId: base.messageId || null,
      data: {
        serviceKey: data.serviceKey || "",
        serviceLabel: data.serviceLabel || "",
        productValue: data.productValue || "",
        productLabel: data.productLabel || "",
        packageValue: data.packageValue || "",
        packageLabel: data.packageLabel || "",
        methodValue: data.methodValue || "",
        methodLabel: data.methodLabel || "",
        needTypeValue: data.needTypeValue || "",
        needTypeLabel: data.needTypeLabel || "",
        paymentValue: data.paymentValue || "",
        paymentLabel: data.paymentLabel || "",
        formData: data.formData && typeof data.formData === "object" ? data.formData : {},
      },
      updatedAt: now,
    };
  }

  function isStepAfter(currentStep, baseStep) {
    return (CHECKOUT_STEP_RANK[currentStep] ?? -1) > (CHECKOUT_STEP_RANK[baseStep] ?? -1);
  }

  function sanitizeCheckoutDraft(draft) {
    if (!draft || typeof draft !== "object") {
      return createCheckoutDraft("unknown");
    }
    if (!draft.data || typeof draft.data !== "object") {
      draft.data = resetCheckoutData();
    }

    const data = draft.data;
    const services = listCheckoutServices();
    let definition = getCheckoutServiceByKey(data.serviceKey);
    const serviceByLabel = services.find((service) => normalizeLookupKey(service.label) === normalizeLookupKey(data.serviceLabel));

    if (serviceByLabel && (!definition || serviceByLabel.key !== definition.key)) {
      data.serviceKey = serviceByLabel.key;
      definition = serviceByLabel;
    }

    if (!definition) {
      if (serviceByLabel) {
        data.serviceKey = serviceByLabel.key;
        definition = serviceByLabel;
      }
    }

    if (!definition) {
      return resetCheckoutDraft(draft);
    }

    data.serviceLabel = definition.label;

    const products = getServiceProducts(definition);
    let selectedProduct =
      products.find((entry) => String(entry.value) === String(data.productValue || "")) ||
      findOptionByLabel(products, data.productLabel);

    if (!selectedProduct && definition.key === "joki") {
      const legacyJokiText = `${data.productLabel || ""} ${data.productValue || ""}`;
      if (/gta\s*v?/i.test(legacyJokiText)) {
        selectedProduct = products.find((entry) => entry.value === "joki_paket") || null;
      }
    }

    if (!selectedProduct) {
      data.productValue = "";
      data.productLabel = "";
      data.packageValue = "";
      data.packageLabel = "";
      data.methodValue = "";
      data.methodLabel = "";
      data.needTypeValue = "";
      data.needTypeLabel = "";
      data.paymentValue = "";
      data.paymentLabel = "";
      data.formData = {};
      if (isStepAfter(draft.step, CHECKOUT_STEP.PRODUCT)) {
        draft.step = CHECKOUT_STEP.PRODUCT;
      }
      return draft;
    }

    data.productValue = selectedProduct.value;
    data.productLabel = selectedProduct.label;

    const packageOptions = getServicePackages(definition, draft);
    const selectedPackage =
      packageOptions.find((entry) => String(entry.value) === String(data.packageValue || "")) ||
      findOptionByLabel(packageOptions, data.packageLabel);

    if (!selectedPackage) {
      data.packageValue = "";
      data.packageLabel = "";
      data.methodValue = "";
      data.methodLabel = "";
      data.needTypeValue = "";
      data.needTypeLabel = "";
      data.paymentValue = "";
      data.paymentLabel = "";
      data.formData = {};
      if (isStepAfter(draft.step, CHECKOUT_STEP.PACKAGE)) {
        draft.step = CHECKOUT_STEP.PACKAGE;
      }
      return draft;
    }

    data.packageValue = selectedPackage.value;
    data.packageLabel = selectedPackage.label;

    if (!data.formData || typeof data.formData !== "object") {
      data.formData = {};
    }

    const followupStep = getServiceFollowupStep(definition, draft);
    const collectFormAfterFollowup = shouldCollectFormAfterFollowup(definition, draft);

    if (followupStep === CHECKOUT_STEP.METHOD) {
      const options = getServiceFollowupOptions(definition, draft);
      const selectedMethod =
        options.find((entry) => String(entry.value) === String(data.methodValue || "")) ||
        findOptionByLabel(options, data.methodLabel);
      if (selectedMethod) {
        data.methodValue = selectedMethod.value;
        data.methodLabel = selectedMethod.label;
      } else {
        data.methodValue = "";
        data.methodLabel = "";
        if (isStepAfter(draft.step, CHECKOUT_STEP.METHOD)) {
          draft.step = CHECKOUT_STEP.METHOD;
        }
      }
      data.needTypeValue = "";
      data.needTypeLabel = "";
    } else if (followupStep === CHECKOUT_STEP.NEED_TYPE) {
      const options = getServiceFollowupOptions(definition, draft);
      const selectedNeedType =
        options.find((entry) => String(entry.value) === String(data.needTypeValue || "")) ||
        findOptionByLabel(options, data.needTypeLabel);
      if (selectedNeedType) {
        data.needTypeValue = selectedNeedType.value;
        data.needTypeLabel = selectedNeedType.label;
      } else {
        data.needTypeValue = "";
        data.needTypeLabel = "";
        if (isStepAfter(draft.step, CHECKOUT_STEP.NEED_TYPE)) {
          draft.step = CHECKOUT_STEP.NEED_TYPE;
        }
      }
      data.methodValue = "";
      data.methodLabel = "";
    } else {
      data.methodValue = "";
      data.methodLabel = "";
      data.needTypeValue = "";
      data.needTypeLabel = "";
    }

    const hasFormData = Object.values(data.formData).some((value) => String(value || "").trim());
    if (!hasFormData) {
      if (!collectFormAfterFollowup && isStepAfter(draft.step, CHECKOUT_STEP.PACKAGE)) {
        draft.step = CHECKOUT_STEP.PACKAGE;
        data.methodValue = "";
        data.methodLabel = "";
        data.needTypeValue = "";
        data.needTypeLabel = "";
        data.paymentValue = "";
        data.paymentLabel = "";
        return draft;
      }

      if (collectFormAfterFollowup) {
        const baseStep = followupStep || CHECKOUT_STEP.PACKAGE;
        if (isStepAfter(draft.step, baseStep)) {
          draft.step = baseStep;
          data.paymentValue = "";
          data.paymentLabel = "";
        }
      }
    }

    const selectedPayment =
      PAYMENT_OPTIONS.find((entry) => String(entry.value) === String(data.paymentValue || "")) ||
      findOptionByLabel(PAYMENT_OPTIONS, data.paymentLabel);
    if (selectedPayment) {
      data.paymentValue = selectedPayment.value;
      data.paymentLabel = selectedPayment.label;
    } else {
      data.paymentValue = "";
      data.paymentLabel = "";
      if (isStepAfter(draft.step, CHECKOUT_STEP.PAYMENT)) {
        draft.step = CHECKOUT_STEP.PAYMENT;
      }
    }

    if (draft.invoiceReady) {
      draft.step = CHECKOUT_STEP.COMPLETED;
      draft.history = [];
    } else if (draft.step === CHECKOUT_STEP.COMPLETED) {
      draft.step = CHECKOUT_STEP.CONFIRM;
    }

    return draft;
  }

  function resetCheckoutDraft(draft) {
    draft.step = CHECKOUT_STEP.SERVICE;
    draft.history = [];
    draft.orderId = null;
    draft.ticketId = null;
    draft.ticketChannelId = null;
    draft.invoiceReady = false;
    draft.data = resetCheckoutData();
    return draft;
  }

  function pushCheckoutHistory(draft, step) {
    if (!step) return;
    const history = Array.isArray(draft.history) ? draft.history : [];
    const last = history.length ? history[history.length - 1] : null;
    if (last !== step) {
      history.push(step);
    }
    draft.history = history;
  }

  function createSelectRow(customId, placeholder, options = []) {
    const safeOptions = options.length ? options : [option("Belum ada opsi", "not_available", "Data belum tersedia")];
    const menu = new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        safeOptions.slice(0, 25).map((entry) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(entry.label.slice(0, 100))
            .setValue(String(entry.value || slugOption(entry.label)).slice(0, 100))
            .setDescription((entry.description || entry.label || "").slice(0, 100)),
        ),
      );
    return new ActionRowBuilder().addComponents(menu);
  }

  function buildCheckoutNavRow(draft) {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(componentIds.orderBack)
        .setLabel("Back")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!Array.isArray(draft.history) || draft.history.length === 0),
      new ButtonBuilder()
        .setCustomId(componentIds.orderCancel)
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Danger),
    );
  }

  function buildCheckoutConfirmRow() {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(componentIds.orderConfirmInvoice)
        .setLabel("Confirm")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(componentIds.orderBack)
        .setLabel("Back")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(componentIds.orderCancel)
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Danger),
    );
  }

  function resolveCheckoutStepLabel(draft) {
    const step = String(draft?.step || CHECKOUT_STEP.SERVICE);
    if (step === CHECKOUT_STEP.SERVICE) return "Pilih layanan utama";
    if (step === CHECKOUT_STEP.PRODUCT) return "Pilih kategori / produk";
    if (step === CHECKOUT_STEP.PACKAGE) return "Pilih paket / pricelist";
    if (step === CHECKOUT_STEP.METHOD) return "Pilih metode";
    if (step === CHECKOUT_STEP.NEED_TYPE) return "Pilih kebutuhan";
    if (step === CHECKOUT_STEP.PAYMENT) return "Pilih metode pembayaran";
    if (step === CHECKOUT_STEP.CONFIRM) return "Review order";
    if (step === CHECKOUT_STEP.COMPLETED) return "Checkout selesai";
    return "Checkout";
  }

  function resolveCheckoutFlowText(draft) {
    const definition = getCheckoutServiceByKey(draft?.data?.serviceKey);
    if (!definition) {
      return "Flow: layanan -> kategori/produk -> paket -> (metode/kebutuhan jika diminta) -> isi form -> pembayaran -> review -> confirm -> ticket.";
    }

    const followupStep = getServiceFollowupStep(definition, draft);
    if (followupStep === CHECKOUT_STEP.METHOD) {
      return "Flow: layanan -> kategori/produk -> paket -> metode -> isi form -> pembayaran -> review -> confirm -> ticket.";
    }
    if (followupStep === CHECKOUT_STEP.NEED_TYPE) {
      return "Flow: layanan -> kategori/produk -> paket -> kebutuhan -> isi form -> pembayaran -> review -> confirm -> ticket.";
    }

    return "Flow: layanan -> kategori/produk -> paket -> isi form -> pembayaran -> review -> confirm -> ticket.";
  }

  function isCustomLike(text) {
    const raw = String(text || "").toLowerCase();
    return ["custom", "tanya admin", "request manual", "request custom"].some((keyword) => raw.includes(keyword));
  }

  function shouldWaitAdmin(definition, draft) {
    const data = draft?.data || {};
    const serviceKey = String(definition?.key || "");
    const productKey = String(data.productValue || "");
    const needsStockCheck = serviceKey === "produk_digital" && productKey === "game_account";
    const formValues = Object.values(data.formData || {}).map((value) => String(value || "")).join(" ");
    const joined = [
      data.productLabel,
      data.packageLabel,
      data.methodLabel,
      data.needTypeLabel,
      data.paymentLabel,
      formValues,
    ].join(" ");
    return needsStockCheck || isCustomLike(joined);
  }

  function buildCheckoutEmbed(ticket, draft) {
    const data = draft?.data || {};
    const definition = getCheckoutServiceByKey(data.serviceKey);
    const waitingAdminHint = shouldWaitAdmin(definition, draft);
    const scopeText = ticket?.id
      ? `Ticket #${ticket.id}`
      : "Checkout Panel (ticket dibuat setelah confirm)";
    const footerText = draft?.invoiceReady
      ? (waitingAdminHint
        ? "Invoice dibuat. Menunggu admin, jangan transfer dulu."
        : "Invoice dibuat. Lanjut upload bukti pembayaran di ticket.")
      : "Lengkapi step bertahap sampai review dan confirm.";

    return createEmbed({
      title: "Checkout ORDER",
      color: 0x5865f2,
      description: [
        scopeText,
        `Step: **${resolveCheckoutStepLabel(draft)}**`,
        "",
        resolveCheckoutFlowText(draft),
        "Data login akun hanya boleh dibagikan di ticket private.",
        draft?.ticketChannelId ? `Ticket: <#${draft.ticketChannelId}>` : null,
      ].filter(Boolean).join("\n"),
      fields: [
        { name: "Layanan", value: data.serviceLabel || "-", inline: true },
        { name: "Kategori/Produk", value: data.productLabel || "-", inline: true },
        { name: "Paket", value: data.packageLabel || "-", inline: true },
        { name: "Metode", value: data.methodLabel || "-", inline: true },
        { name: "Kebutuhan", value: data.needTypeLabel || "-", inline: true },
        { name: "Pembayaran", value: data.paymentLabel || "-", inline: true },
      ],
      footer: { text: footerText },
    });
  }

  function buildCheckoutComponents(draft) {
    const rows = [];
    const definition = getCheckoutServiceByKey(draft?.data?.serviceKey);

    switch (draft?.step) {
      case CHECKOUT_STEP.SERVICE: {
        const options = listCheckoutServices().map((service) =>
          option(service.label, service.key, `${service.label} checkout flow`),
        );
        rows.push(createSelectRow(componentIds.orderServiceSelect, "Pilih layanan utama", options));
        rows.push(buildCheckoutNavRow(draft));
        break;
      }
      case CHECKOUT_STEP.PRODUCT: {
        if (!definition) return [buildCheckoutNavRow(draft)];
        rows.push(createSelectRow(componentIds.orderProductSelect, definition.productLabel, getServiceProducts(definition, draft)));
        rows.push(buildCheckoutNavRow(draft));
        break;
      }
      case CHECKOUT_STEP.PACKAGE: {
        if (!definition) return [buildCheckoutNavRow(draft)];
        rows.push(createSelectRow(componentIds.orderPackageSelect, definition.packageLabel, getServicePackages(definition, draft)));
        rows.push(buildCheckoutNavRow(draft));
        break;
      }
      case CHECKOUT_STEP.METHOD: {
        if (!definition) return [buildCheckoutNavRow(draft)];
        rows.push(createSelectRow(
          componentIds.orderMethodSelect,
          getServiceFollowupLabel(definition, draft) || "Pilih metode",
          getServiceFollowupOptions(definition, draft),
        ));
        rows.push(buildCheckoutNavRow(draft));
        break;
      }
      case CHECKOUT_STEP.NEED_TYPE: {
        if (!definition) return [buildCheckoutNavRow(draft)];
        rows.push(createSelectRow(
          componentIds.orderNeedTypeSelect,
          getServiceFollowupLabel(definition, draft) || "Pilih kebutuhan",
          getServiceFollowupOptions(definition, draft),
        ));
        rows.push(buildCheckoutNavRow(draft));
        break;
      }
      case CHECKOUT_STEP.PAYMENT: {
        rows.push(createSelectRow(componentIds.orderPaymentSelect, "Pilih metode pembayaran", PAYMENT_OPTIONS));
        rows.push(buildCheckoutNavRow(draft));
        break;
      }
      case CHECKOUT_STEP.CONFIRM: {
        rows.push(buildCheckoutConfirmRow());
        break;
      }
      case CHECKOUT_STEP.COMPLETED: {
        break;
      }
      default: {
        rows.push(buildCheckoutNavRow(draft));
      }
    }

    return rows;
  }

  async function persistCheckoutDraft(ticket, draft, extraMeta = {}) {
    const checkout = {
      ...draft,
      updatedAt: new Date().toISOString(),
    };
    const nextMeta = {
      ...(ticket.meta || {}),
      ...extraMeta,
      checkout,
    };

    return repositories.ticketRepository.update(ticket.id, {
      meta: nextMeta,
    });
  }

  async function renderCheckoutPanelMessage(channel, ticket, draft, preferredMessageId = null) {
    const payload = {
      embeds: [buildCheckoutEmbed(ticket, draft)],
      components: buildCheckoutComponents(draft),
    };

    const messageId = preferredMessageId || draft?.messageId || ticket?.meta?.checkout?.messageId || null;
    if (messageId) {
      const existing = await channel.messages.fetch(messageId).catch(() => null);
      if (existing?.editable) {
        await existing.edit(payload).catch(() => null);
        draft.messageId = messageId;
        return messageId;
      }
    }

    const sent = await channel.send(payload).catch(() => null);
    draft.messageId = sent?.id || null;
    return draft.messageId;
  }

  function buildCheckoutModal(modalConfig) {
    const modal = new ModalBuilder()
      .setCustomId(modalConfig.modalId)
      .setTitle(modalConfig.modalTitle);

    for (const field of modalConfig.formFields) {
      const input = new TextInputBuilder()
        .setCustomId(field.id)
        .setLabel(field.label)
        .setStyle(field.style || TextInputStyle.Short)
        .setRequired(field.required !== false);
      if (field.placeholder) input.setPlaceholder(field.placeholder);
      if (field.maxLength) input.setMaxLength(field.maxLength);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
    }

    return modal;
  }

  function resolveInitialCheckoutStatus(definition, draft) {
    const needsAdmin = shouldWaitAdmin(definition, draft);
    if (needsAdmin) {
      return {
        flowLabel: "MENUNGGU ADMIN",
        orderStatus: "pending",
        paymentStatus: "waiting_admin",
      };
    }

    return {
      flowLabel: "MENUNGGU PEMBAYARAN",
      orderStatus: "waiting",
      paymentStatus: "unpaid",
    };
  }

  function getFormFieldValue(formData, key, fallback = "-") {
    const value = formData?.[key];
    if (value === undefined || value === null) return fallback;
    const normalized = String(value).trim();
    return normalized || fallback;
  }

  function appendWaitingAdminNote(lines, statusLabel) {
    if (String(statusLabel || "").toUpperCase() === "MENUNGGU ADMIN") {
      return [...lines, "Catatan: jangan transfer dulu. Tunggu konfirmasi admin terlebih dahulu."];
    }
    return lines;
  }

  function buildCheckoutInvoiceLines(orderId, definition, draft, statusLabel) {
    const data = draft?.data || {};
    const formData = definition?.key === "joki"
      ? normalizeJokiFormData(data.formData || {})
      : (data.formData || {});
    const serviceLabel = definition?.label || data.serviceLabel || "-";
    const priceText = resolveCheckoutPrice(definition, draft);

    if (definition?.key === "joki") {
      const methodKey = normalizeJokiMethodKey(data.methodValue, data.methodLabel);
      const targetOrder = getFormFieldValue(formData, "target_order");
      const notes = getFormFieldValue(formData, "notes");

      if (methodKey === "via_invite_mabar") {
        return appendWaitingAdminNote([
          "INVOICE ORDER JOKI",
          `Order ID: ${orderId}`,
          `Layanan: ${serviceLabel}`,
          `Kategori: ${data.productLabel || "-"}`,
          `Paket/Item: ${data.packageLabel || "-"}`,
          `Harga: ${priceText}`,
          `Nama: ${getFormFieldValue(formData, "customer_name")}`,
          `Rockstar Username / ID: ${getFormFieldValue(formData, "rockstar_id", getFormFieldValue(formData, "account_id"))}`,
          `Target Order: ${targetOrder}`,
          `Catatan: ${notes}`,
          `Metode Joki: ${data.methodLabel || "-"}`,
          `Pembayaran: ${data.paymentLabel || "-"}`,
          `Status: ${statusLabel}`,
        ], statusLabel);
      }

      const launcherCredential = parseCredentialPair(getFormFieldValue(formData, "launcher_login", ""));
      const rockstarCredential = parseCredentialPair(getFormFieldValue(formData, "rockstar_login", ""));
      const platformText = getFormFieldValue(formData, "purchase_platform", "");
      const platformKey = (() => {
        const normalized = normalizeJokiPlatformKey(platformText);
        if (normalized !== "-") return normalized;
        return inferJokiPlatformKey(formData, launcherCredential, rockstarCredential);
      })();
      const launcherAccountLabel = platformKey === "epic"
        ? "Akun Epic"
        : platformKey === "steam"
          ? "Akun Steam"
          : "Akun Launcher";

      return appendWaitingAdminNote([
        "INVOICE ORDER JOKI",
        `Order ID: ${orderId}`,
        `Layanan: ${serviceLabel}`,
        `Kategori: ${data.productLabel || "-"}`,
        `Paket/Item: ${data.packageLabel || "-"}`,
        `Harga: ${priceText}`,
        `Nama: ${getFormFieldValue(formData, "customer_name")}`,
        `Platform Pembelian: ${formatJokiPlatformLabel(platformKey)}`,
        `${launcherAccountLabel}: ${launcherCredential.account || "-"}`,
        `Akun Rockstar: ${rockstarCredential.account || "-"}`,
        "Password Login: disimpan private di ticket.",
        `Target Order: ${targetOrder}`,
        `Metode Joki: ${data.methodLabel || "-"}`,
        `Pembayaran: ${data.paymentLabel || "-"}`,
        `Status: ${statusLabel}`,
      ], statusLabel);
    }

    if (definition?.key === "topup") {
      return appendWaitingAdminNote([
        "INVOICE ORDER TOP UP",
        `Order ID: ${orderId}`,
        `Layanan: ${serviceLabel}`,
        `Game: ${data.productLabel || getFormFieldValue(formData, "game_name")}`,
        `Nominal/Paket: ${data.packageLabel || "-"}`,
        `Harga/Nominal: ${priceText}`,
        `Nama: ${getFormFieldValue(formData, "customer_name")}`,
        `UID / ID Game: ${getFormFieldValue(formData, "uid_game")}`,
        `Username: ${getFormFieldValue(formData, "username_game")}`,
        `Server / Zona: ${getFormFieldValue(formData, "server_zone")}`,
        `Catatan: ${getFormFieldValue(formData, "notes")}`,
        `Pembayaran: ${data.paymentLabel || "-"}`,
        `Status: ${statusLabel}`,
      ], statusLabel);
    }

    if (String(data.productValue || "") === "windows_office") {
      return appendWaitingAdminNote([
        "INVOICE ORDER PRODUK DIGITAL",
        `Order ID: ${orderId}`,
        `Layanan: ${serviceLabel}`,
        "Kategori: Windows / Office",
        `Produk/Paket: ${data.packageLabel || "-"}`,
        `Harga: ${priceText}`,
        `Nama: ${getFormFieldValue(formData, "customer_name")}`,
        `Versi: ${getFormFieldValue(formData, "version_name")}`,
        `Tipe Kebutuhan: ${getFormFieldValue(formData, "need_type")}`,
        `Device: ${getFormFieldValue(formData, "device_name")}`,
        `Catatan: ${getFormFieldValue(formData, "notes")}`,
        `Pembayaran: ${data.paymentLabel || "-"}`,
        `Status: ${statusLabel}`,
      ], statusLabel);
    }

    return appendWaitingAdminNote([
      "INVOICE ORDER PRODUK DIGITAL",
      `Order ID: ${orderId}`,
      `Layanan: ${serviceLabel}`,
      "Kategori: Game Account",
      `Produk/Paket: ${data.packageLabel || "-"}`,
      `Harga: ${priceText}`,
      `Nama: ${getFormFieldValue(formData, "customer_name")}`,
      `Platform: ${data.packageLabel || getFormFieldValue(formData, "platform_account")}`,
      `Game Dicari: ${getFormFieldValue(formData, "game_name")}`,
      `Tipe Akun: ${getFormFieldValue(formData, "account_type")}`,
      `Budget: ${getFormFieldValue(formData, "budget")}`,
      `Catatan: ${getFormFieldValue(formData, "notes")}`,
      `Pembayaran: ${data.paymentLabel || "-"}`,
      `Status: ${statusLabel}`,
      "Catatan: admin wajib cek stok dulu sebelum konfirmasi final.",
    ], statusLabel);
  }

  async function sendOrEditCheckoutInvoice({ channel, interaction, order, orderId, lines }) {
    const embed = createEmbed({
      title: `Invoice - ${orderId}`,
      description: clampEmbedDescription(lines.join("\n"), 3900),
      color: 0xf1c40f,
      fields: [
        { name: "Order ID", value: orderId, inline: true },
        { name: "Customer", value: `<@${order.userId}>`, inline: true },
        { name: "Status", value: normalizeOrderStatusForDisplay(order), inline: true },
      ],
    });

    const sent = await sendInvoiceEmbedToCustomer({
      channel,
      interaction,
      order,
      orderId,
      repositories,
      invoiceEmbed: embed,
      preferDm: true,
    }).catch(() => null);

    return sent?.messageId || null;
  }

  async function resolveCheckoutContext(interaction, options = {}) {
    const ticket = await repositories.ticketRepository.findByChannelId(interaction.channel.id).catch(() => null);
    if (ticket?.type === "order") {
      const draft = sanitizeCheckoutDraft(createCheckoutDraft(interaction.user.id, ticket?.meta?.checkout));
      return {
        mode: "ticket",
        ticket,
        channel: interaction.channel,
        draft,
      };
    }

    const allowLoosePanel = Boolean(options?.allowLoosePanel);
    const session = await getPendingCheckoutSession(interaction.guild.id, interaction.user.id);
    if (!session) return null;
    if (!allowLoosePanel) {
      if (session.channelId && session.channelId !== interaction.channel.id) return null;
      if (interaction.message?.id && session.messageId && interaction.message.id !== session.messageId) return null;
    }

    return {
      mode: "panel",
      ticket: null,
      channel: interaction.channel,
      draft: sanitizeCheckoutDraft(createCheckoutDraft(interaction.user.id, session)),
    };
  }

  async function notifyCheckoutSessionMissing(interaction) {
    await safeReply(interaction, {
      content: "Sesi checkout kamu sudah tidak aktif. Klik panel ORDER lagi untuk mulai checkout baru.",
      flags: MessageFlags.Ephemeral,
    }).catch(() => null);
  }

  async function assertCheckoutOwnership(interaction, context) {
    if (!context) return false;
    if (context.mode === "ticket") {
      if (context.ticket.openerId === interaction.user.id) return true;
      await safeReply(interaction, {
        content: "Hanya pemilik ticket yang bisa melanjutkan checkout.",
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
      return false;
    }

    if (context.draft.userId && context.draft.userId !== interaction.user.id) {
      await safeReply(interaction, {
        content: "Checkout ini bukan milik kamu.",
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
      return false;
    }

    return true;
  }

  async function persistCheckoutContext(interaction, context, draft, extraMeta = {}) {
    draft.userId = interaction.user.id;
    draft.guildId = interaction.guild.id;
    draft.channelId = interaction.channel.id;
    draft.updatedAt = new Date().toISOString();

    if (context.mode === "ticket" && context.ticket) {
      return persistCheckoutDraft(context.ticket, draft, {
        checkoutFlowVersion: 2,
        ...extraMeta,
      });
    }

    await persistPendingCheckoutSession(interaction.guild.id, interaction.user.id, draft);
    return draft;
  }

  async function refreshCheckoutMessage(context, draft, preferredMessageId = null) {
    const messageId = await renderCheckoutPanelMessage(
      context.channel,
      context.ticket,
      draft,
      preferredMessageId || draft.messageId,
    );
    draft.messageId = messageId;
    return messageId;
  }

  async function removeCheckoutPanelMessage(channel, messageId) {
    const targetMessageId = String(messageId || "").trim();
    if (!targetMessageId) return false;
    if (!channel?.messages?.fetch) return false;

    const message = await channel.messages.fetch(targetMessageId).catch(() => null);
    if (!message || typeof message.delete !== "function") return false;
    await message.delete().catch(() => null);
    return true;
  }

  function validateJokiCheckoutData(draft) {
    const data = draft?.data || {};
    const formData = normalizeJokiFormData(data.formData || {});
    const methodKey = normalizeJokiMethodKey(data.methodValue, data.methodLabel);

    if (methodKey === "via_invite_mabar") {
      const rockstarId = String(formData.rockstar_id || formData.account_id || "").trim();
      if (!rockstarId) {
        return "Untuk metode Via Invite / Mabar, isi Username / ID Rockstar.";
      }
      if (!String(formData.target_order || "").trim()) {
        return "Untuk metode Via Invite / Mabar, isi target order terlebih dahulu.";
      }
      return null;
    }

    if (methodKey !== "login_akun") {
      return "Metode joki tidak valid. Pilih Login Akun atau Via Invite / Mabar.";
    }

    const launcherCred = parseCredentialPair(formData.launcher_login);
    const rockstarCred = parseCredentialPair(formData.rockstar_login);
    let platformKey = normalizeJokiPlatformKey(formData.purchase_platform);
    if (platformKey === "-") {
      platformKey = inferJokiPlatformKey(formData, launcherCred, rockstarCred);
    }

    if (platformKey === "-") {
      return "Untuk Login Akun, isi platform pembelian game: Steam, Epic, atau Rockstar.";
    }

    if (!rockstarCred.account || !rockstarCred.password) {
      return "Untuk Login Akun, isi login Rockstar dengan format: user/email | password.";
    }

    if (["steam", "epic"].includes(platformKey)) {
      if (!launcherCred.account || !launcherCred.password) {
        const launcherLabel = platformKey === "steam" ? "Steam" : "Epic";
        return `Untuk Login Akun (${launcherLabel}), isi login ${launcherLabel} dengan format: user/email | password.`;
      }
    }

    if (!String(formData.target_order || "").trim()) {
      return "Untuk Login Akun, isi target order terlebih dahulu.";
    }

    return null;
  }

  function validateCheckoutBeforeConfirm(definition, draft) {
    if (!definition) return "Layanan belum dipilih.";
    if (!draft.data?.packageLabel) return "Paket/pricelist belum dipilih.";
    if (!draft.data?.paymentLabel) return "Metode pembayaran belum dipilih.";
    if (!Object.keys(draft.data?.formData || {}).length) return "Form data order belum diisi.";

    const followupStep = getServiceFollowupStep(definition, draft);
    if (followupStep === CHECKOUT_STEP.METHOD && !draft.data.methodLabel) {
      return "Pilih metode dulu sebelum konfirmasi.";
    }
    if (followupStep === CHECKOUT_STEP.NEED_TYPE && !draft.data.needTypeLabel) {
      return "Pilih kebutuhan dulu sebelum konfirmasi.";
    }

    if (definition.key === "joki") {
      const jokiValidation = validateJokiCheckoutData(draft);
      if (jokiValidation) return jokiValidation;
    }

    return null;
  }

  async function finalizeCheckoutInvoice(interaction, context, definition, draft) {
    let ticket = context.ticket || null;
    let orderChannel = context.channel;
    const statusInfo = resolveInitialCheckoutStatus(definition, draft);

    if (!ticket) {
      const created = await ticketService.createTicketChannel(
        interaction.guild,
        interaction.member,
        "order",
        {
          checkoutFlowVersion: 2,
          formType: definition.formType,
          customerName: getFormFieldValue(draft.data.formData, "customer_name", interaction.user.username),
          orderFlowStatus: statusInfo.flowLabel,
          invoiceReady: true,
          source: "checkout_panel",
        },
      );
      ticket = created.ticket;
      orderChannel = created.channel;
      context.ticket = ticket;
      context.mode = "ticket";
    }

    const existingOrder = await repositories.orderRepository.findByTicketId(ticket.id).catch(() => null);
    const orderId = existingOrder?.id || await repositories.simpleStoreRepository.getNextOrderId(interaction.guild.id);
    const invoiceLines = buildCheckoutInvoiceLines(orderId, definition, draft, statusInfo.flowLabel);
    const detailText = invoiceLines.join("\n");
    const fixedPrice = resolveCheckoutPrice(definition, draft);

    const payload = createOrder({
      id: orderId,
      guildId: interaction.guild.id,
      ticketId: ticket.id,
      channelId: ticket.channelId || orderChannel?.id || "",
      userId: interaction.user.id,
      customerName: getFormFieldValue(draft.data.formData, "customer_name", interaction.user.username),
      category: definition.label,
      service: definition.label,
      product: draft.data.productLabel || definition.label,
      packageName: draft.data.packageLabel || "",
      package: draft.data.packageLabel || "",
      method: draft.data.methodLabel || "",
      needType: draft.data.needTypeLabel || getFormFieldValue(draft.data.formData, "need_type", ""),
      paymentMethod: draft.data.paymentLabel || "",
      formData: draft.data.formData,
      checkoutSummary: detailText,
      detail: detailText,
      price: fixedPrice,
      status: statusInfo.orderStatus,
      paymentStatus: statusInfo.paymentStatus,
      adminNote: statusInfo.flowLabel === "MENUNGGU ADMIN"
        ? "Perlu review admin (custom/request manual/cek stok)."
        : "",
    });

    if (!existingOrder) {
      await repositories.orderRepository.create(payload);
      await repositories.userRepository?.incrementOrder?.(interaction.guild.id, interaction.user.id, interaction.user.tag);
    } else {
      await repositories.orderRepository.updateByTicketId(ticket.id, {
        channelId: payload.channelId,
        customerName: payload.customerName,
        category: payload.category,
        service: payload.service,
        product: payload.product,
        packageName: payload.packageName,
        package: payload.package,
        method: payload.method,
        needType: payload.needType,
        paymentMethod: payload.paymentMethod,
        formData: payload.formData,
        checkoutSummary: payload.checkoutSummary,
        detail: payload.detail,
        price: payload.price,
        status: payload.status,
        paymentStatus: payload.paymentStatus,
        adminNote: payload.adminNote,
      });
    }

    const latestOrder = await repositories.orderRepository.findByTicketId(ticket.id).catch(() => payload);

    draft.invoiceReady = true;
    draft.orderId = orderId;
    draft.step = CHECKOUT_STEP.COMPLETED;
    draft.history = [];
    draft.ticketId = ticket.id;
    draft.ticketChannelId = ticket.channelId || orderChannel?.id || null;

    await persistCheckoutDraft(ticket, draft, {
      checkoutFlowVersion: 2,
      formType: definition.formType,
      customerName: payload.customerName,
      detail: detailText,
      orderFlowStatus: statusInfo.flowLabel,
      invoiceReady: true,
    });

    await repositories.ticketRepository.update(ticket.id, {
      orderStatus: statusInfo.orderStatus,
    }).catch(() => null);

    await sendOrderSummary(
      orderChannel,
      `ORDER SUMMARY - ${definition.label.toUpperCase()}`,
      detailText,
      0x57f287,
      null,
      orderId,
      ticket.id,
    ).catch(() => null);

    const invoiceMessageId = await sendOrEditCheckoutInvoice({
      channel: orderChannel,
      interaction,
      order: latestOrder || payload,
      orderId,
      lines: invoiceLines,
    });

    if (invoiceMessageId) {
      await repositories.orderRepository.updateById(orderId, {
        invoiceMessageId,
        checkoutSummary: detailText,
      }).catch(() => null);
    }

    await loggingService.logOrder(
      interaction.guild,
      "Checkout Invoice Created",
      detailText,
      [
        { name: "Order ID", value: orderId, inline: true },
        { name: "Customer", value: interaction.user.tag, inline: true },
        { name: "Status", value: statusInfo.flowLabel, inline: true },
      ],
    ).catch((error) => {
      logBestEffort("log checkout invoice", {
        guildId: interaction.guild.id,
        ticketId: ticket.id,
        orderId,
      }, error);
    });

    return {
      ticket,
      orderChannel,
      statusInfo,
      orderId,
      detailText,
      invoiceLines,
      latestOrder,
    };
  }

  async function startCheckoutFromPanel(interaction) {
    const existing = await getPendingCheckoutSession(interaction.guild.id, interaction.user.id);
    const draft = sanitizeCheckoutDraft(createCheckoutDraft(interaction.user.id, existing));
    if (draft.step === CHECKOUT_STEP.COMPLETED) {
      resetCheckoutDraft(draft);
    }

    draft.userId = interaction.user.id;
    draft.guildId = interaction.guild.id;
    draft.channelId = interaction.channel.id;

    const context = {
      mode: "panel",
      ticket: null,
      channel: interaction.channel,
    };

    const messageId = await refreshCheckoutMessage(context, draft, draft.messageId);
    draft.messageId = messageId;
    await persistPendingCheckoutSession(interaction.guild.id, interaction.user.id, draft);

    return {
      ticket: null,
      channel: interaction.channel,
      reused: Boolean(existing),
      draft,
      panelMode: true,
    };
  }

  async function startCheckoutFromOrderTicket(interaction) {
    const ticket = await repositories.ticketRepository.findByChannelId(interaction.channel.id);
    if (!ticket || ticket.type !== "order") {
      await safeReply(interaction, {
        content: "Checkout hanya bisa dipakai di ticket order.",
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
      return { ok: false };
    }

    if (ticket.openerId !== interaction.user.id) {
      await safeReply(interaction, {
        content: "Hanya pemilik ticket yang bisa melanjutkan checkout.",
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
      return { ok: false };
    }

    const draft = sanitizeCheckoutDraft(createCheckoutDraft(interaction.user.id, ticket?.meta?.checkout));
    draft.guildId = interaction.guild.id;
    draft.channelId = interaction.channel.id;
    const context = {
      mode: "ticket",
      ticket,
      channel: interaction.channel,
    };

    await cleanupLegacyNavigatorButtons(interaction.channel).catch(() => null);
    await refreshCheckoutMessage(context, draft, draft.messageId);
    await persistCheckoutDraft(ticket, draft, { checkoutFlowVersion: 2 });

    await safeReply(interaction, {
      content: "Checkout panel siap. Lanjutkan step di ticket ini.",
      flags: MessageFlags.Ephemeral,
    }).catch(() => null);
    return { ok: true, draft };
  }

  async function handleCheckoutSelectInteraction(interaction) {
    const context = await resolveCheckoutContext(interaction);
    if (!context) {
      await notifyCheckoutSessionMissing(interaction);
      return null;
    }
    if (!(await assertCheckoutOwnership(interaction, context))) return null;

    const selectedValue = interaction.values?.[0] || "";
    const draft = context.draft;
    draft.userId = interaction.user.id;
    draft.guildId = interaction.guild.id;
    draft.channelId = interaction.channel.id;

    if (interaction.customId === componentIds.orderServiceSelect) {
      const definition = getCheckoutServiceByKey(selectedValue);
      if (!definition) return null;
      pushCheckoutHistory(draft, CHECKOUT_STEP.SERVICE);
      draft.step = CHECKOUT_STEP.PRODUCT;
      draft.invoiceReady = false;
      draft.orderId = null;
      draft.ticketId = null;
      draft.ticketChannelId = null;
      draft.data = {
        ...resetCheckoutData(),
        serviceKey: definition.key,
        serviceLabel: definition.label,
      };
      draft.messageId = interaction.message?.id || draft.messageId || null;
      await persistCheckoutContext(interaction, context, draft);
      return interaction.update({
        embeds: [buildCheckoutEmbed(context.ticket, draft)],
        components: buildCheckoutComponents(draft),
      }).catch(() => null);
    }

    const definition = getCheckoutServiceByKey(draft.data.serviceKey);
    if (!definition) {
      resetCheckoutDraft(draft);
      draft.messageId = interaction.message?.id || draft.messageId || null;
      await persistCheckoutContext(interaction, context, draft);
      return interaction.update({
        embeds: [buildCheckoutEmbed(context.ticket, draft)],
        components: buildCheckoutComponents(draft),
      }).catch(() => null);
    }

    if (interaction.customId === componentIds.orderProductSelect) {
      pushCheckoutHistory(draft, CHECKOUT_STEP.PRODUCT);
      draft.step = CHECKOUT_STEP.PACKAGE;
      draft.data.productValue = selectedValue;
      draft.data.productLabel = mapOptionValueToLabel(getServiceProducts(definition), selectedValue);
      draft.data.packageValue = "";
      draft.data.packageLabel = "";
      draft.data.methodValue = "";
      draft.data.methodLabel = "";
      draft.data.needTypeValue = "";
      draft.data.needTypeLabel = "";
      draft.data.paymentValue = "";
      draft.data.paymentLabel = "";
      draft.data.formData = {};
      draft.messageId = interaction.message?.id || draft.messageId || null;
      await persistCheckoutContext(interaction, context, draft);
      return interaction.update({
        embeds: [buildCheckoutEmbed(context.ticket, draft)],
        components: buildCheckoutComponents(draft),
      }).catch(() => null);
    }

    if (interaction.customId === componentIds.orderPackageSelect) {
      draft.data.packageValue = selectedValue;
      draft.data.packageLabel = mapOptionValueToLabel(getServicePackages(definition, draft), selectedValue);
      draft.data.methodValue = "";
      draft.data.methodLabel = "";
      draft.data.needTypeValue = "";
      draft.data.needTypeLabel = "";
      draft.data.paymentValue = "";
      draft.data.paymentLabel = "";
      draft.data.formData = {};
      draft.messageId = interaction.message?.id || draft.messageId || null;

      const followupStep = getServiceFollowupStep(definition, draft);
      if (shouldCollectFormAfterFollowup(definition, draft) && followupStep) {
        pushCheckoutHistory(draft, CHECKOUT_STEP.PACKAGE);
        draft.step = followupStep;
        await persistCheckoutContext(interaction, context, draft);
        return interaction.update({
          embeds: [buildCheckoutEmbed(context.ticket, draft)],
          components: buildCheckoutComponents(draft),
        }).catch(() => null);
      }

      await persistCheckoutContext(interaction, context, draft);
      const modalConfig = resolveCheckoutModalConfig(definition, draft);
      if (!modalConfig) {
        await safeReply(interaction, {
          content: "Form untuk layanan ini belum tersedia.",
          flags: MessageFlags.Ephemeral,
        }).catch(() => null);
        return null;
      }
      return interaction.showModal(buildCheckoutModal(modalConfig));
    }

    if (interaction.customId === componentIds.orderMethodSelect) {
      pushCheckoutHistory(draft, CHECKOUT_STEP.METHOD);
      draft.data.methodValue = selectedValue;
      draft.data.methodLabel = mapOptionValueToLabel(getServiceFollowupOptions(definition, draft), selectedValue);
      draft.data.paymentValue = "";
      draft.data.paymentLabel = "";
      draft.messageId = interaction.message?.id || draft.messageId || null;

      if (shouldCollectFormAfterFollowup(definition, draft)) {
        draft.data.formData = {};
        draft.step = CHECKOUT_STEP.METHOD;
        await persistCheckoutContext(interaction, context, draft);
        const modalConfig = resolveCheckoutModalConfig(definition, draft);
        if (!modalConfig) {
          await safeReply(interaction, {
            content: "Form metode joki belum tersedia.",
            flags: MessageFlags.Ephemeral,
          }).catch(() => null);
          return null;
        }
        return interaction.showModal(buildCheckoutModal(modalConfig));
      }

      draft.step = CHECKOUT_STEP.PAYMENT;
      await persistCheckoutContext(interaction, context, draft);
      return interaction.update({
        embeds: [buildCheckoutEmbed(context.ticket, draft)],
        components: buildCheckoutComponents(draft),
      }).catch(() => null);
    }

    if (interaction.customId === componentIds.orderNeedTypeSelect) {
      pushCheckoutHistory(draft, CHECKOUT_STEP.NEED_TYPE);
      draft.step = CHECKOUT_STEP.PAYMENT;
      draft.data.needTypeValue = selectedValue;
      draft.data.needTypeLabel = mapOptionValueToLabel(getServiceFollowupOptions(definition, draft), selectedValue);
      draft.data.paymentValue = "";
      draft.data.paymentLabel = "";
      draft.messageId = interaction.message?.id || draft.messageId || null;
      await persistCheckoutContext(interaction, context, draft);
      return interaction.update({
        embeds: [buildCheckoutEmbed(context.ticket, draft)],
        components: buildCheckoutComponents(draft),
      }).catch(() => null);
    }

    if (interaction.customId === componentIds.orderPaymentSelect) {
      pushCheckoutHistory(draft, CHECKOUT_STEP.PAYMENT);
      draft.step = CHECKOUT_STEP.CONFIRM;
      draft.data.paymentValue = selectedValue;
      draft.data.paymentLabel = mapOptionValueToLabel(PAYMENT_OPTIONS, selectedValue);
      draft.messageId = interaction.message?.id || draft.messageId || null;
      await persistCheckoutContext(interaction, context, draft);
      return interaction.update({
        embeds: [buildCheckoutEmbed(context.ticket, draft)],
        components: buildCheckoutComponents(draft),
      }).catch(() => null);
    }

    return null;
  }

  async function handleCheckoutModalInteraction(interaction) {
    const context = await resolveCheckoutContext(interaction);
    if (!context) {
      await notifyCheckoutSessionMissing(interaction);
      return null;
    }
    if (!(await assertCheckoutOwnership(interaction, context))) return null;

    const draft = context.draft;
    const definition = getCheckoutServiceByKey(draft?.data?.serviceKey) || getCheckoutServiceByModalId(interaction.customId, draft);
    if (!definition) return null;

    const modalConfig = resolveCheckoutModalConfig(definition, draft);
    if (!modalConfig || modalConfig.modalId !== interaction.customId) {
      return null;
    }

    const formData = {};
    for (const field of modalConfig.formFields) {
      formData[field.id] = getModalValue(interaction.fields, field.id);
    }

    const collectFormAfterFollowup = shouldCollectFormAfterFollowup(definition, draft);
    if (!collectFormAfterFollowup) {
      pushCheckoutHistory(draft, CHECKOUT_STEP.PACKAGE);
    }
    draft.data.formData = formData;
    const followupStep = getServiceFollowupStep(definition, draft);
    draft.step = collectFormAfterFollowup
      ? CHECKOUT_STEP.PAYMENT
      : (followupStep || CHECKOUT_STEP.PAYMENT);
    draft.invoiceReady = false;
    draft.orderId = null;

    await refreshCheckoutMessage(context, draft, draft.messageId);
    await persistCheckoutContext(interaction, context, draft, {
      formType: definition.formType,
      customerName: getFormFieldValue(formData, "customer_name", ""),
      orderFlowStatus: "MENUNGGU ADMIN",
    });

    const nextLabel = collectFormAfterFollowup
      ? "pembayaran"
      : followupStep === CHECKOUT_STEP.METHOD
        ? "metode"
        : followupStep === CHECKOUT_STEP.NEED_TYPE
          ? "kebutuhan"
          : "pembayaran";
    await safeReply(interaction, {
      content: `Form tersimpan. Lanjut pilih ${nextLabel}.`,
      flags: MessageFlags.Ephemeral,
    }).catch(() => null);
    return { ok: true };
  }

  async function handleCheckoutControlButton(interaction) {
    const isCheckoutButton = [
      componentIds.orderStart,
      componentIds.orderBack,
      componentIds.orderCancel,
      componentIds.orderConfirmInvoice,
    ].includes(interaction.customId);
    if (!isCheckoutButton) return null;

    if (interaction.customId === componentIds.orderStart) {
      const ticket = await repositories.ticketRepository.findByChannelId(interaction.channel.id).catch(() => null);
      if (ticket?.type === "order") {
        return startCheckoutFromOrderTicket(interaction);
      }
      return startCheckoutFromPanel(interaction);
    }

    const context = await resolveCheckoutContext(interaction, {
      allowLoosePanel: interaction.customId === componentIds.orderCancel,
    });
    if (!context) {
      if (interaction.customId === componentIds.orderCancel) {
        const fallbackDraft = createCheckoutDraft(interaction.user.id);
        fallbackDraft.userId = interaction.user.id;
        fallbackDraft.guildId = interaction.guild.id;
        fallbackDraft.channelId = interaction.channel.id;
        fallbackDraft.messageId = interaction.message?.id || null;
        await persistPendingCheckoutSession(interaction.guild.id, interaction.user.id, fallbackDraft);
        const resetPayload = {
          embeds: [buildCheckoutEmbed(null, fallbackDraft)],
          components: buildCheckoutComponents(fallbackDraft),
        };
        const updated = await interaction.update(resetPayload).catch(() => null);
        if (updated) return updated;
      }
      await notifyCheckoutSessionMissing(interaction);
      return null;
    }
    if (!(await assertCheckoutOwnership(interaction, context))) return null;

    const draft = context.draft;
    draft.userId = interaction.user.id;
    draft.guildId = interaction.guild.id;
    draft.channelId = interaction.channel.id;
    draft.messageId = interaction.message?.id || draft.messageId || null;

    if (interaction.customId === componentIds.orderBack) {
      const history = Array.isArray(draft.history) ? [...draft.history] : [];
      const previousStep = history.pop() || CHECKOUT_STEP.SERVICE;
      draft.history = history;
      draft.step = previousStep;
      if (previousStep !== CHECKOUT_STEP.CONFIRM) {
        draft.invoiceReady = false;
      }
      await persistCheckoutContext(interaction, context, draft);
      return interaction.update({
        embeds: [buildCheckoutEmbed(context.ticket, draft)],
        components: buildCheckoutComponents(draft),
      }).catch(() => null);
    }

    if (interaction.customId === componentIds.orderCancel) {
      resetCheckoutDraft(draft);
      await persistCheckoutContext(interaction, context, draft, {
        orderFlowStatus: "DIBATALKAN",
      });
      return interaction.update({
        embeds: [buildCheckoutEmbed(context.ticket, draft)],
        components: buildCheckoutComponents(draft),
      }).catch(() => null);
    }

    if (interaction.customId === componentIds.orderConfirmInvoice) {
      const definition = getCheckoutServiceByKey(draft?.data?.serviceKey);
      const validationMessage = validateCheckoutBeforeConfirm(definition, draft);
      if (validationMessage) {
        await safeReply(interaction, {
          content: validationMessage,
          flags: MessageFlags.Ephemeral,
        }).catch(() => null);
        return null;
      }

      // Acknowledge early to avoid Discord 3s interaction timeout while ticket+invoice are being processed.
      if (typeof interaction.deferUpdate === "function" && !interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate().catch(() => null);
      }

      const wasPanel = context.mode === "panel";
      const panelMessageId = wasPanel ? (draft.messageId || interaction.message?.id || null) : null;
      const finalized = await finalizeCheckoutInvoice(interaction, context, definition, draft);
      if (wasPanel) {
        await clearPendingCheckoutSession(interaction.guild.id, interaction.user.id);
      }

      let panelRemoved = false;
      if (wasPanel) {
        panelRemoved = await removeCheckoutPanelMessage(interaction.channel, panelMessageId);
      }

      if (!panelRemoved) {
        const checkoutPayload = {
          embeds: [buildCheckoutEmbed(context.ticket, draft)],
          components: buildCheckoutComponents(draft),
        };

        if (interaction.deferred && typeof interaction.editReply === "function") {
          await interaction.editReply(checkoutPayload).catch(() => null);
        } else {
          await interaction.update(checkoutPayload).catch(() => null);
        }
      }

      if (wasPanel && finalized?.orderChannel?.id) {
        await interaction.followUp?.({
          content: `Checkout selesai. Ticket order dibuat di <#${finalized.orderChannel.id}>.`,
          flags: MessageFlags.Ephemeral,
        }).catch(() => null);
      }
      return finalized;
    }

    return null;
  }

  async function handleCustomerOrderConfirmButton(interaction) {
    const ticket = await repositories.ticketRepository.findByChannelId(interaction.channel?.id || "").catch(() => null);
    if (!ticket || ticket.type !== "order") {
      await safeReply(interaction, {
        content: "Konfirmasi order hanya bisa dilakukan di ticket order.",
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
      return { ok: false, message: "invalid_ticket" };
    }

    const order = await repositories.orderRepository.findByTicketId(ticket.id).catch(() => null);
    if (!order) {
      await safeReply(interaction, {
        content: "Data order belum ditemukan di ticket ini.",
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
      return { ok: false, message: "order_not_found" };
    }

    const actorId = String(interaction.user?.id || "");
    const ownerId = String(order.userId || ticket.openerId || "");
    if (!actorId || actorId !== ownerId) {
      await safeReply(interaction, {
        content: "Hanya customer pemilik order yang bisa konfirmasi.",
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
      return { ok: false, message: "forbidden" };
    }

    if (order.customerConfirmedAt) {
      await safeReply(interaction, {
        content: `Order ini sudah kamu konfirmasi pada ${order.customerConfirmedAt}.`,
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
      return { ok: true, already: true };
    }

    const confirmedAt = new Date().toISOString();
    const adminTrail = `Customer confirmed at ${confirmedAt}`;
    const nextAdminNote = String(order.adminNote || "").trim()
      ? `${String(order.adminNote || "").trim()}\n${adminTrail}`
      : adminTrail;

    const updatedOrder = await repositories.orderRepository.updateById(order.id, {
      customerConfirmedAt: confirmedAt,
      customerConfirmedBy: actorId,
      adminNote: nextAdminNote,
    }).catch(() => null);

    if (!updatedOrder) {
      await safeReply(interaction, {
        content: "Gagal menyimpan konfirmasi order. Coba lagi.",
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
      return { ok: false, message: "update_failed" };
    }

    await repositories.ticketRepository.update(ticket.id, {
      meta: {
        ...(ticket.meta || {}),
        customerConfirmedAt: confirmedAt,
      },
    }).catch(() => null);

    if (updatedOrder.orderSummaryMessageId && interaction.channel?.messages?.fetch) {
      const summaryMessage = await interaction.channel.messages.fetch(updatedOrder.orderSummaryMessageId).catch(() => null);
      if (summaryMessage?.editable) {
        await summaryMessage.edit({
          components: buildOrderSummaryComponents(updatedOrder),
        }).catch(() => null);
      }
    }

    await loggingService?.logOrder?.(
      interaction.guild,
      "Customer Order Confirmed",
      `Customer <@${actorId}> mengonfirmasi order ${order.id}.`,
      [
        { name: "Order ID", value: order.id, inline: true },
        { name: "Ticket", value: ticket.id, inline: true },
      ],
    ).catch(() => null);

    await safeReply(interaction, {
      content: "Konfirmasi order berhasil. Admin akan lanjut proses.",
      flags: MessageFlags.Ephemeral,
    }).catch(() => null);

    return { ok: true, order: updatedOrder };
  }

  async function handleAdminOrderConfirmButton(interaction) {
    const ticket = await repositories.ticketRepository.findByChannelId(interaction.channel?.id || "").catch(() => null);
    if (!ticket || ticket.type !== "order") {
      await safeReply(interaction, {
        content: "Konfirmasi admin hanya bisa dilakukan di ticket order.",
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
      return { ok: false, message: "invalid_ticket" };
    }

    if (!isOwnerOrStaff(interaction.member)) {
      await safeReply(interaction, {
        content: "Hanya staff/admin yang bisa konfirmasi admin.",
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
      return { ok: false, message: "forbidden" };
    }

    const order = await repositories.orderRepository.findByTicketId(ticket.id).catch(() => null);
    if (!order) {
      await safeReply(interaction, {
        content: "Data order belum ditemukan di ticket ini.",
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
      return { ok: false, message: "order_not_found" };
    }

    const flowStatus = normalizeOrderStatusForDisplay(order);
    if (flowStatus !== "MENUNGGU ADMIN") {
      await safeReply(interaction, {
        content: `Order ini tidak dalam status MENUNGGU ADMIN (status saat ini: ${flowStatus}).`,
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
      return { ok: false, message: "invalid_status" };
    }

    const confirmedAt = new Date().toISOString();
    const actorId = String(interaction.user?.id || "");
    const nextAdminNote = String(order.adminNote || "").trim()
      ? `${String(order.adminNote || "").trim()}\nAdmin confirmed at ${confirmedAt}`
      : `Admin confirmed at ${confirmedAt}`;

    const updatedOrder = await repositories.orderRepository.updateById(order.id, {
      status: "waiting",
      paymentStatus: "unpaid",
      adminConfirmedAt: confirmedAt,
      adminConfirmedBy: actorId,
      staffHandle: actorId || order.staffHandle || null,
      adminNote: nextAdminNote,
    }).catch(() => null);

    if (!updatedOrder) {
      await safeReply(interaction, {
        content: "Gagal menyimpan konfirmasi admin. Coba lagi.",
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
      return { ok: false, message: "update_failed" };
    }

    await repositories.ticketRepository.update(ticket.id, {
      orderStatus: "waiting",
      meta: {
        ...(ticket.meta || {}),
        orderFlowStatus: "MENUNGGU PEMBAYARAN",
        adminConfirmedAt: confirmedAt,
      },
    }).catch(() => null);

    if (updatedOrder.orderSummaryMessageId && interaction.channel?.messages?.fetch) {
      const summaryMessage = await interaction.channel.messages.fetch(updatedOrder.orderSummaryMessageId).catch(() => null);
      if (summaryMessage?.editable) {
        await summaryMessage.edit({
          components: buildOrderSummaryComponents(updatedOrder),
        }).catch(() => null);
      }
    }

    await loggingService?.logOrder?.(
      interaction.guild,
      "Admin Order Confirmed",
      `Admin <@${actorId}> mengonfirmasi order ${order.id} dan membuka pembayaran customer.`,
      [
        { name: "Order ID", value: order.id, inline: true },
        { name: "Ticket", value: ticket.id, inline: true },
      ],
    ).catch(() => null);

    await interaction.channel?.send?.({
      content: `✅ Order \`${order.id}\` sudah dikonfirmasi admin. Customer sekarang bisa lanjut pembayaran dan upload bukti bayar.`,
    }).catch(() => null);

    await safeReply(interaction, {
      content: "Konfirmasi admin berhasil. Status order berubah ke MENUNGGU PEMBAYARAN.",
      flags: MessageFlags.Ephemeral,
    }).catch(() => null);

    return { ok: true, order: updatedOrder };
  }

  logger?.info?.("order service ready", { store: botConfig.storeName });

  return {
    openOrder,
    setOrderStatus,
    closeOrder,
    handleOrderFormModal,
    handleTopupFormModal,
    handleWarrantyModal,
    handleWindowsLicenseModal,
    handleOfficeLicenseModal,
    handleOptimizerModal,
    handleGameAccountModal,
    handleGtaAccountModal,
    handleDiscordServerModal,
    handleBundlePackageModal,

    // Checkout flow (panel -> select -> modal -> invoice)
    startCheckoutFromPanel,
    startCheckoutFromOrderTicket,
    handleCheckoutSelectInteraction,
    handleCheckoutModalInteraction,
    handleCheckoutControlButton,
    handleCustomerOrderConfirmButton,
    handleAdminOrderConfirmButton,
    normalizeOrderStatusForDisplay,

    // Priority 1 invoice automation
    sendOrderSummary,
    sendOrEditInvoice,
    buildInvoiceEmbed,
  };
}

module.exports = {
  createOrderService,
};

