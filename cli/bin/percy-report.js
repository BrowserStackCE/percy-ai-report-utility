#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { Command } from "commander";
import { AuthError, RATE_LIMIT_PER_MINUTE, validateBrowserStack, validatePercyToken } from "../lib/percyAuth.js";
import { REPORT_SITE_URL } from "../lib/config.js";
import { ask } from "../lib/prompt.js";
import { clearCredentials, loadCredentials, mask, saveCredentials } from "../lib/store.js";

const { version } = createRequire(import.meta.url)("../package.json");
const WEB_URL = (process.env.PERCY_REPORT_URL || REPORT_SITE_URL).replace(/\/+$/, "");

function printError(err) {
  console.error(`\n✖ ${err.message}`);
  if (err instanceof AuthError && err.hint) console.error(`  ${err.hint}`);
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
  // The fragment is never sent to any server; the web app moves it into a cookie and clears it.
  const payload = Buffer.from(JSON.stringify(creds)).toString("base64url");
  return `${WEB_URL}/auth/callback#d=${payload}`;
}

/** Open the browser only on an interactive machine: never in CI or without a TTY. */
function canOpenBrowser(opts) {
  if (opts.open === false) return false;
  if (process.env.CI && process.env.CI !== "false") return false;
  return Boolean(process.stdout.isTTY);
}

function openBrowser(url) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  try {
    const child = spawn(cmd, args, { stdio: "ignore", detached: true });
    child.on("error", () => {});
    child.unref();
  } catch {
    /* the link is printed anyway */
  }
}

function printStatusLines(c) {
  console.log(`  Percy token:   ${c.percyToken ? `✔ ${mask(c.percyToken)}` : "— not set"}`);
  console.log(`  BrowserStack:  ${c.username ? `✔ ${c.username} / ${mask(c.accessKey)}` : "— not set"}`);
}

async function login(opts) {
  const saved = loadCredentials();
  let token = opts.percyToken ?? process.env.PERCY_TOKEN;
  let username = opts.username ?? process.env.BROWSERSTACK_USERNAME;
  let accessKey = opts.accessKey ?? process.env.BROWSERSTACK_ACCESS_KEY;

  if (!token && !username && !accessKey) {
    if (!process.stdin.isTTY) {
      console.error("✖ No credentials provided. Pass --percy-token / --username / --access-key or set env vars.");
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
  if (canOpenBrowser(opts)) openBrowser(link);
  if (failed) process.exitCode = 2;
}

async function status() {
  const c = loadCredentials();
  if (!c.percyToken && !c.username) {
    console.log("Not authenticated. Run: npx percy-report-utility login");
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

const program = new Command();
program
  .name("percy-report-utility")
  .description("Authenticate with Percy / BrowserStack and open the Percy AI Report site already signed in")
  .version(version)
  .addHelpText(
    "after",
    `
Environment fallbacks: PERCY_TOKEN, BROWSERSTACK_USERNAME, BROWSERSTACK_ACCESS_KEY
Report site: ${WEB_URL} (override with PERCY_REPORT_URL)
Percy rate limit: about ${RATE_LIMIT_PER_MINUTE} read requests per minute per client IP.`,
  );

program
  .command("login")
  .description("Validate a Percy token and/or BrowserStack credentials, store them, and open the report site")
  .option("--percy-token <percyToken>", "Percy read-only or full-access project token (default: PERCY_TOKEN)")
  .option("--username <username>", "BrowserStack username (default: BROWSERSTACK_USERNAME)")
  .option("--access-key <accessKey>", "BrowserStack access key (default: BROWSERSTACK_ACCESS_KEY)")
  .option("--no-open", "Print the link without opening the browser")
  .action(login);

program.command("status").description("Re-validate the stored credentials").action(status);

program
  .command("logout")
  .description("Remove the stored credentials")
  .option("--no-open", "Do not open the browser to sign out of the website")
  .action((opts) => {
    clearCredentials();
    console.log("Logged out. Stored credentials removed.");
    const link = `${WEB_URL}/auth/logout`;
    if (canOpenBrowser(opts)) {
      console.log(`Signing out of the report site:\n  ${link}`);
      openBrowser(link);
    } else {
      console.log(`To also sign out of the website, open:\n  ${link}`);
    }
  });

await program.parseAsync(process.argv);
