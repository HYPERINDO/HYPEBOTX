const { ChannelType } = require("discord.js");

module.exports = {
  key: "gamestore",
  label: "GameStore",
  categories: [
    {
      name: "📌・INFO",
      channels: [
        { type: ChannelType.GuildText, name: "👋丨welcome", visibility: "verify", writableBy: "readonly", topic: "Welcome message, start guide, rules, verify, and role selection." },
        { type: ChannelType.GuildText, name: "📜丨rules", visibility: "verify", writableBy: "readonly", topic: "Server, order, anti-scam, spam, ticket, and marketplace rules." },
        { type: ChannelType.GuildText, name: "📢丨announcements", visibility: "member", writableBy: "readonly", topic: "Official server announcements." },
        { type: ChannelType.GuildText, name: "📘丨faq", visibility: "verify", writableBy: "readonly", topic: "FAQ for orders, refunds, warranty, payment, and claims." },
        { type: ChannelType.GuildText, name: "🎭丨choose-role", visibility: "verify", writableBy: "readonly", topic: "Self role panel." },
        { type: ChannelType.GuildText, name: "✅丨verify", visibility: "verify", writableBy: "readonly", topic: "Member verification panel." },
        { type: ChannelType.GuildText, name: "🌐丨social-links", visibility: "member", writableBy: "readonly", topic: "Official social and store links." },
      ],
    },
    {
      name: "🛒・STORE",
      channels: [
        { type: ChannelType.GuildText, name: "💸丨price-list", visibility: "member", writableBy: "readonly", topic: "Product and service price list." },
        { type: ChannelType.GuildText, name: "🎁丨promo", visibility: "member", writableBy: "readonly", topic: "Discounts, vouchers, bundles, and flash sales." },
        { type: ChannelType.GuildText, name: "📦丨stock-update", visibility: "member", writableBy: "readonly", topic: "Stock, service slots, restock, and sold out updates." },
        { type: ChannelType.GuildText, name: "🆔丨account-showcase", visibility: "member", writableBy: "readonly", topic: "Account showcase and availability." },
        { type: ChannelType.GuildText, name: "🏧丨payment-method", visibility: "member", writableBy: "readonly", topic: "Payment methods and payment rules." },
        { type: ChannelType.GuildText, name: "🧾丨payment-proof", visibility: "member", writableBy: "member", topic: "Customer payment proof uploads." },
        { type: ChannelType.GuildText, name: "🛡️丨claim-warranty", visibility: "member", writableBy: "readonly", topic: "Warranty terms and claim format." },
      ],
    },
    {
      name: "🎮・PRODUCTS",
      channels: [
        { type: ChannelType.GuildText, name: "🎮丨steam-products", visibility: "member", writableBy: "readonly", topic: "Steam accounts, games, wallet, gifts, and related services." },
        { type: ChannelType.GuildText, name: "🕹️丨epic-products", visibility: "member", writableBy: "readonly", topic: "Epic Games accounts, games, and services." },
        { type: ChannelType.GuildText, name: "⭐丨rockstar-products", visibility: "member", writableBy: "readonly", topic: "Rockstar, GTA, and RDR products." },
        { type: ChannelType.GuildText, name: "🪟丨windows-office-key", visibility: "member", writableBy: "readonly", topic: "Windows and Office licenses." },
        { type: ChannelType.GuildText, name: "⚙️丨optimizer-windows", visibility: "member", writableBy: "readonly", topic: "Windows optimizer products and packages." },
        { type: ChannelType.GuildText, name: "🚀丨game-boosting", visibility: "member", writableBy: "readonly", topic: "Game boosting services, prices, estimates, and terms." },
        { type: ChannelType.GuildText, name: "💎丨game-top-up", visibility: "member", writableBy: "readonly", topic: "Game top up products and services." },
        { type: ChannelType.GuildText, name: "🛍️丨account-market", visibility: "member", writableBy: "readonly", topic: "Ready and requested account marketplace." },
        { type: ChannelType.GuildText, name: "🔧丨account-settings", visibility: "member", writableBy: "readonly", topic: "Account setup, recovery, 2FA, and security services." },
      ],
    },
    {
      name: "🧾・ORDER CENTER",
      channels: [
        { type: ChannelType.GuildText, name: "🛒丨how-to-order", visibility: "member", writableBy: "readonly", topic: "Step-by-step order guide." },
        { type: ChannelType.GuildText, name: "🛎️丨order-panel", visibility: "member", writableBy: "readonly", topic: "Order, warranty, support, and problem report panel." },
        { type: ChannelType.GuildText, name: "🎟️丨open-ticket", visibility: "member", writableBy: "readonly", topic: "Main ticket creation panel." },
        { type: ChannelType.GuildText, name: "📦丨order-status", visibility: "member", writableBy: "readonly", topic: "Order status updates." },
        { type: ChannelType.GuildText, name: "📝丨queue-list", visibility: "member", writableBy: "readonly", topic: "Processing queue list." },
        { type: ChannelType.GuildText, name: "🆘丨report-problem", visibility: "member", writableBy: "member", topic: "Customer problem reports." },
      ],
    },
    {
      name: "🎫・ACTIVE TICKETS",
      channels: [],
    },
    {
      name: "🔒・CLOSED TICKETS",
      channels: [],
    },
    {
      name: "🚗・GTA SERVICES",
      channels: [
        { type: ChannelType.GuildText, name: "ℹ️丨gta-info", visibility: "member", writableBy: "readonly", topic: "GTA service information, requirements, estimates, and rules." },
        { type: ChannelType.GuildText, name: "🟢丨legacy-service", visibility: "member", writableBy: "readonly", topic: "GTA Legacy packages, prices, slots, and order details." },
        { type: ChannelType.GuildText, name: "🟡丨enhanced-service", visibility: "member", writableBy: "readonly", topic: "GTA Enhanced packages, prices, slots, and order details." },
        { type: ChannelType.GuildText, name: "💬丨gta-chat", visibility: "member", writableBy: "member", topic: "GTA discussion and community chat." },
        { type: ChannelType.GuildText, name: "🏆丨gta-testimonials", visibility: "member", writableBy: "readonly", topic: "GTA service reviews, screenshots, and feedback." },
      ],
    },
    {
      name: "⚡・PC OPTIMIZER",
      channels: [
        { type: ChannelType.GuildText, name: "💬丨pc-consultation", visibility: "member", writableBy: "member", topic: "PC consultation for FPS, stutter, lag, specs, temperature, and optimization." },
        { type: ChannelType.GuildText, name: "💡丨optimization-tips", visibility: "member", writableBy: "readonly", topic: "Windows, game, FPS, and input delay optimization tips." },
        { type: ChannelType.GuildText, name: "📱丨hyperboostx-info", visibility: "member", writableBy: "readonly", topic: "HyperBoostX features, pricing, tutorials, changelog, and benefits." },
        { type: ChannelType.GuildText, name: "⚡丨optimizer-service", visibility: "member", writableBy: "readonly", topic: "Optimizer service packages, prices, duration, and order terms." },
        { type: ChannelType.GuildText, name: "📈丨optimizer-results", visibility: "member", writableBy: "readonly", topic: "Before-after FPS, benchmarks, latency, boot time, and results." },
        { type: ChannelType.GuildText, name: "🏆丨optimizer-testimonials", visibility: "member", writableBy: "readonly", topic: "Optimizer customer reviews and feedback." },
      ],
    },
    {
      name: "📡・STREAM AREA",
      channels: [
        { type: ChannelType.GuildText, name: "🔴丨live-notification", visibility: "member", writableBy: "readonly", topic: "Live notifications." },
        { type: ChannelType.GuildText, name: "🗓️丨stream-schedule", visibility: "member", writableBy: "readonly", topic: "Stream schedule and updates." },
        { type: ChannelType.GuildText, name: "💬丨stream-chat", visibility: "member", writableBy: "member", topic: "Stream viewer chat and interaction." },
        { type: ChannelType.GuildText, name: "👤丨live-accounts", visibility: "member", writableBy: "readonly", topic: "Live account information." },
      ],
    },
    {
      name: "🎉・EVENTS",
      channels: [
        { type: ChannelType.GuildText, name: "🎁丨giveaway", visibility: "member", writableBy: "member", topic: "Giveaways and event prizes." },
        { type: ChannelType.GuildText, name: "🏆丨event-winner", visibility: "member", writableBy: "readonly", topic: "Event winners and prize proof." },
      ],
    },
    {
      name: "👾・COMMUNITY",
      channels: [
        { type: ChannelType.GuildText, name: "💬丨community-chat", visibility: "member", writableBy: "member", topic: "General community chat." },
        { type: ChannelType.GuildText, name: "🎥丨content", visibility: "member", writableBy: "member", topic: "Videos, clips, screenshots, and creator content." },
        { type: ChannelType.GuildText, name: "📸丨media-share", visibility: "member", writableBy: "member", topic: "Screenshots, memes, game results, setup pictures, and media." },
        { type: ChannelType.GuildText, name: "🎵丨music-request", visibility: "member", writableBy: "member", topic: "Music bot commands, requests, playlists, and queue." },
        { type: ChannelType.GuildText, name: "🎮丨bot-games", visibility: "member", writableBy: "member", topic: "Fun bot commands and mini games." },
      ],
    },
    {
      name: "🛡️・STAFF AREA",
      channels: [
        { type: ChannelType.GuildText, name: "💬丨staff-chat", visibility: "staff", writableBy: "staff", topic: "Staff coordination and internal discussion." },
        { type: ChannelType.GuildText, name: "👑丨admin-chat", visibility: "staff", writableBy: "staff", topic: "Admin-only decisions and sensitive discussion." },
        { type: ChannelType.GuildText, name: "📚丨operator-guide", visibility: "staff", writableBy: "staff", topic: "Staff SOP, reply formats, payment checks, and ticket handling." },
        { type: ChannelType.GuildText, name: "🧪丨bot-testing", visibility: "staff", writableBy: "staff", topic: "Bot command, embed, ticket, role, and debug testing." },
        { type: ChannelType.GuildText, name: "🐞丨bug-report", visibility: "staff", writableBy: "staff", topic: "Internal bug reports and system issues." },
      ],
    },
    {
      name: "📁・SERVER LOGS",
      channels: [
        { type: ChannelType.GuildText, name: "🤖丨bot-logs", visibility: "staff", writableBy: "staff", topic: "Bot errors, restarts, commands, status, and automated activity." },
        { type: ChannelType.GuildText, name: "📥丨join-leave-logs", visibility: "staff", writableBy: "staff", topic: "Member join and leave logs." },
        { type: ChannelType.GuildText, name: "🔨丨moderation-logs", visibility: "staff", writableBy: "staff", topic: "Moderation action logs." },
        { type: ChannelType.GuildText, name: "📊丨admin-logs", visibility: "staff", writableBy: "staff", topic: "Admin, role, permission, channel, and nickname logs." },
        { type: ChannelType.GuildText, name: "🎫丨ticket-logs", visibility: "staff", writableBy: "staff", topic: "Ticket creation, closure, transcript, and support history logs." },
        { type: ChannelType.GuildText, name: "📦丨order-logs", visibility: "staff", writableBy: "staff", topic: "Order, payment, refund, and internal order update logs." },
      ],
    },
    {
      name: "📊・SERVER STATS",
      channels: [
        { type: ChannelType.GuildText, name: "👥丨all-members", visibility: "member", writableBy: "readonly", topic: "Total account count." },
        { type: ChannelType.GuildText, name: "👤丨members", visibility: "member", writableBy: "readonly", topic: "Human member count." },
        { type: ChannelType.GuildText, name: "🤖丨bots", visibility: "member", writableBy: "readonly", topic: "Bot count." },
      ],
    },
    {
      name: "🔊・VOICE LOUNGE",
      channels: [
        { type: ChannelType.GuildVoice, name: "💬丨chill-room", visibility: "member" },
        { type: ChannelType.GuildVoice, name: "🎵丨music-room", visibility: "member" },
        { type: ChannelType.GuildVoice, name: "🟢丨room-legacy", visibility: "member" },
        { type: ChannelType.GuildVoice, name: "🟡丨room-enhanced", visibility: "member" },
        { type: ChannelType.GuildVoice, name: "🛡️丨staff-voice", visibility: "staff" },
        { type: ChannelType.GuildVoice, name: "👑丨admin-room", visibility: "staff" },
      ],
    },
  ],
};
