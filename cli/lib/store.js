import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const CONFIG_DIR = path.join(os.homedir(), ".percy-report");
export const CREDS_FILE = path.join(CONFIG_DIR, "credentials.json");

export function loadCredentials() {
  try {
    return JSON.parse(fs.readFileSync(CREDS_FILE, "utf8"));
  } catch {
    return {};
  }
}

export function saveCredentials(creds) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(CREDS_FILE, JSON.stringify(creds, null, 2), { mode: 0o600 });
  fs.chmodSync(CREDS_FILE, 0o600);
}

export function clearCredentials() {
  fs.rmSync(CREDS_FILE, { force: true });
}

export function mask(value) {
  if (!value) return "";
  return value.length <= 8 ? "****" : `${value.slice(0, 4)}…${value.slice(-4)}`;
}
