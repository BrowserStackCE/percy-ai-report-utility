# percy-report-utility

Authenticate with Percy and/or BrowserStack from the terminal, then open the Percy AI Report site already signed in.

## Usage

No install needed:

```sh
npx percy-report-utility login
```

or install it:

```sh
npm install -g percy-report-utility
percy-report-utility login      # `percy-report` also works
```

Requires Node 18+.

## Commands

```sh
percy-report-utility login [options]   # validate, store, and open the report site
percy-report-utility status            # re-validate the stored credentials
percy-report-utility logout [options]  # remove stored credentials and sign out of the website
percy-report-utility --help
```

### Options for `login`

```
--percy-token <percyToken>   Percy read-only or full-access project token (default: PERCY_TOKEN)
--username <username>        BrowserStack username (default: BROWSERSTACK_USERNAME)
--access-key <accessKey>     BrowserStack access key (default: BROWSERSTACK_ACCESS_KEY)
--no-open                    Print the link without opening the browser
```

`logout` also accepts `--no-open` (remove local credentials and print the website sign-out link instead of opening it).

### CI/CD and headless use

The browser is opened only on an interactive terminal. When `CI` is set, there is no TTY, or `--no-open` is passed, `login` only validates and saves the credentials (use the `PERCY_TOKEN`, `BROWSERSTACK_USERNAME` and `BROWSERSTACK_ACCESS_KEY` env vars) and prints the link, and `logout` only removes the stored credentials and prints the sign-out link. Nothing ever blocks waiting for a browser or a prompt.

Run `login` with no options for hidden interactive prompts. Leave a section blank to skip it.

Example with environment variables:

```sh
export PERCY_TOKEN=<read-only | full-access token>
export BROWSERSTACK_USERNAME=<username>
export BROWSERSTACK_ACCESS_KEY=<access key>
npx percy-report-utility login
```

Find a project token in your Percy project settings, and your username and access key on your BrowserStack profile page.

## How it works

- Credentials are validated against the Percy API (`Token` header for project tokens, HTTP Basic for BrowserStack credentials).
- Valid credentials are saved to `~/.percy-report/credentials.json` (owner-only permissions).
- The CLI prints and opens `<site>/auth/callback#d=...`. The credentials travel in the URL **fragment**, which browsers never send to a server. The site stores them in a cookie, clears the URL and shows you as authenticated. No backend is involved.
- The site URL comes from `lib/config.js` (the deployed site by default, with a commented-out `http://localhost:5173` line for local development). Set `PERCY_REPORT_URL` to override it for a single run.

## Errors

| Code | Meaning |
| --- | --- |
| 401 | Credentials are invalid |
| 403 | Credentials are valid but not allowed (for example a write-only token cannot read builds) |
| 404 / 422 | Not found / unprocessable request |
| 429 | Rate limited: Percy allows about 400 read requests per minute per client IP. Wait and retry with exponential backoff |
| 5xx | Percy / BrowserStack server error |
| network | Percy unreachable or timed out |

Exit codes: `0` success, `1` authentication failed or nothing to authenticate, `2` some credentials were rejected while others were saved.

## Security

The access key and tokens are stored in plain text in your home directory (mode 0600) and in a browser cookie. Run `logout` on shared machines, and rotate any credential you may have exposed.

## License

Apache-2.0
