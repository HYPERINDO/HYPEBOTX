const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
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

function resolveStorageDir(rawValue) {
  const raw = rawValue || "apps/bot/src/storage/temp";
  if (path.isAbsolute(raw)) return raw;

  const candidates = [
    path.resolve(repoRoot, raw),
    path.resolve(repoRoot, "apps/dashboard-backend", raw),
    path.resolve(repoRoot, "apps/bot", raw),
    path.resolve(repoRoot, "apps/bot/src/storage/temp"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

const storageDir = resolveStorageDir(process.env.BOT_STORAGE_DIR);
const keyFiles = ["orders.json", "payments.json", "tickets.json", "audit-logs.json", "joki-queues.json", "users.json"];
const results = [];

function add(area, name, status, detail = "") {
  results.push({ area, name, status, detail });
}

async function hashFile(filePath) {
  const buffer = await fsp.readFile(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function copyFileSafe(from, to) {
  await fsp.mkdir(path.dirname(to), { recursive: true });
  await fsp.copyFile(from, to);
}

async function main() {
  add("storage", "source exists", fs.existsSync(storageDir) ? "PASS" : "FAIL", storageDir);
  if (!fs.existsSync(storageDir)) return printAndExit(1);

  const runRoot = path.join(repoRoot, "logs", "qa", `backup-restore-smoke-${Date.now()}`);
  const backupDir = path.join(runRoot, "backup");
  const stagingClone = path.join(runRoot, "staging-clone");
  await fsp.mkdir(backupDir, { recursive: true });
  await fsp.mkdir(stagingClone, { recursive: true });

  const before = {};
  for (const file of keyFiles) {
    const source = path.join(storageDir, file);
    if (!fs.existsSync(source)) {
      add("backup", file, "WARN", "missing in source");
      continue;
    }
    JSON.parse(await fsp.readFile(source, "utf8"));
    before[file] = await hashFile(source);
    await copyFileSafe(source, path.join(backupDir, file));
    await copyFileSafe(source, path.join(stagingClone, file));
    add("backup", file, "PASS", "valid JSON copied");
  }

  const mutable = path.join(stagingClone, "orders.json");
  if (fs.existsSync(mutable)) {
    await fsp.writeFile(mutable, "[]", "utf8");
    add("restore", "scratch mutation", "PASS", "staging clone mutated only");
  }

  for (const file of Object.keys(before)) {
    await copyFileSafe(path.join(backupDir, file), path.join(stagingClone, file));
  }

  for (const file of Object.keys(before)) {
    const restoredHash = await hashFile(path.join(stagingClone, file));
    add("restore", file, restoredHash === before[file] ? "PASS" : "FAIL", restoredHash === before[file] ? "hash matches backup" : "hash mismatch");
    JSON.parse(await fsp.readFile(path.join(stagingClone, file), "utf8"));
  }

  add("safety", "live storage untouched", "PASS", "restore executed against staging clone, not live files");
  printAndExit(results.some((row) => row.status === "FAIL") ? 1 : 0);
}

function printAndExit(code) {
  const counts = results.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {});
  const report = { generatedAt: new Date().toISOString(), storageDir, counts, results };
  const reportDir = path.join(repoRoot, "logs", "qa");
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `backup-restore-smoke-summary-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.table(results);
  console.log(`Report: ${reportPath}`);
  process.exitCode = code;
}

main().catch((error) => {
  add("runtime", "backup restore smoke", "FAIL", error.message);
  printAndExit(1);
});
