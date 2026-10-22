// Typed errors for every Percy API call. Messages follow the status table in the Percy API docs:
// https://www.browserstack.com/docs/percy/api-reference/authentication

export const RATE_LIMIT_PER_MINUTE = 400;

/** What kind of credential made the request; only used to word the message. */
export type CredentialKind = "token" | "basic";

export type ApiErrorKind =
  | "unauthorized" // 401
  | "forbidden" // 403
  | "not_found" // 404
  | "unprocessable" // 422
  | "rate_limited" // 429
  | "server" // 5xx
  | "network" // could not reach Percy
  | "timeout"
  | "invalid_response" // 2xx but not the JSON we expect
  | "not_authenticated" // no credentials stored
  | "unexpected";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly hint?: string;
  /** Seconds, from the Retry-After header, when Percy sends one. */
  readonly retryAfter?: number;

  constructor(kind: ApiErrorKind, message: string, opts: { status?: number; hint?: string; retryAfter?: number } = {}) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = opts.status ?? null;
    this.hint = opts.hint;
    this.retryAfter = opts.retryAfter;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

/** Whether trying again later could succeed. Drives the "Retry" button. */
export function isRetryable(e: ApiError): boolean {
  return e.kind === "rate_limited" || e.kind === "server" || e.kind === "network" || e.kind === "timeout";
}

function parseRetryAfter(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Map a non-success HTTP status to an ApiError. Returns null for 2xx. */
export function errorFromStatus(status: number, kind: CredentialKind, retryAfterHeader?: string | null): ApiError | null {
  if (status >= 200 && status < 300) return null;
  const who = kind === "token" ? "Percy token" : "BrowserStack credentials";
  const are = kind === "token" ? "is" : "are";
  switch (status) {
    case 401:
      return new ApiError("unauthorized", `Unauthorized: your ${who} ${are} invalid.`, {
        status,
        hint:
          kind === "token"
            ? "Copy the token again from Project Settings in Percy."
            : "Find your username and access key on your BrowserStack profile page.",
      });
    case 403:
      return new ApiError("forbidden", `Forbidden: your ${who} ${are} valid but cannot perform this action.`, {
        status,
        hint:
          kind === "token"
            ? "Write-only tokens cannot read data. Use a read-only or full-access token for this project."
            : "Your role does not allow access to this resource.",
      });
    case 404:
      return new ApiError("not_found", "Not found: the requested resource could not be found.", { status });
    case 422:
      return new ApiError("unprocessable", "Unprocessable entity: the request was well-formed but has semantic errors.", { status });
    case 429: {
      const retryAfter = parseRetryAfter(retryAfterHeader);
      return new ApiError(
        "rate_limited",
        `Too many requests: you exceeded the Percy rate limit (about ${RATE_LIMIT_PER_MINUTE} read requests per minute per client IP).`,
        {
          status,
          retryAfter,
          hint: `Wait${retryAfter ? ` ${retryAfter}s` : " a minute"} and try again. Avoid polling in a tight loop.`,
        },
      );
    }
    default:
      if (status >= 500) {
        return new ApiError("server", `Percy / BrowserStack server error (${status}).`, {
          status,
          hint: "This is a problem on the BrowserStack side. Try again in a few moments.",
        });
      }
      return new ApiError("unexpected", `Unexpected response from Percy (HTTP ${status}).`, { status });
  }
}
