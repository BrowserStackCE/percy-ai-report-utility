#!/usr/bin/env node
import { spawn } from "node:child_process";
import { AuthError, validateBrowserStack, validatePercyToken } from "../lib/percyAuth.js";
import { ask } from "../lib/prompt.js";
import { clearCredentials, loadCredentials, mask, saveCredentials } from "../lib/store.js";

const WEB_URL = process.env.PERCY_REPORT_URL || "http://localhost:5173";

const HELP = `percy-report — authenticate with Percy / BrowserStack

Usage:
  percy-report login [--token <percy token>] [--username <u> --access-key <k>] [--no-open]
  percy-report status
  percy-report logout

Environment fallbacks: PERCY_TOKEN, BROWSERSTACK_USERNAME, BROWSERSTACK_ACCESS_KEY
Report site: ${WEB_URL} (override with PERCY_REPORT_URL)
`;

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--no-open") out.noOpen = true;
    else if (a === "--token") out.token = argv[++i];
    else if (a === "--username") out.username = argv[++i];
    else if (a === "--access-key") out.accessKey = argv[++i];
    else if (a === "-h" || a === "--help") out.help = true;
    else out._.push(a);
  }
  return out;
}

function printError(err) {
  if (err instanceof AuthError) {
    console.error(`\n✖ ${err.message}`);
    if (err.hint) console.error(`  ${err.hint}`);
  } else {
    console.error(`\n✖ ${err.message}`);
  }
}

/** Run a validator; returns true/false and prints errors without throwing. */
async function check(label, fn) {
  process.stdout.write(`Validating ${label}… `);
  try {
    await fn();
    console.log("✔ valid");
    return true;
  } catch (err) {
    console.log("✖");
    printError(err);
    return false;
  }
}

function buildLink(creds) {
  // Fragment is never sent to any server; the web app moves it into cookies and clears it.
  const payload = Buffer.from(JSON.stringify(creds)).toString("base64url");
  return `${WEB_URL}/auth/callback#d=${payload}`;
}

function openBrowser(url) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  try {
    spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
  } catch {
    /* link is printed anyway */
  }
}

async function login(args) {
  const saved = loadCredentials();
  let token = args.token ?? process.env.PERCY_TOKEN;
  let username = args.username ?? process.env.BROWSERSTACK_USERNAME;
  let accessKey = args.accessKey ?? process.env.BROWSERSTACK_ACCESS_KEY;

  const interactive = !token && !username && !accessKey;
  if (interactive) {
    if (!process.stdin.isTTY) {
      console.error("✖ No credentials provided. Pass --token / --username / --access-key or set env vars.");
      process.exit(1);
    }
    console.log("Authenticate with a Percy project token and/or BrowserStack credentials.");
    console.log("Leave a section blank to skip it.\n");
    token = await ask("Percy token: ", { hidden: true });
    username = await ask("BrowserStack username: ");
    if (username) accessKey = await ask("BrowserStack access key: ", { hidden: true });
  }

  if ((username && !accessKey) || (!username && accessKey)) {
    console.error("✖ BrowserStack authentication needs both a username and an access key.");
    process.exit(1);
  }
  if (!token && !username) {
    console.error("✖ Nothing to authenticate. Provide a Percy token and/or BrowserStack credentials.");
    process.exit(1);
  }

  const creds = {};
  let failed = false;
  if (token) {
    if (await check("Percy token", () => validatePercyToken(token))) creds.percyToken = token;
    else failed = true;
  }
  if (username) {
    if (await check("BrowserStack credentials", () => validateBrowserStack(username, accessKey))) {
      creds.username = username;
      creds.accessKey = accessKey;
    } else failed = true;
  }

  if (!creds.percyToken && !creds.username) {
    console.error("\nAuthentication failed. Nothing was saved.");
    process.exit(1);
  }

  const merged = { ...saved, ...creds };
  saveCredentials(merged);
  if (failed) console.log("\n⚠ Some credentials were rejected and were not saved (see above).");
  console.log("\n✔ Authenticated");
  printStatusLines(merged);

  const link = buildLink(merged);
  console.log(`\nOpen the report site (already authenticated):\n  ${link}\n`);
  if (!args.noOpen) openBrowser(link);
  if (failed) process.exit(2);
}

function printStatusLines(c) {
  console.log(`  Percy token:   ${c.percyToken ? `✔ ${mask(c.percyToken)}` : "— not set"}`);
  console.log(`  BrowserStack:  ${c.username ? `✔ ${c.username} / ${mask(c.accessKey)}` : "— not set"}`);
}

async function status() {
  const c = loadCredentials();
  if (!c.percyToken && !c.username) {
    console.log("Not authenticated. Run: percy-report login");
    process.exit(1);
  }
  let ok = true;
  if (c.percyToken) ok = (await check("Percy token", () => validatePercyToken(c.percyToken))) && ok;
  if (c.username) ok = (await check("BrowserStack credentials", () => validateBrowserStack(c.username, c.accessKey))) && ok;
  if (!ok) process.exit(1);
  console.log("\n✔ Authenticated");
  printStatusLines(c);
  console.log(`\nReport site: ${buildLink(c)}`);
}

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
if (args.help || !cmd) {
  console.log(HELP);
} else if (cmd === "login") {
  await login(args);
} else if (cmd === "status") {
  await status();
} else if (cmd === "logout") {
  clearCredentials();
  console.log("Logged out. Stored credentials removed (browser cookies are cleared from the website's Sign out).");
} else {
  console.error(`Unknown command: ${cmd}\n`);
  console.log(HELP);
  process.exit(1);
}
