import { ApiError, errorFromStatus, type CredentialKind } from "./errors";
import type { StoredCredentials } from "../auth/cookies";

/**
 * Base path for Percy requests. In development the Vite dev server forwards this to
 * https://percy.io/api/v1 (see vite.config.ts); credentials are sent only to Percy.
 */
export const API_BASE = "/percy-api";
const DEFAULT_TIMEOUT_MS = 15_000;

export interface Auth {
  header: string;
  kind: CredentialKind;
}

/**
 * Pick the Authorization header from stored credentials. BrowserStack credentials come first
 * because they list every project the user can access; a project token only sees its own project.
 */
export function authFromCredentials(c: StoredCredentials): Auth | null {
  if (c.username && c.accessKey) {
    return { header: `Basic ${btoa(`${c.username}:${c.accessKey}`)}`, kind: "basic" };
  }
  if (c.percyToken) return { header: `Token ${c.percyToken}`, kind: "token" };
  return null;
}

export interface RequestOptions {
  auth: Auth;
  /** Query string values; undefined entries are skipped. */
  query?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
  timeoutMs?: number;
}

function buildUrl(path: string, query: RequestOptions["query"]): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) params.set(key, String(value));
  }
  const qs = params.toString();
  return `${API_BASE}${path}${qs ? `?${qs}` : ""}`;
}

/** GET a Percy resource and return parsed JSON. Throws ApiError for every failure mode. */
export async function percyGet(path: string, { auth, query, signal, timeoutMs = DEFAULT_TIMEOUT_MS }: RequestOptions): Promise<unknown> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      headers: { Authorization: auth.header, Accept: "application/json" },
      signal: combined,
    });
  } catch (err) {
    // A caller-initiated abort is not an error to report; let it propagate untouched.
    if (signal?.aborted) throw err;
    if (timeout.aborted) {
      throw new ApiError("timeout", "Request to Percy timed out.", { hint: "Check your connection and try again." });
    }
    throw new ApiError("network", "Could not reach Percy.", {
      hint: "Check your internet connection and that the dev server is running.",
    });
  }

  const failure = errorFromStatus(res.status, auth.kind, res.headers.get("retry-after"));
  if (failure) throw failure;

  try {
    return await res.json();
  } catch {
    throw new ApiError("invalid_response", "Percy returned a response that is not valid JSON.", { status: res.status });
  }
}
