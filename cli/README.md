# percy-report CLI

Terminal authentication for the Percy AI Report utility. Zero dependencies, Node 18+.

```bash
cd cli
node bin/percy-report.js login                       # interactive prompts (input hidden)
node bin/percy-report.js login --token <percy token>
node bin/percy-report.js login --username <u> --access-key <k>
node bin/percy-report.js status                      # re-validates stored credentials
node bin/percy-report.js logout
npm test
```

Env fallbacks: `PERCY_TOKEN`, `BROWSERSTACK_USERNAME`, `BROWSERSTACK_ACCESS_KEY`.
Report site defaults to `http://localhost:5173` (override with `PERCY_REPORT_URL`).

## How it works
- Credentials are validated against the Percy API (`Token` header for project tokens, HTTP Basic for BrowserStack).
- Valid credentials are saved to `~/.percy-report/credentials.json` (mode 0600).
- The CLI prints/opens `/auth/callback#d=...`. The credentials travel in the URL **fragment** (never sent to a server); the site stores them in a cookie, clears the URL and shows "Authenticated". No backend involved.

## Errors
| Code | Message |
| --- | --- |
| 401 | Credentials invalid |
| 403 | Valid but not permitted (e.g. write-only token cannot read builds) |
| 404 / 422 | Not found / unprocessable |
| 429 | Rate limited, about 400 read requests per minute per client IP; retry with exponential backoff |
| 5xx | Percy / BrowserStack server error |
| network | Unreachable / timeout |
