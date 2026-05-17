const { MessageFlags } = require("discord.js");
const { isOwnerOrStaff } = require("../../../utils/permissionCheck");

function normalize(text) {
    return String(text || "").trim().toLowerCase();
}

function clampString(value, max = 1800) {
    const s = typeof value === "string" ? value : "";
    if (!s) return "";
    if (s.length <= max) return s;
    return `${s.slice(0, max)}\n...`;
}

function looksLikeOrderId(raw) {
    const t = normalize(raw);
    return /^ord-?\d+/i.test(t) || /^ord\d+/i.test(t) || /^h?yp-?\d+/i.test(t) || /^hypebotx-?\d+/i.test(t) || /^hyp-?\d+/i.test(t) || /^\d{4,8}$/.test(t);
}

function looksLikeTicketId(raw) {
    const t = normalize(raw);
    return /^\d{1,4}$/.test(t) || /^tkt-?\d{1,4}$/i.test(t);
}

function extractOrderOrTicketRef(raw) {
    const s = String(raw || "");
    // try order id patterns
    const orderMatch = s.match(/(?:order(?: id)?|ord|order#|order-?)[:#\s]*([A-Za-z0-9\-]+)/i);
    if (orderMatch) return { type: 'order', id: orderMatch[1] };
    const ordMatch2 = s.match(/\b(ord-?\d{3,}|ORD\d{3,})\b/i);
    if (ordMatch2) return { type: 'order', id: ordMatch2[0] };
    const ticketMatch = s.match(/(?:ticket(?: id)?|tkt|ticket#)[:#\s]*(\d{1,6})/i);
    if (ticketMatch) return { type: 'ticket', id: ticketMatch[1] };
    // fallback: plain numeric may be ticket id
    const plainNum = s.match(/\b(\d{3,6})\b/);
    if (plainNum) return { type: 'ticket', id: plainNum[1] };
    return null;
}

function safeNotFound() {
    return {
        ok: false,
        status: "not_found",
        source: "rule_based",
        message: "Datanya belum ketemu kak, aku arahkan ke admin ya.",
    };
}

function adminRequired() {
    return {
        ok: false,
        status: "admin_required",
        source: "rule_based",
        message: "Ini perlu dicek admin ya kak.",
    };
}

function createSmallTalkReply(normalizedQuestion) {
    if (normalizedQuestion.includes("siapa nama kamu") || normalizedQuestion.includes("nama kamu apa")) {
        return "Aku HYPEBOTX, asisten bot Hyperindo kak. Aku bisa bantu cek order, payment, invoice, joki, warranty, refund, coupon, dan status pesanan.";
    }

    if (normalizedQuestion === "kamu siapa" || normalizedQuestion.includes("kamu siapa") || normalizedQuestion.includes("kamu itu siapa")) {
        return "Aku HYPEBOTX kak 🙌 Asisten bot Hyperindo. Bisa bantu soal order & payment ya.";
    }

    if (normalizedQuestion.includes("kamu bisa") || normalizedQuestion.includes("bisa apa") || normalizedQuestion.includes("kamu bisa apa")) {
        return "Aku bisa bantu cek price list, status order/payment/invoice, info joki, warranty, refund/dispute, coupon, dan panduan order Hyperindo.";
    }

    if (normalizedQuestion.includes("kamu lagi apa") || normalizedQuestion.includes("lagi ngapain") || normalizedQuestion.includes("lagi apa") || normalizedQuestion.includes("standby")) {
        return "Aku lagi standby bantu customer Hyperindo kak. Kalau ada yang mau dicek, bilang aja ya.";
    }

    if (normalizedQuestion.includes("apa kabar") || normalizedQuestion.includes("gimana kabar") || normalizedQuestion.includes("kabar?") || normalizedQuestion.includes("kabar ")) {
        return "Alhamdulillah baik kak 🙌 Kalau mau cek harga, order, payment, invoice, joki, warranty, refund, atau status pesanan tinggal sebutin aja.";
    }

    if (["halo", "hai", "pagi", "siang", "malam", "hey"].some((k) => normalizedQuestion === k || normalizedQuestion.startsWith(`${k} `) || normalizedQuestion.includes(` ${k}`))) {
        return "Halo kak 🙌 Mau cek harga, order, payment, invoice, joki, warranty, refund, atau status pesanan?";
    }

    if (normalizedQuestion.includes("makasih") || normalizedQuestion.includes("thanks") || normalizedQuestion.includes("terima kasih") || normalizedQuestion.includes("sip") || normalizedQuestion === "oke") {
        return "Sama-sama kak. Kalau butuh bantuan Hyperindo lagi, tinggal tanya ya 🙌";
    }

    if (normalizedQuestion.includes("joke") || normalizedQuestion.includes("kamu manusia") || normalizedQuestion.includes("kamu hidup")) {
        return "Aku bot asisten Hyperindo kak 😄 Tapi aku tetap bantu kayak CS beneran ya.";
    }

    return null;
}

function isLikelyUnknown(normalizedQuestion) {
    const known = [
        // business intents
        "cara order",
        "order joki",
        "harga",
        "price",
        "payment",
        "pembayaran",
        "invoice",
        "status",
        "order status",
        "ticket",
        "refund",
        "dispute",
        "warranty",
        "coupon",
        "kupon",
        "stock",
        "joki",
        "testimoni",
        "faq",
        "help",
        "command",
        "tutorial",
        "panduan",

        // small talk
        "siapa nama kamu",
        "kamu siapa",
        "nama kamu",
        "kamu bisa",
        "bisa apa",
        "halo",
        "hai",
        "pagi",
        "siang",
        "malam",
        "makasih",
        "terima kasih",
        "standby",
        "kamu manusia",
        "kamu hidup",
    ];
    return !known.some((k) => normalizedQuestion.includes(k));
}

function createRuleBasedProvider({ client, guard, storeOpsService: injectedStoreOpsService }) {
    const repositories = client?.container?.repositories;
    const services = client?.container?.services;

    const orderRepository = repositories?.orderRepository;
    const paymentRepository = repositories?.paymentRepository;
    const ticketRepository = repositories?.ticketRepository; // may be useful later
    const storeOpsService = injectedStoreOpsService || services?.storeOpsService;

    function getStoreOpsService() {
        return storeOpsService || client?.container?.services?.storeOpsService || null;
    }

    async function answer({ interaction, questionRaw, question }) {
        const qRaw = String(questionRaw || "");
        const qn = normalize(question);

        // Guard: sensitive data -> fallback
        if (guard?.isLikelyAskingForSensitiveData?.(qRaw)) {
            return {
                ok: false,
                status: "admin_required",
                source: "rule_based",
                message: "Ini perlu dicek admin ya kak.",
            };
        }

        // Small talk first
        const smallTalk = createSmallTalkReply(qn);
        if (smallTalk) {
            return {
                ok: true,
                status: "answered",
                source: "rule_based",
                answer: smallTalk,
            };
        }

        const effectiveStoreOpsService = getStoreOpsService();

        // FAQ quick path (DB-first)
        if (effectiveStoreOpsService?.findFaq) {
            const faq = await effectiveStoreOpsService.findFaq(interaction.guild.id, qRaw).catch(() => null);
            if (faq?.answer) {
                return {
                    ok: true,
                    status: "answered",
                    source: "rule_based",
                    answer: clampString(`Siap kak 🙌\n\n${faq.answer}`, 1800),
                };
            }
        }

        const explicitRef = extractOrderOrTicketRef(qRaw);
        const hasExplicitOrderTicketRef = Boolean(explicitRef) || looksLikeOrderId(qRaw) || looksLikeTicketId(qRaw);
        if (
            (qn.includes("payment") ||
                qn.includes("pembayaran") ||
                qn.includes("invoice") ||
                qn.includes("status") ||
                qn.includes("sampai")) &&
            !hasExplicitOrderTicketRef
        ) {
            return {
                ok: true,
                status: "answered",
                source: "rule_based",
                answer: "Untuk cek status/payment, sebutkan Order ID atau Ticket ID ya kak. Kalau belum ada, aku bantu arahkan ke admin/staff.",
            };
        }

        // Status query (DB-first)
        const wantsStatus =
            hasExplicitOrderTicketRef ||
            (/\b(order|ticket)\b/.test(qn) && /\b(status|payment|invoice|sampai)\b/.test(qn));

        if (wantsStatus) {
            const requesterUserId = interaction.user?.id || interaction?.member?.id || null;
            const requesterCanViewAll = Boolean(interaction.member) && isOwnerOrStaff(interaction.member);

            let order = null;

            if (explicitRef && explicitRef.type === 'order' && orderRepository?.findById) {
                const id = String(explicitRef.id || "").replace(/\s+/g, "").toUpperCase();
                order = await orderRepository.findById(id).catch(() => null);
            } else if (explicitRef && explicitRef.type === 'ticket' && orderRepository?.findByTicketId) {
                const t = String(explicitRef.id || "").replace(/^tkt-?/i, "").replace(/\s+/g, "");
                order = await orderRepository.findByTicketId(t).catch(() => null);
            } else if (looksLikeOrderId(qRaw) && orderRepository?.findById) {
                const id = String(qRaw).replace(/\s+/g, "").toUpperCase();
                order = await orderRepository.findById(id).catch(() => null);
            } else if (looksLikeTicketId(qRaw) && orderRepository?.findByTicketId) {
                const t = String(qRaw).replace(/^tkt-?/i, "").replace(/\s+/g, "");
                order = await orderRepository.findByTicketId(t).catch(() => null);
            }

            if (order) {
                const orderOwnerUserId = order.userId || null;
                if (requesterUserId && !requesterCanViewAll) {
                    if (orderOwnerUserId && orderOwnerUserId !== requesterUserId) {
                        return {
                            ok: false,
                            status: "admin_required",
                            source: "rule_based",
                            message: "Maaf kak, aku tidak bisa membuka data order milik customer lain.",
                        };
                    }
                }

                let latestPayment = null;
                if (order.ticketId && paymentRepository?.findByTicketId) {
                    const payments = await paymentRepository.findByTicketId(order.ticketId).catch(() => []);
                    latestPayment =
                        Array.isArray(payments) && payments.length ? payments[payments.length - 1] : null;
                }

                const lines = [];
                lines.push(`✅ Order: \`${order.id}\``);
                lines.push(`📌 Layanan: ${order.product || order.category || "-"}`);
                lines.push(`🧾 Order Status: ${order.status || "-"}`);
                lines.push(`💳 Payment Status: ${latestPayment?.status || order.paymentStatus || "-"}`);
                lines.push(`🎫 Ticket: ${order.ticketId ? `\`${order.ticketId}\`` : "-"}`);

                return {
                    ok: true,
                    status: "answered",
                    source: "rule_based",
                    answer: clampString(lines.join("\n"), 1800),
                };
            }

            try {
                const content = await effectiveStoreOpsService?.getMyStatus?.(interaction);
                if (content) {
                    return {
                        ok: true,
                        status: "answered",
                        source: "rule_based",
                        answer: clampString(content, 1800),
                    };
                }
            } catch {
                // ignore
            }

            return safeNotFound();
        }

        // Guidance: cara order / mau order dimana
        if (
            qn.includes("cara order") ||
            qn.includes("mau order") ||
            qn.includes("order dimana") ||
            qn.includes("order di mana") ||
            qn.includes("dimana order") ||
            qn.includes("beli dimana") ||
            qn.includes("mau beli") ||
            qn.includes("pesan dimana") ||
            qn.includes("cara beli") ||
            (qn.includes("order") && qn.includes("joki"))
        ) {
            return {
                ok: true,
                status: "answered",
                source: "rule_based",
                answer: [
                    "Siap kak 🙌",
                    "Untuk order joki:",
                    "1) Buka ticket order (pilih layanan via panel / command terkait)",
                    "2) Isi data order/format yang diminta di ticket",
                    "3) Kirim bukti pembayaran sesuai instruksi",
                    "4) Tunggu validasi staff, lalu order masuk proses admin.",
                    "Kalau kakak sebut layanan & tujuan ordernya, aku bantu arahkan langkah berikutnya ya.",
                ].join("\n"),
            };
        }

        // Panduan ringan
        if (qn.includes("panduan")) {
            return {
                ok: true,
                status: "answered",
                source: "rule_based",
                answer: "Untuk panduan lengkap, kakak bisa cek /faq atau instruksi di Panduan Hyperindo. Kalau kakak sebut layanan spesifiknya, aku bantu arahkan.",
            };
        }

        // Price list preview
        if (qn.includes("harga") || qn.includes("price") || qn.includes("pricelist") || qn.includes("price list")) {
            client?.container?.logger?.info?.("[PRICE_LIST_PROVIDER] trigger", {
                qn,
                guildId: interaction.guild?.id,
                hasStoreOpsService: Boolean(effectiveStoreOpsService),
                hasGetPriceList: typeof effectiveStoreOpsService?.getPriceList === "function",
            });

            if (!effectiveStoreOpsService || typeof effectiveStoreOpsService.getPriceList !== "function") {
                client?.container?.logger?.warn?.("[PRICE_LIST_PROVIDER] missing storeOpsService/getPriceList", {
                    hasStoreOpsService: Boolean(effectiveStoreOpsService),
                    getPriceListType: typeof effectiveStoreOpsService?.getPriceList,
                });
                return safeNotFound();
            }

            {
                const list = await effectiveStoreOpsService.getPriceList(interaction.guild.id).catch((err) => {
                    client?.container?.logger?.error?.("[PRICE_LIST_PROVIDER] getPriceList failed", {
                        guildId: interaction.guild?.id,
                        error: err?.message || String(err),
                    });
                    return [];
                });

                client?.container?.logger?.info?.("[PRICE_LIST_PROVIDER] list result", {
                    isArray: Array.isArray(list),
                    length: Array.isArray(list) ? list.length : 0,
                });

                if (Array.isArray(list) && list.length) {
                    client?.container?.logger?.info?.("[PRICE_LIST_PROVIDER] list result", {
                        isArray: Array.isArray(list),
                        length: Array.isArray(list) ? list.length : 0,
                    });
                    // Try to match specific product keywords from the question
                    const keywords = qn.replace(/harga|price|berapa|list|nya|dong|kak|bro|sis/gi, "").trim().split(/\s+/).filter((k) => k.length > 2);
                    let matched = [];
                    if (keywords.length) {
                        matched = list.filter((row) => {
                            const name = (row.name || "").toLowerCase();
                            const cat = (row.category || "").toLowerCase();
                            const desc = (row.description || "").toLowerCase();
                            return keywords.some((k) => name.includes(k) || cat.includes(k) || desc.includes(k));
                        });
                    }

                    if (matched.length && matched.length <= 15) {
                        // Show specific matched items
                        const preview = matched.map((row) => `• **${row.name}**: ${row.price}`).join("\n");
                        return {
                            ok: true,
                            status: "answered",
                            source: "rule_based",
                            answer: `Ini harga yang kakak cari 🙌\n\n${preview}\n\nMau order? Buka ticket ya kak.`,
                        };
                    }

                    // Show category summary for general price queries
                    const categories = new Map();
                    for (const row of list) {
                        const cat = row.category || "Lainnya";
                        if (!categories.has(cat)) categories.set(cat, 0);
                        categories.set(cat, categories.get(cat) + 1);
                    }
                    const summary = [...categories.entries()].map(([cat, count]) => `• ${cat} (${count} layanan)`).join("\n");
                    return {
                        ok: true,
                        status: "answered",
                        source: "rule_based",
                        answer: `Berikut kategori price list kak 🙌\n\n${summary}\n\nTotal: **${list.length} layanan**\nKetik \`/price\` untuk detail lengkap, atau sebutin produk spesifiknya ya.`,
                    };
                }
            }
            return safeNotFound();
        }

        // Coupon/payment guidance (safe)
        if (qn.includes("coupon") || qn.includes("kupon") || qn.includes("diskon")) {
            return {
                ok: false,
                status: "admin_required",
                source: "rule_based",
                message: "Untuk coupon/kupon, aku butuh cek data pemakaian & aturan di sistem (biar nggak salah). Ini perlu dicek admin/staff ya kak.",
            };
        }

        if (qn.includes("payment") || qn.includes("pembayaran") || qn.includes("invoice")) {
            return {
                ok: false,
                status: "admin_required",
                source: "rule_based",
                message: "Untuk payment/invoice, kakak bisa kirim Order ID atau Ticket ID ya. Kalau belum ada, aku arahkan admin untuk validasi.",
            };
        }

        // Unknown fallback
        if (isLikelyUnknown(qn)) {
            return safeNotFound();
        }

        return safeNotFound();
    }

    return { answer };
}

module.exports = {
    createRuleBasedProvider,
};
