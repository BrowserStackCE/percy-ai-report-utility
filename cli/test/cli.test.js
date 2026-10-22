import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "bin", "percy-report.js");
const pkg = JSON.parse(fs.readFileSync(path.join(path.dirname(BIN), "..", "package.json"), "utf8"));

// Run the real binary with an empty HOME and no credentials in the environment.
function run(args, extraEnv = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "percy-cli-"));
  const env = { PATH: process.env.PATH, HOME: home, USERPROFILE: home, ...extraEnv };
  const res = spawnSync(process.execPath, [BIN, ...args], { env, encoding: "utf8", input: "" });
  return { ...res, home };
}

test("--help lists the commands and the rate limit", () => {
  const r = run(["--help"]);
  assert.equal(r.status, 0);
  for (const word of ["login", "status", "logout", "400 read requests per minute"]) assert.match(r.stdout, new RegExp(word));
});

test("--version prints the package version", () => {
  assert.equal(run(["--version"]).stdout.trim(), pkg.version);
});

test("unknown command fails", () => {
  const r = run(["bogus"]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /unknown command/i);
});

test("status while logged out exits 1", () => {
  const r = run(["status"]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /Not authenticated/);
});

test("login with no credentials and no TTY exits 1 without saving", () => {
  const r = run(["login"]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /No credentials provided/);
  assert.equal(fs.existsSync(path.join(r.home, ".percy-report", "credentials.json")), false);
});

test("login with half a BrowserStack pair is rejected before any network call", () => {
  const r = run(["login", "--username", "someone"]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /both a username and an access key/);
});

test("logout removes stored credentials", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "percy-cli-"));
  const dir = path.join(home, ".percy-report");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "credentials.json"), JSON.stringify({ percyToken: "x" }));
  const res = spawnSync(process.execPath, [BIN, "logout"], { env: { PATH: process.env.PATH, HOME: home, USERPROFILE: home }, encoding: "utf8" });
  assert.equal(res.status, 0);
  assert.equal(fs.existsSync(path.join(dir, "credentials.json")), false);
});

test("logout in CI prints the website sign-out link instead of opening a browser", () => {
  const reportUrl = process.env.PERCY_REPORT_URL ?? "http://localhost:5173";
  const r = run(["logout"], { CI: "true", PERCY_REPORT_URL: reportUrl });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /To also sign out of the website, open/);
  assert.ok(r.stdout.includes(`${reportUrl}/auth/logout`), `expected ${reportUrl}/auth/logout in:\n${r.stdout}`);
});
