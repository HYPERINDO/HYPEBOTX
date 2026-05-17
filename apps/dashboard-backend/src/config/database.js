import fs from "node:fs";
import path from "node:path";
import { env } from "./env.js";

export function ensureDataDirs() {
  fs.mkdirSync(env.botStorageDir, { recursive: true });
  fs.mkdirSync(env.dashboardStorageDir, { recursive: true });
}

export function botDataFile(fileName) {
  return path.join(env.botStorageDir, fileName);
}

export function dashboardDataFile(fileName) {
  return path.join(env.dashboardStorageDir, fileName);
}
