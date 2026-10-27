// Credential validation against the Percy API.
// Docs: https://www.browserstack.com/docs/percy/api-reference/authentication

// Override with PERCY_API_URL, e.g. the deployed proxy: https://percy-ai-report.vercel.app/percy-api
export const PERCY_API = (process.env.PERCY_API_URL || "https://percy.io/api/v1").replace(/\/+$/, "");
export const RATE_LIMIT_PER_MINUTE = 400;

export class AuthError extends Error {
  constructor(code, message, hint) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.hint = hint;
  }
}

export function basicHeader(username, accessKey) {
  return "Basic " + Buffer.from(`${username}:${accessKey}`).toString("base64");
}

export function tokenHeader(token) {
  return `Token ${token}`;
}

/** Map an HTTP status to a friendly AuthError (or null when it is a success). */
export function interpretStatus(status, kind, retryAfter) {
  if (status === 200) return null;
  const who = kind === "token" ? "Percy token" : "BrowserStack credentials";
  const are = kind === "token" ? "is" : "are";
  switch (status) {
    case 401:
      return new AuthError(
        401,
        `Unauthorized: your ${who} ${are} invalid.`,
        kind === "token"
          ? "Copy the token again from Project Settings in Percy."
          : "Find your username and access key on your BrowserStack profile page.",
      );
    case 403:
      return new AuthError(
        403,
        `Forbidden: your ${who} ${are} valid but cannot perform this action.`,
        kind === "token"
          ? "Write-only tokens cannot read builds. Use a read-only or full-access token for this project."
          : "Your role does not allow access to this resource.",
      );
    case 404:
      return new AuthError(404, "Not found: the requested resource could not be found.");
    case 422:
      return new AuthError(422, "Unprocessable entity: the request was well-formed but has semantic errors.");
    case 429:
      return new AuthError(
        429,
        `Too many requests: you exceeded the Percy rate limit (about ${RATE_LIMIT_PER_MINUTE} read requests per minute per client IP).`,
        `Wait${retryAfter ? ` ${retryAfter}s` : ""} and retry with an exponentially increasing delay.`,
      );
    default:
      if (status >= 500) {
        return new AuthError(status, `Percy / BrowserStack server error (${status}).`, "Try again in a few moments.");
      }
      return new AuthError(status, `Unexpected response from Percy (HTTP ${status}).`);
  }
}

async function probe(authorization, kind, fetchImpl) {
  let res;
  // Project tokens are validated against /builds (write-only tokens correctly get 403).
  // BrowserStack user credentials are validated against /user.
  const path = kind === "token" ? "/builds?page[limit]=1" : "/user";
  try {
    res = await fetchImpl(`${PERCY_API}${path}`, {
      headers: { Authorization: authorization, Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    const timedOut = err?.name === "TimeoutError" || err?.name === "AbortError";
    throw new AuthError(
      "NETWORK",
      timedOut ? "Request to Percy timed out." : `Could not reach Percy: ${err?.cause?.code ?? err.message}`,
      "Check your internet connection or proxy settings.",
    );
  }
  const err = interpretStatus(res.status, kind, res.headers.get("retry-after"));
  if (err) throw err;
  return true;
}

/** Throws AuthError when invalid. Resolves true when valid. */
export function validatePercyToken(token, fetchImpl = fetch) {
  return probe(tokenHeader(token), "token", fetchImpl);
}

export function validateBrowserStack(username, accessKey, fetchImpl = fetch) {
  return probe(basicHeader(username, accessKey), "basic", fetchImpl);
}
