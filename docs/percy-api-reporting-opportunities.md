# Percy API → Reporting Opportunities

Source: https://www.browserstack.com/docs/percy/api-reference/percy-apis (and its sub-pages: Authentication, Status code, Projects, Builds, Snapshots, Network logs, Visual Git).
Purpose: given the **GET** APIs we already consume (projects, builds, snapshots), list what reports/features we can build beyond "just showing data", with concrete use cases and implementation notes.

---

## 1. API surface (what exists)

Base URL: `https://percy.io/api/v1` · Format: JSON:API (except `network-logs`, which is plain JSON).

| Area | Method + Endpoint | Purpose | Notes |
|---|---|---|---|
| Projects | `GET /projects` | Details of project(s) for token (all public projects if no token) | No params |
| Projects | `POST /projects` | Create project | Not reporting |
| Projects | `PATCH /projects/{id}` | Update settings (`default-base-branch`, `auto-approve-branch-filter`, `intelli-ignore-*`, `autofinalize`, ...) | Write; could power "recommend settings" |
| Builds | `GET /builds` | Recent builds (**last 30 days**) | `filter[sha]`, `filter[shas][]`, `filter[branch]`, `filter[state]`, `page[limit]` (max 30), `page[cursor]` (build-id < cursor) |
| Builds | `GET /builds/{build_id}` | Build details | Same attributes as list |
| Builds | `POST /reviews` | Approve / unapprove / reject | Approve needs BrowserStack credentials, not a project token |
| Builds | `POST /builds/{id}/fail`, `POST /builds/{id}/delete` | Fail / delete | Write |
| Snapshots | `GET /snapshots?build_id=` | Snapshots of a build | `filter[review-state-reason][]`, `filter[snapshot-ids][]`, `filter[search]`, `page[limit]` (max 30), `page[cursor]` (last snapshot id) |
| Snapshots | `GET /snapshots/{snapshot_id}` | Snapshot + `included` comparisons | |
| Network logs | `GET /network-logs?comparison_id=` | Per-comparison asset requests (head vs base) | **Basic auth only** (BrowserStack username:accesskey); comparison must be finished (else 403); check `meta` for expiry |
| Visual Git | `POST /branchline/sync`, `GET /branchline/sync/{id}`, `POST /branchline/merge` | Branchline sync/merge | Write |

Auth: project token `Authorization: Token token=<TOKEN>` (write-only / read-only / full-access; a token only sees its own project) or BrowserStack Basic auth. Errors: 401, 403, 404, 422, 429. **Rate limit ≈ 400 read req/min per IP** → retry with exponential backoff, don't tight-poll.

---

## 2. Data we can mine (fields that matter for reporting)

### Project (`/projects`)
`name, slug, full-slug, type (web/app/automate), is-enabled, default-base-branch, auto-approve-branch-filter, approval-required-branch-fitler (sic), wait-for-base-build, diff-sensitivity-levels, current-period-usage, screenshot-limit, workflow, latest-build-stat, visual-monitoring-urls, vm-last-build-baseline, publicly-readable, is-demo, is-auto-browser-upgrade, created-at, updated-at`; relationships: organization, repo (+ `included` repo: GitHub slug/url), builds, tokens, browser-targets (+ browser family/version, deprecation dates), webhook-configs.

### Build (`/builds`, `/builds/{id}`)
- Identity: `build-number, branch, type, partial, pull-request-number/title/html-url, is-pull-request, commit-html-url, user-agent, parallel-nonce, parallel-total-shards`
- State: `state, review-state, review-state-reason, approved-at` (+ `approved-by`)
- Volume/quality: `total-snapshots, total-snapshosts-requesting-changes (sic), total-snapshots-unreviewed, total-comparisons, total-comparisons-finished, total-comparisons-diff, total-open-commits, failed-snapshots-count, failed-reason, failure-details`
- **Timing**: `created-at, finalized-at, finished-at, percy-processing-duration, median-processing-duration, average-duration`
- Relations: `base-build, base-build-strategy, commit, repo, browsers, removed-snapshots, failed-snapshots, missing-resources`

### Snapshot (`/snapshots`) + included comparisons
- Snapshot: `name, display-name, review-state, review-state-reason, total-open-commits (open comments), is-reintroduced, enable-javascript, enable-layout, layout-warning, renderer-layout-warning-text, scope-selector, test-case-id, test-case-name, fingerprint`
- Comparison: `state, width, diff-ratio, ai-diff-ratio, ai-failure-reason, ai-processing-state, recurring-diff-detection-status, ignored-top/bottom, external-debug-url, new-and-unchanged-with-reviewed-baseline`
- AI details: `ai-enabled, ai-visual-diffs, ai-processing-status, ai-summary`
- Relations: head/base screenshot, diff-image, context-diff-image, browser (+ OS/device), ignore-regions, missing-resources.

---

## 3. What we can build (use cases)

Each item lists **Goal → Data → Computation → Visual → Notes**. Priority: **P1** quick win from data already fetched, **P2** needs aggregation/extra calls, **P3** advanced.

### A. Project-level reports

**A1. Project health scorecard (P1)**
- Goal: one row per project showing "is visual testing healthy here?"
- Data: `GET /projects` + last N builds per project (`/builds` with `relationships.project`/token scope).
- Compute: approval rate, % builds with diffs, avg unreviewed backlog, last-build age, `latest-build-stat`.
- Visual: sortable table with red/amber/green chips; sparkline of last 30 builds.

**A2. Configuration audit / hygiene (P1)**
- Goal: flag risky project settings across the org.
- Data: project attrs (`auto-approve-branch-filter`, `default-base-branch`, `wait-for-base-build`, `diff-sensitivity-levels`, `is-auto-browser-upgrade`, `publicly-readable`, `is-enabled`).
- Rules: auto-approve on `*` or main; public project; no default base branch; stale (no build in 30 d); archived but still has tokens.
- Visual: checklist with severity; export as CSV.

**A3. Usage and quota tracking (P2)**
- Data: `current-period-usage`, `screenshot-limit` (documented with loose types – validate in real responses), build `total-comparisons`.
- Compute: usage % of limit, projected exhaustion date from build-rate trend, top consumers by project/branch/PR.
- Visual: gauge + burn-down line; alert threshold at 80%.

**A4. Browser/device coverage & deprecation (P2)**
- Data: project `browser-targets` (+ `deprecation-period-start/end`), build `browsers`, comparison `width` and `browser`.
- Compute: browsers/widths covered per project; upcoming deprecations; widths with highest diff rate.
- Visual: coverage matrix (project × browser), deprecation timeline.

**A5. Repo/CI mapping (P1)**
- Data: project `repo` (included), build `branch`, `pull-request-*`, `user-agent`, `parallel-total-shards`.
- Use: group by repo, by SDK/CLI version (`user-agent`) to find outdated Percy CLIs.

### B. Build-level reports

**B1. Build trend dashboard (P1)**
- Data: `/builds` (30-day window, paginate with `page[cursor]`).
- Compute per day/week: build count, % with `total-comparisons-diff > 0`, approved/rejected/changes_requested/unreviewed mix, failed builds.
- Visual: stacked bars + trend lines; filter by branch/state (use `filter[branch]`, `filter[state]`).

**B2. Review SLA / time-to-approve (P1)**
- Data: `finished-at`, `approved-at`, `review-state`.
- Compute: `approved-at − finished-at` → median/p90 per project, per branch, per week; list builds waiting longest (`review-state=unreviewed` & `state=finished`).
- Use case: "Which builds are blocking PRs right now?" → aging queue with PR links (`pull-request-html-url`).

**B3. Pipeline performance (P1)**
- Data: `percy-processing-duration`, `median-processing-duration`, `average-duration` (provided as 30-build baselines), `created-at`, `finalized-at`.
- Compute: processing duration vs median → flag slow builds (> 1.5× median); regression of processing time over weeks.
- Note: median/average are null until ≥10 prior finished builds.

**B4. Failure analysis (P1)**
- Data: `failed-snapshots-count, failed-reason, failure-details, state`, `failed-snapshots` relation, `removed-snapshots`.
- Compute: top failure reasons per project/week; flaky-failure rate; builds that never finalized (`finalized-at` null).
- Visual: Pareto chart of `failed-reason`; drill-down to failed snapshots.

**B5. PR/branch quality view (P1)**
- Data: `is-pull-request, pull-request-number/title, branch, commit`, diff counts.
- Compute: per PR – number of builds, diffs introduced, final review state, reviewer (`approved-by`).
- Use case: release/PR readiness report: "PR #123: 3 builds, 2 rejected, final approved by X at T".

**B6. Parallel / partial build integrity (P2)**
- Data: `partial, parallel-nonce, parallel-total-shards`.
- Use: detect partial builds being treated as baselines; group shards of the same nonce into one logical run.

**B7. Baseline lineage (P2)**
- Data: `base-build`, `base-build-strategy`, `wait-for-base-build`.
- Use: explain "why is this diff here?" – show which build/branch was the baseline; detect builds comparing against an unapproved or very old base.

**B8. Reviewer workload & ownership (P2)**
- Data: `approved-by` relationship (resolve user), `approved-at`.
- Compute: approvals per person/week, load balance, bus-factor on auto-approve branches.

### C. Snapshot / comparison-level reports

**C1. Noisiest snapshots (flaky visual tests) (P1→P2)**
- Data: snapshots across last N builds, keyed by `name` (+ `width` + browser).
- Compute: diff frequency (`diff-ratio > 0`), how often `is-reintroduced`, `recurring-diff-detection-status`.
- Visual: top-20 table "snapshot, % of builds with diff, avg diff-ratio, last seen"; recommend ignore regions / `enable-layout` / Intelli-Ignore.
- Cost: N builds x paginated snapshot calls (30/page) → cache aggressively.

**C2. Diff magnitude distribution (P1)**
- Data: `diff-ratio`, `ai-diff-ratio`.
- Visual: histogram; top diffs by ratio; compare raw vs AI-filtered ratio to show **noise removed by AI** (`1 - ai/raw`).

**C3. AI effectiveness report (P1) – fits this app's AI-report purpose**
- Data: `ai-details.ai-enabled, ai-visual-diffs, ai-summary, ai-processing-status`, `ai-failure-reason`, `ai-processing-state`.
- Compute: % comparisons with AI enabled/processed/failed, AI failure reasons, avg AI diffs per build, "AI cleared X of Y raw diffs".
- Visual: funnel (raw diffs → AI-flagged → reviewed → approved); AI failure breakdown.

**C4. Review-state breakdown with reasons (P1)**
- Data: snapshot `review-state` & `review-state-reason` (server filter `filter[review-state-reason][]` available).
- Compute: counts by reason (`unreviewed_snapshots`, `auto_approved_branch`, `no_diffs`, `changes_requested_snapshot`, ...).
- Use: "How many were auto-approved vs human-approved?" → governance report.

**C5. Review discussion hotspots (P1)**
- Data: snapshot `total-open-commits` (open comments).
- Use: snapshots with unresolved comments across builds; per-build "open comments" badge.

**C6. Rendering configuration risk (P1)**
- Data: `enable-javascript, enable-layout, layout-warning, renderer-layout-warning-text, scope-selector`.
- Use: list snapshots with layout warnings; share of snapshots with JS enabled; scope-selector adoption.

**C7. Test-to-snapshot traceability (P2)**
- Data: `test-case-id, test-case-name` (+ `external-debug-url` linking to Automate sessions).
- Use: group diffs by test case; deep-link to the BrowserStack session; "tests producing most diffs".

**C8. Responsive/width analysis (P2)**
- Data: comparison `width`, browser/device.
- Compute: diff rate per width/browser. Use: find the breakpoint or device causing most regressions.

**C9. Ignored-area usage (P2)**
- Data: `ignored-top/bottom`, `ignore-regions`.
- Use: audit over-use of ignore regions that could hide real regressions.

**C10. New vs changed vs removed (P2)**
- Data: `new-and-unchanged-with-reviewed-baseline`, `removed-snapshots`, `base-screenshot == null` (new), `diff-ratio`.
- Use: "change composition" – new / changed / removed / unchanged; spot suspicious mass removal (deleted test or crash).

### D. Network-log driven diagnostics (P2, needs Basic auth)

**D1. Asset failure report**
- Data: `GET /network-logs?comparison_id=` → entries with `status-error: true`, `head-status` vs `base-status`, `domain`, `mimetype`, `possible-fixes`.
- Compute: top failing domains/assets across comparisons in a build; head-only failures (regressions) vs both.
- Use case: explain *why* a diff appeared (missing CSS/font/image) → "likely infra, not product bug" tag complementing AI classification.
- Caveats: finished comparisons only (403 otherwise); check `meta.is-head-expired/is-base-expired` (API returns 200 even if logs expired); one call per comparison → only for diffed comparisons to respect the rate limit.

### E. Cross-cutting / executive views

**E1. Org-level executive summary (P2)** – roll up A1+B1+B2+C3: builds/week, % approved, median review time, AI noise reduction, top 5 risky projects. Export PDF/CSV.

**E2. Alerts & anomaly detection (P3)** – scheduled job vs trailing baseline: spike in `failed-snapshots-count`, drop in snapshot count between builds, processing duration > 2x median, build stuck unfinalized, unreviewed backlog > N.

**E3. Release readiness gate (P3)** – for a branch/PR/SHA (`filter[sha]`, `filter[shas][]`, `filter[branch]`): pass if build finished, no `changes_requested`, no unreviewed, no failed snapshots. Verdict usable in CI.

**E4. Write-back actions (optional, P3)** – `POST /reviews` (BrowserStack creds), `POST /builds/{id}/fail`, `PATCH /projects/{id}`: one-click approve from report, auto-fail overlong builds, apply recommended settings from A2. Keep behind explicit confirmation.

---

## 4. Suggested data model & fetching strategy

1. **Normalise** into `Project`, `Build(project_id, ...)`, `Snapshot(build_id, comparisons[])`. Use `snapshot.name + width + browser` as the stable cross-build key (C1, C8).
2. **Pagination**: builds `page[cursor]` = last build id; snapshots `page[cursor]` = last snapshot id; both capped at 30/page.
3. **History window**: builds endpoint only returns the **last 30 days** → persist daily aggregates if longer trends are needed.
4. **Caching**: cache finished builds permanently; only refetch `processing`/`unreviewed` builds. Respect ~400 req/min; bounded concurrency + exponential backoff on 429.
5. **Server-side filters first**: `filter[branch]`, `filter[state]`, `filter[sha]`, `filter[review-state-reason][]`, `filter[search]`.
6. **Auth**: project token for reads; Basic (username:accesskey) for network logs and approvals. A project token only sees its own project → multi-project reports need multiple tokens or org-level credentials.
7. **Defensive parsing**: docs contain typos/loose types (`total-snapshosts-requesting-changes`, `approval-required-branch-fitler`, `current-period-usage` typed Boolean, `pull-request-number` Integer vs String). Confirm against real payloads and map in `mapper.ts`.

---

## 5. Suggested implementation order

| Phase | Items | Why |
|---|---|---|
| 1 (data already fetched) | B1, B2, B3, B4, C2, C4, C5, C6, A2 | Pure aggregation of fields in current responses |
| 2 (aggregation across builds) | A1, A3, B5, C1, C3, C8, C10 | Multi-build fetch + caching |
| 3 (extra endpoints / auth) | D1, A4, B7, B8, C7 | Network logs (Basic auth), relationship lookups |
| 4 (automation) | E1, E2, E3, E4 | Scheduled jobs, CI gate, write actions |

## 6. Limits to keep in mind
- Builds list is capped to 30 days; no date-range or aggregate/stats endpoint → trends are client-computed.
- No documented endpoint for comments, reviewer activity or usage history; `total-open-commits` is only a count.
- Network logs expire; approvals cannot use project tokens.
- `median-processing-duration` / `average-duration` need >= 10 prior finished builds.
- Rate limit ~400 reads/min per IP.
