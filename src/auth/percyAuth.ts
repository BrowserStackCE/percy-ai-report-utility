// Credential validation for the login form. Requests go through the dev proxy in vite.config.ts.
// Errors come from the shared API error module so the whole app words them the same way.
import { ApiError, errorFromStatus, type CredentialKind } from "../api/errors";

export { RATE_LIMIT_PER_MINUTE } from "../api/errors";

// Project tokens are checked against /builds (write-only tokens get 403); BrowserStack creds against /user.
const endpointFor = (kind: CredentialKind) =>
  kind === "token" ? "/percy-api/builds?page[limit]=1" : "/percy-api/user";

async function probe(authorization: string, kind: CredentialKind) {
  let res: Response;
  try {
    res = await fetch(endpointFor(kind), {
      headers: { Authorization: authorization, Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new ApiError("network", "Could not reach Percy.", {
      hint: "Check your connection and that the dev server is running.",
    });
  }
  const err = errorFromStatus(res.status, kind, res.headers.get("retry-after"));
  if (err) throw err;
}

export const validatePercyToken = (token: string) => probe(`Token ${token}`, "token");
export const validateBrowserStack = (username: string, accessKey: string) =>
  probe(`Basic ${btoa(`${username}:${accessKey}`)}`, "basic");
