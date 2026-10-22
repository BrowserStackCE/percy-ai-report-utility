import test from "node:test";
import assert from "node:assert/strict";
import { AuthError, basicHeader, interpretStatus, validateBrowserStack, validatePercyToken } from "../lib/percyAuth.js";

const fakeFetch = (status, headers = {}) => async () => ({
  status,
  headers: { get: (k) => headers[k.toLowerCase()] ?? null },
});

test("basicHeader encodes username:key", () => {
  assert.equal(basicHeader("u", "k"), "Basic " + Buffer.from("u:k").toString("base64"));
});

test("200 is valid", async () => {
  assert.equal(await validatePercyToken("t", fakeFetch(200)), true);
  assert.equal(await validateBrowserStack("u", "k", fakeFetch(200)), true);
});

test("sends Token header for percy tokens", async () => {
  let seen;
  await validatePercyToken("abc", async (_u, o) => ((seen = o.headers.Authorization), { status: 200, headers: { get: () => null } }));
  assert.equal(seen, "Token abc");
});

for (const [status, text] of [
  [401, /Percy token is invalid/],
  [403, /Forbidden/],
  [404, /Not found/],
  [422, /Unprocessable/],
  [429, /400 read requests per minute/],
  [503, /server error/],
]) {
  test(`maps ${status}`, async () => {
    await assert.rejects(validatePercyToken("t", fakeFetch(status)), (e) => e instanceof AuthError && text.test(e.message));
  });
}

test("BrowserStack credentials use plural wording", () => {
  assert.match(interpretStatus(401, "basic").message, /credentials are invalid/);
});

test("429 hint includes retry-after", () => {
  assert.match(interpretStatus(429, "token", "30").hint, /30s/);
});

test("network failure becomes NETWORK error", async () => {
  await assert.rejects(
    validatePercyToken("t", async () => { throw new Error("boom"); }),
    (e) => e.code === "NETWORK",
  );
});
