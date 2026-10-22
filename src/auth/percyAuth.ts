// Mirrors cli/lib/percyAuth.js. Requests go through the dev proxy configured in vite.config.ts.
export const RATE_LIMIT_PER_MINUTE = 400;
// Project tokens are checked against /builds (write-only tokens get 403); BrowserStack creds against /user.
const endpointFor = (kind: "token" | "basic") =>
  kind === "token" ? "/percy-api/builds?page[limit]=1" : "/percy-api/user";

export type CredentialKind = "token" | "basic";

export class AuthError extends Error {
  status: number | "NETWORK";
  hint?: string;
  constructor(status: number | "NETWORK", message: string, hint?: string) {
    super(message);
    this.status = status;
    this.hint = hint;
  }
}

export function interpretStatus(status: number, kind: CredentialKind, retryAfter?: string | null): AuthError | null {
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
      if (status >= 500) return new AuthError(status, `Percy / BrowserStack server error (${status}).`, "Try again in a few moments.");
      return new AuthError(status, `Unexpected response from Percy (HTTP ${status}).`);
  }
}

async function probe(authorization: string, kind: CredentialKind) {
  let res: Response;
  try {
    res = await fetch(endpointFor(kind), {
      headers: { Authorization: authorization, Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new AuthError("NETWORK", "Could not reach Percy.", "Check your connection and that the dev server is running.");
  }
  const err = interpretStatus(res.status, kind, res.headers.get("retry-after"));
  if (err) throw err;
}

export const validatePercyToken = (token: string) => probe(`Token ${token}`, "token");
export const validateBrowserStack = (username: string, accessKey: string) =>
  probe(`Basic ${btoa(`${username}:${accessKey}`)}`, "basic");
