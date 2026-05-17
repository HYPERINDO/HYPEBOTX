const http = require("http");
const https = require("https");

function safeJson(value) {
    return JSON.stringify(value, (key, item) => {
        if (/token|webhook|authorization|password|secret/i.test(key)) {
            return "[REDACTED]";
        }
        if (typeof item === "string" && /https:\/\/discord(?:app)?\.com\/api\/webhooks\//i.test(item)) {
            return "[REDACTED_WEBHOOK_URL]";
        }
        return item;
    }, 2);
}

function postJson(webhookUrl, payload) {
    return new Promise((resolve, reject) => {
        try {
            const url = new URL(webhookUrl);
            const data = Buffer.from(JSON.stringify(payload));
            const transport = url.protocol === "https:" ? https : http;

            const options = {
                hostname: url.hostname,
                port: url.port || (url.protocol === "https:" ? 443 : 80),
                path: url.pathname + url.search,
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": data.length,
                },
            };

            const req = transport.request(options, (res) => {
                let body = "";
                res.on("data", (chunk) => {
                    body += chunk;
                });
                res.on("end", () => {
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(body);
                    } else {
                        reject(new Error(`Webhook failed: ${res.statusCode} ${body}`));
                    }
                });
            });

            req.on("error", reject);
            req.write(data);
            req.end();
        } catch (err) {
            reject(err);
        }
    });
}

function createWebhookLogger(webhookUrl) {
    if (!webhookUrl) {
        return {
            log: async () => null,
        };
    }

    async function log(message, { level = "INFO", extra } = {}) {
        const content = [
            `**${level}** ${message}`,
            extra ? `\`\`\`json\n${safeJson(extra).slice(0, 1700)}\n\`\`\`` : "",
        ].filter(Boolean).join("\n");
        return postJson(webhookUrl, {
            username: "HYPEBOTX Logger",
            content,
        }).catch((error) => {
            // logger ini dipakai sebagai fallback global, jadi gunakan stderr langsung.
            console.warn("[webhook-discord-logger] send failed:", error?.message || String(error));
            return null;
        });
    }

    return {
        log,
    };
}

module.exports = {
    createWebhookLogger,
};

