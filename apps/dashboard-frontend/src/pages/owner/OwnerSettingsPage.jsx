import { useEffect, useState } from "react";
import { ownerService } from "../../services/ownerService.js";

export default function OwnerSettingsPage() {
  const [status, setStatus] = useState(null);
  const [aiUsage, setAiUsage] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  async function load() {
    const [botStatus, usage] = await Promise.allSettled([ownerService.botStatus(), ownerService.aiUsage()]);
    if (botStatus.status === "fulfilled") setStatus(botStatus.value.status || botStatus.value);
    if (usage.status === "fulfilled") setAiUsage(usage.value.usage || usage.value);
  }

  useEffect(() => {
    load();
  }, []);

  async function run(label, task) {
    setBusy(label);
    setMessage("");
    try {
      const result = await task();
      setMessage(result.message || (result.queued ? `${label} masuk antrean.` : `${label} berhasil.`));
      await load();
    } catch (error) {
      setMessage(error.response?.data?.message || `${label} gagal.`);
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="split-stack">
      <section className="content-panel">
        <div className="panel-heading">
          <div>
            <h2>Bot Control</h2>
          <span>{status?.online ? "online" : status?.status || status?.botStatus || "unknown"}</span>
          </div>
        </div>
        <div className="settings-grid">
          <div><strong>Process</strong><span>{status?.processName || status?.service || status?.name || "hypebotx-bot"}</span></div>
          <div><strong>Uptime</strong><span>{status?.uptime || "-"}</span></div>
          <div><strong>Memory</strong><span>{status?.memory || "-"}</span></div>
          <div><strong>AI Usage</strong><span>{Array.isArray(aiUsage) ? `${aiUsage.length} item` : aiUsage?.totalTokens || aiUsage?.tokens || "-"}</span></div>
        </div>
        <div className="button-row">
          {["start", "restart", "stop"].map((action) => (
            <button key={action} className={`table-action ${action === "stop" ? "danger" : ""}`} type="button" disabled={Boolean(busy)} onClick={() => run(action, () => ownerService.botAction(action))}>
              {busy === action ? "..." : action}
            </button>
          ))}
          <button className="table-action" type="button" disabled={Boolean(busy)} onClick={() => run("backup", () => ownerService.backup())}>
            {busy === "backup" ? "..." : "backup"}
          </button>
          <button className="table-action" type="button" disabled={Boolean(busy)} onClick={load}>refresh</button>
        </div>
        {message ? <p className="inline-alert">{message}</p> : null}
      </section>

      <section className="content-panel">
        <div className="panel-heading">
          <h2>Runtime Settings</h2>
          <span>Protected</span>
        </div>
        <div className="settings-list">
          <div><strong>Discord OAuth</strong><span>Login memakai session httpOnly dan role dashboard.</span></div>
          <div><strong>Storage</strong><span>Bot dan dashboard membaca data JSON bersama.</span></div>
          <div><strong>Command Mode</strong><span>Slash command publik dipadatkan ke panel tombol.</span></div>
        </div>
      </section>
    </main>
  );
}
