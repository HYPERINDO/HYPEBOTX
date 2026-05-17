const { Events } = require("discord.js");
const { getAiModeForMessage } = require("../../utils/aiModeResolver");
const { parseAIResponse } = require("../../utils/aiResponseParser");
const { sanitizeAiData } = require("../../utils/sanitizeAiData");
const { createChatbotGuard } = require("../../services/chatbot/chatbotGuard");

module.exports = {
  name: Events.MessageCreate,
  async execute(client, message) {
    try {
      if (!message.inGuild?.()) {
        return;
      }

      const payment = await client.container.services.paymentService?.handlePaymentProofMessage?.(message);
      if (payment) {
        return;
      }

      // Validate message
      if (!message.content || typeof message.content !== "string") {
        return;
      }

      // Anti-spam enforcement
      // Skip anti-spam when the message explicitly mentions the bot (so chatbot/tag interaction can't be blocked).
      if (!message.author?.bot) {
        const antiSpamService = client.container.services?.antiSpamService;
        if (antiSpamService) {
          const botUserId = client.user?.id;
          const rawContent = String(message.content || "");
          const isBotMentioned = botUserId ? new RegExp(`<@!?${botUserId}>`).test(rawContent) : false;

          if (!isBotMentioned) {
            const analysis = await antiSpamService.analyzeMessage(message);
            if (analysis.isSpam && Array.isArray(analysis.violations) && analysis.violations.length > 0) {
              for (const violation of analysis.violations) {
                await antiSpamService.handleViolation(message, violation);
              }
              return;
            }
          }
        }
      }

      // Complete Joki when staff/admin writes a done marker in ORDER ticket channel.
      // Examples: "joki done", "joki sudah terbang"
      try {
        const lowered = message.content.trim().toLowerCase();
        const isDone =
          lowered === "joki done" ||
          lowered === "joki sudah terbang" ||
          lowered === "joki sudah terbang (cicilan)" ||
          lowered === "joki terbang";

        if (isDone && message.member) {
          const { repositories, services } = client.container;
          const ticket = await repositories.ticketRepository?.findByChannelId?.(message.channel.id);
          if (ticket && ticket.type === "order" && services?.jokiService?.completeTicketOrder) {
            const mode = lowered.includes("joki terbang") || lowered.includes("joki sudah terbang") ? "terbang" : "done";
            const doneMessage = mode === "terbang" ? "joki sudah terbang" : "joki done";

            const { hasJokiCrewAccess } = require("../../utils/permissionCheck");
            if (!hasJokiCrewAccess(message.member)) {
              return;
            }

            const result = await services.jokiService.completeTicketOrder({
              guild: message.guild,
              ticket,
              actorUser: message.author,
              mode,
            });

            if (result.ok) {
              await message.reply(`[JOKI] ${doneMessage}. Antrian joki selesai dan queue-list sudah diupdate.`).catch((replyError) => {
                client.container.logger.warn("joki done reply failed", {
                  channelId: message.channel?.id,
                  userId: message.author?.id,
                  message: replyError?.message || String(replyError),
                });
              });
            } else {
              await message.reply(`[JOKI] ${result.message}`).catch((replyError) => {
                client.container.logger.warn("joki done error reply failed", {
                  channelId: message.channel?.id,
                  userId: message.author?.id,
                  message: replyError?.message || String(replyError),
                });
              });
            }

            return;
          }
        }
      } catch (error) {
        client.container.logger.error("joki done message handling failed", {
          channelId: message.channel?.id,
          userId: message.author?.id,
          message: error.message,
        });
      }

      // Manual queue trigger for manual data without ticket/thread:
      // Examples:
      //   "joki work 0054"
      //   "joki hold GG589"
      //   "joki done 0054"
      //   "joki progress 10 0054"
      try {
        const content = message.content.trim();
        const lowered = content.toLowerCase();

        const { services } = client.container;
        const { hasJokiCrewAccess } = require("../../utils/permissionCheck");

        if (!message.member || !hasJokiCrewAccess(message.member)) {
          // no-op for customers
        } else {
          // Match 1: joki progress <N> <target>
          const p = lowered.match(/^joki\s+progress\s+(\d+)\s+([^\s]+)\s*$/i);
          if (p) {
            const amount = p[1];
            const target = p[2];

            if (!services?.jokiService?.processHeistProgress) {
              return;
            }

            const result = await services.jokiService.processHeistProgress({
              guild: message.guild,
              actorUser: message.author,
              target,
              amount,
            });

            if (!result?.ok) {
              await message.reply(`[JOKI] ${result?.message || "Gagal update progress."}`).catch((error) => client.container.logger?.warn?.("Suppressed promise rejection", { error: error?.message ?? String(error), stack: error?.stack }));
              return;
            }

            await message.reply(`[JOKI] PROGRESS +${amount} untuk ${target} berhasil diupdate.`).catch((error) => client.container.logger?.warn?.("Suppressed promise rejection", { error: error?.message ?? String(error), stack: error?.stack }));
            return;
          }

          // Match 2: joki <action> <target>
          // action: work|start|proses|hold|done
          const m = lowered.match(/^joki\s+(work|start|proses|hold|done)\s+([^\s]+)\s*$/i);
          if (m) {
            const actionWord = m[1];
            const target = m[2];

            const actionMap = {
              work: "work",
              start: "work",
              proses: "work",
              hold: "hold",
              done: "done",
            };

            const action = actionMap[actionWord] || null;
            if (!action || !services?.jokiService?.processManualQueueStatus) {
              return;
            }

            const result = await services.jokiService.processManualQueueStatus({
              guild: message.guild,
              actorUser: message.author,
              target,
              action,
              mode: "manual",
            });

            if (!result?.ok) {
              await message.reply(`[JOKI] ${result?.message || "Gagal update order."}`).catch((error) => client.container.logger?.warn?.("Suppressed promise rejection", { error: error?.message ?? String(error), stack: error?.stack }));
              return;
            }

            await message.reply(`[JOKI] ${action.toUpperCase()} ${target} berhasil diupdate.`).catch((error) => client.container.logger?.warn?.("Suppressed promise rejection", { error: error?.message ?? String(error), stack: error?.stack }));
            return;
          }
        }
      } catch (error) {
        client.container.logger.error("joki manual trigger handling failed", {
          channelId: message.channel?.id,
          userId: message.author?.id,
          message: error.message,
        });
      }

      // Prevent processing overly long messages (DoS prevention)
      if (message.content.length > 4000) {
        client.container.logger.warn("message too long", {
          userId: message.author.id,
          length: message.content.length,
        });
        return;
      }

      if (!message.author?.bot && message.content.toLowerCase().startsWith("faq ")) {
        const keyword = message.content.slice(4).trim();
        if (keyword) {
          const faq = await client.container.services.storeOpsService?.findFaq?.(message.guild.id, keyword);
          if (faq) {
            await message.reply(`**${faq.keyword}**\n${faq.answer}`).catch((replyError) => {
              client.container.logger.warn("faq quick reply failed", {
                channelId: message.channel?.id,
                userId: message.author?.id,
                message: replyError?.message || String(replyError),
              });
            });
            return;
          }
        }
      }

      const handledSensitive = await client.container.services.backlogService?.handleSensitiveDataWarning(message);
      if (handledSensitive) {
        return;
      }

      // HYPEBOTX Mention Chatbot
      try {
        const cfg = client.container.botConfig || {};
        const chatbotEnabled = cfg.chatbot?.enabled !== false && cfg.chatbot?.enabled !== "false";
        if (chatbotEnabled) {
          if (!message.author?.bot && message.guild) {
            const botUserId = client.user?.id;
            if (botUserId) {
              const raw = String(message.content || "");
              const botMentionRegex = new RegExp(`<@!?${botUserId}>`);

              const botRole =
                message.guild?.roles?.cache?.find?.((r) => String(r?.name || "").toLowerCase() === String(client.user?.username || "").toLowerCase()) ||
                null;
              const botRoleId = botRole?.id || null;
              const botRoleMentionRegex = botRoleId ? new RegExp(`<@&${botRoleId}>`, "g") : null;
              const isMentioned = botMentionRegex.test(raw) || (botRoleMentionRegex ? botRoleMentionRegex.test(raw) : false);

              let mentionUserIds = [];
              const mentionUsers = message.mentions?.users;
              if (mentionUsers?.keys && typeof mentionUsers.keys === "function") {
                mentionUserIds = Array.from(mentionUsers.keys());
              }
              client.container.logger?.info?.("[CHATBOTMENTION] mention check", {
                botUserId,
                isMentioned,
                mentionUserIds,
                messageContent: raw.slice(0, 120),
              });

              if (isMentioned) {
                let cleaned = raw.replace(new RegExp(`<@!?${botUserId}>`, "g"), "");
                if (botRoleMentionRegex) cleaned = cleaned.replace(botRoleMentionRegex, "");
                cleaned = cleaned.trim();

                client.container.logger?.info?.("[CHATBOTMENTION] mention captured", {
                  userId: message.author?.id,
                  channelId: message.channel?.id,
                  botUserId,
                  raw: raw.slice(0, 120),
                  cleaned,
                  cleanedLen: cleaned.length,
                });

                if (cleaned.length > 0) {
                  const maxLen = Number(cfg.chatbot?.maxQuestionLength ?? process.env.CHATBOT_MAX_QUESTION_LENGTH) || 500;
                  if (cleaned.length > maxLen) {
                    client.container.logger?.info?.("[CHATBOTMENTION] cleaned too long, ignore", { cleanedLen: cleaned.length, maxLen });
                    return;
                  }

                  const cooldownMs = Number(cfg.chatbot?.cooldownMs ?? process.env.CHATBOT_COOLDOWN_MS) || 5000;
                  if (!client._chatbotCooldowns) client._chatbotCooldowns = new Map();
                  const now = Date.now();
                  const last = client._chatbotCooldowns.get(message.author.id) || 0;
                  if (now - last < cooldownMs) {
                    await message.reply("Tunggu sebentar ya kak sebelum tanya lagi.").catch((error) => client.container.logger?.warn?.("Suppressed promise rejection", { error: error?.message ?? String(error), stack: error?.stack }));
                    return;
                  }
                  client._chatbotCooldowns.set(message.author.id, now);

                  const mode = getAiModeForMessage(message);

                  try {
                    const { tryResolveOwnerAnswer } = require("../../utils/storeOwnerResolver");
                    const ownerAnswer = await tryResolveOwnerAnswer({ guild: message.guild, question: cleaned });
                    if (ownerAnswer) {
                      await message.reply(ownerAnswer).catch((error) => client.container.logger?.warn?.("Suppressed promise rejection", { error: error?.message ?? String(error), stack: error?.stack }));
                      return;
                    }
                  } catch (err) {
                    client.container.logger?.error?.("[OWNER_RESOLVER] failed", { cleaned, error: err?.message || String(err) });
                  }

                  const result = await client.container.services.chatbotService?.answer?.({
                    interaction: { guild: message.guild, user: message.author, member: message.member, channel: message.channel },
                    question: cleaned,
                    questionRaw: cleaned,
                    mode,
                  });

                  if (result?.ok && result.status === "answered" && result.answer) {
                    await message.reply(result.answer).catch((error) => client.container.logger?.warn?.("Suppressed promise rejection", { error: error?.message ?? String(error), stack: error?.stack }));
                    return;
                  }

                  const shouldUseAi = result && ["not_found", "admin_required"].includes(result.status);
                  if (!shouldUseAi) {
                    const fallbackMessage = result?.message || "Datanya belum ketemu kak, aku arahkan ke admin ya.";
                    await message.reply(fallbackMessage).catch((error) => client.container.logger?.warn?.("Suppressed promise rejection", { error: error?.message ?? String(error), stack: error?.stack }));
                    return;
                  }

                  const aiToolScannerService = client.container.services.aiToolScannerService;
                  const scanResult = await aiToolScannerService?.scan?.({
                    client,
                    guild: message.guild,
                    channel: message.channel,
                    user: message.author,
                    question: cleaned,
                    mode,
                  });

                  if (!scanResult || !scanResult.ok) {
                    await message.reply("Datanya belum ada di sistem kak, aku arahkan ke admin ya.").catch((error) => client.container.logger?.warn?.("Suppressed promise rejection", { error: error?.message ?? String(error), stack: error?.stack }));
                    return;
                  }

                  const safeScan = sanitizeAiData(scanResult);
                  const scanJson = JSON.stringify(safeScan, null, 2);
                  const prompt = `Kamu adalah HYPEBOTX, assistant resmi Hyper Indo.\n\nATURAN WAJIB:\n- Jawab hanya berdasarkan TOOL_SCAN_RESULT.\n- Jangan mengarang harga, owner, co-owner, antrian, status order, status payment, refund, warranty, atau policy.\n- Kalau data tidak ada di TOOL_SCAN_RESULT, jawab: \"Datanya belum ada di sistem kak, aku arahkan ke admin ya.\"\n- Jangan tampilkan token, API key, webhook, password, cookie, session, atau secret.\n- Jangan meminta customer mengirim password di channel publik.\n- Jika data sensitif/order/payment tidak tersedia di ticket context, arahkan ke admin.\n- Jawab singkat, sopan, dan jelas dalam bahasa Indonesia.\n\nTOOL_SCAN_RESULT:\n${scanJson}\n\nUser question: ${cleaned}\n\nBerikan jawaban dalam format JSON saja, tanpa penjelasan tambahan:\n{
  "answer": "string",
  "confidence": "high|medium|low",
  "source": ["database:pricelist"],
  "needsAdmin": false
}`;

                  const aiService = client.container.services.aiService;
                  const guard = createChatbotGuard({ client });
                  const isGeneralQuestion = guard.isLikelyGeneralQuestion(cleaned);
                  const promptTemplate = isGeneralQuestion
                    ? `Kamu adalah HYPEBOTX, assistant resmi Hyper Indo. Jawab pertanyaan user dengan santun, jelas, dan singkat dalam bahasa Indonesia. Gunakan TOOL_SCAN_RESULT hanya jika relevan. Jika pertanyaan bukan tentang store/joki/payment/invoice/order, kamu boleh menjawab berdasarkan pengetahuan umum. Jika kamu tidak tahu, jawab: "Maaf kak, aku belum tahu tentang itu." Jangan mengarang informasi sensitif atau pribadi. Jangan tampilkan token, API key, webhook, password, cookie, session, atau secret. Jangan sarankan user mengirim data pribadi di channel publik.\n\nTOOL_SCAN_RESULT:\n${scanJson}\n\nUser question: ${cleaned}\n\nBerikan jawaban dalam format JSON saja, tanpa penjelasan tambahan:\n{\n  "answer": "string",\n  "confidence": "high|medium|low",\n  "source": ["database:pricelist"],\n  "needsAdmin": false\n}`
                    : `Kamu adalah HYPEBOTX, assistant resmi Hyper Indo.\n\nATURAN WAJIB:\n- Jawab hanya berdasarkan TOOL_SCAN_RESULT.\n- Jangan mengarang harga, owner, co-owner, antrian, status order, status payment, refund, warranty, atau policy.\n- Kalau data tidak ada di TOOL_SCAN_RESULT, jawab: \"Datanya belum ada di sistem kak, aku arahkan ke admin ya.\"\n- Jangan tampilkan token, API key, webhook, password, cookie, session, atau secret.\n- Jangan meminta customer mengirim password di channel publik.\n- Jika data sensitif/order/payment tidak tersedia di ticket context, arahkan ke admin.\n- Jawab singkat, sopan, dan jelas dalam bahasa Indonesia.\n\nTOOL_SCAN_RESULT:\n${scanJson}\n\nUser question: ${cleaned}\n\nBerikan jawaban dalam format JSON saja, tanpa penjelasan tambahan:\n{\n  "answer": "string",\n  "confidence": "high|medium|low",\n  "source": ["database:pricelist"],\n  "needsAdmin": false\n}`;

                  const aiResult = await aiService?.processRequest?.(message.author.id, promptTemplate, {
                    systemPrompt: isGeneralQuestion
                      ? "You are HYPEBOTX, a helpful assistant that answers politely in Indonesian. Use provided context when relevant but feel free to answer general questions based on common knowledge."
                      : "You are HYPEBOTX, a safe and factual assistant that only answers from the provided TOOL_SCAN_RESULT.",
                    maxTokens: 700,
                    temperature: 0.1,
                  }).catch(() => null);

                  if (aiResult?.success && aiResult.response) {
                    const parsed = parseAIResponse(aiResult.response);
                    if (parsed && parsed.answer && parsed.answer.trim()) {
                      if (parsed.needsAdmin === true || String(parsed.confidence || "").toLowerCase() === "low") {
                        await message.reply("Datanya belum ada di sistem kak, aku arahkan ke admin ya.").catch((error) => client.container.logger?.warn?.("Suppressed promise rejection", { error: error?.message ?? String(error), stack: error?.stack }));
                        return;
                      }

                      await message.reply(parsed.answer.trim()).catch((error) => client.container.logger?.warn?.("Suppressed promise rejection", { error: error?.message ?? String(error), stack: error?.stack }));
                      return;
                    }
                  }

                  await message.reply("Datanya belum ada di sistem kak, aku arahkan ke admin ya.").catch((error) => client.container.logger?.warn?.("Suppressed promise rejection", { error: error?.message ?? String(error), stack: error?.stack }));
                  return;
                }

                await message.reply("Halo kak 🙌 Mau cek harga, order, payment, invoice, joki, warranty, refund, atau status pesanan?").catch((error) => client.container.logger?.warn?.("Suppressed promise rejection", { error: error?.message ?? String(error), stack: error?.stack }));
                return;
              }
            }
          }
        }
      } catch (e) {
        client.container.logger?.warn?.("chatbot mention failed", { message: e?.message || String(e) });
      }

      await client.container.services.moderationService.handleMessage(message);
    } catch (error) {
      client.container.services.monitoringService?.captureError?.(error, {
        type: 'message',
        feature: 'messageCreate',
        userId: message.author?.id,
        guildId: message.guild?.id,
      });

      client.container.logger.error("message create event error", {
        userId: message.author?.id,
        guildId: message.guild?.id,
        error: error.message,
      });
    }
  },
};
