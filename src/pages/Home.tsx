import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router";
import { useBuilds } from "../api/builds/useBuilds";
import type { Build, BuildState } from "../api/builds/types";
import { isRetryable } from "../api/errors";
import { useProjects } from "../api/projects/useProjects";
import { useSelectedProject } from "../api/projects/SelectedProjectProvider";
import { count, formatDuration, humanize, shortSha } from "../lib/format";
import { useDateFormat } from "../lib/dateFormat";
import {
  Button,
  Card,
  Chip,
  DataTable,
  LoadingOverlay,
  PageContainer,
  PageHeader,
  Pagination,
  Search,
  Select,
  StatusPill,
  TableSkeleton,
  Truncate,
  buttonClass,
  type Column,
} from "../components/ui";

type StateFilter = "all" | Exclude<BuildState, "unknown">;

const stateOptions = [
  { value: "all" as const, label: "All states" },
  { value: "finished" as const, label: "Finished" },
  { value: "processing" as const, label: "Processing" },
  { value: "waiting" as const, label: "Waiting" },
  { value: "failed" as const, label: "Failed" },
];

const stateTone: Record<BuildState, "mint" | "warn" | "danger" | "neutral"> = {
  finished: "mint",
  processing: "warn",
  waiting: "warn",
  failed: "danger",
  unknown: "neutral",
};

const reviewTone: Record<string, "mint" | "warn" | "danger" | "neutral"> = {
  approved: "mint",
  unreviewed: "warn",
  changes_requested: "danger",
  rejected: "danger",
};

/** Table columns. The date formatter is passed in so times follow the user's chosen time zone. */
const buildColumns = (formatDateTime: (iso: string | null) => string): Column<Build>[] => [
  {
    key: "build",
    header: "Build",
    info: "The Percy build number within this project, with its unique build ID underneath. Click the number to open the full build details.",
    render: (b) => (
      <div className="min-w-0">
        <Link to={`/reports/${b.id}`} className="text-base font-semibold text-ink-900 hover:text-brand-600">
          {b.buildNumber !== null ? `#${b.buildNumber}` : b.id}
        </Link>
        <p className="mt-0.5 text-xs text-ink-400">ID {b.id}</p>
      </div>
    ),
  },
  {
    key: "branch",
    header: "Branch / commit",
    info: "The git branch the build ran on, plus the commit hash and message when Percy has them. Pull-request builds also show the PR number and title.",
    className: "w-[16rem] max-w-[16rem]",
    render: (b) => {
      // Long commit messages and PR titles stay on one line with an ellipsis; the full text is the tooltip.
      const subject = b.commit?.message?.split("\n")[0] ?? "";
      const pr = b.isPullRequest ? `PR #${b.pullRequestNumber ?? "?"} ${b.pullRequestTitle ?? ""}`.trim() : "";
      return (
        <div className="min-w-0">
          {b.branch ? (
            <span className="flex min-w-0">
              <Chip>
                <span className="max-w-[13rem] truncate" title={b.branch}>
                  {b.branch}
                </span>
              </Chip>
            </span>
          ) : (
            <span className="text-ink-400">—</span>
          )}
          {b.commit?.sha && (
            <p
              className="mt-1.5 flex min-w-0 items-baseline gap-1.5 text-xs text-ink-500"
              title={subject ? `${b.commit.sha}\n${b.commit.message ?? ""}` : b.commit.sha}
            >
              <span className="shrink-0 font-mono text-ink-700">{shortSha(b.commit.sha)}</span>
              {subject && <span className="min-w-0 truncate">{subject}</span>}
            </p>
          )}
          {pr && <Truncate className="mt-1 text-xs text-ink-500">{pr}</Truncate>}
        </div>
      );
    },
  },
  {
    key: "snapshots",
    header: "Snapshots",
    info: "Total snapshots in the build. Underneath: how many comparisons showed a visual difference from the base build, and how many snapshots are still unreviewed.",
    align: "center",
    render: (b) => {
      const diffs = b.comparisonsWithDiffs ?? 0;
      const unreviewed = b.unreviewedSnapshots ?? 0;
      return (
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-sm">
            <span className="text-base font-semibold tabular-nums text-ink-900">{count(b.totalSnapshots)}</span>{" "}
            <span className="text-ink-500">{b.totalSnapshots === 1 ? "snapshot" : "snapshots"}</span>
          </span>
          {/* Small, quiet counts under the total: a figure plus a muted label, red only when something needs attention. */}
          {(diffs > 0 || unreviewed > 0) && (
            <div className="flex flex-col items-center gap-0.5 text-xs leading-5">
              {diffs > 0 && (
                <span>
                  <span className="font-semibold tabular-nums text-ink-900">{count(diffs)}</span>{" "}
                  <span className="text-ink-500">{diffs === 1 ? "diff" : "diffs"}</span>
                </span>
              )}
              {unreviewed > 0 && (
                <span>
                  <span className="font-semibold tabular-nums text-danger-600">{count(unreviewed)}</span>{" "}
                  <span className="text-danger-600">unreviewed</span>
                </span>
              )}
            </div>
          )}
        </div>
      );
    },
  },
  {
    key: "review",
    header: "Review",
    info: "The review decision for the build: unreviewed, approved, changes requested or rejected. Empty while the build is still processing or failed before review.",
    render: (b) =>
      b.reviewState ? (
        <StatusPill tone={reviewTone[b.reviewState] ?? "neutral"}>{humanize(b.reviewState)}</StatusPill>
      ) : (
        <span className="text-ink-400">—</span>
      ),
  },
  {
    key: "state",
    header: "State",
    info: "Where the build is in Percy's pipeline: waiting, processing, finished or failed. Failed builds also show the reason.",
    render: (b) => (
      <div className="flex flex-col items-start gap-1">
        <StatusPill tone={stateTone[b.state]}>{humanize(b.state)}</StatusPill>
        {b.state === "failed" && b.failureReason && <span className="text-xs text-ink-500">{humanize(b.failureReason)}</span>}
      </div>
    ),
  },
  {
    key: "when",
    header: "Started",
    info: "When the build began, in the time zone chosen in the picker at the top of the page, and how long Percy took to process it.",
    align: "right",
    render: (b) => (
      <div className="text-sm text-ink-700">
        {formatDateTime(b.createdAt)}
        <p className="mt-0.5 text-xs text-ink-500">Took {formatDuration(b.processingSeconds)}</p>
      </div>
    ),
  },
];

/** Reports: the recent builds of the project chosen in the sidebar. */
export default function Home() {
  const { projectId } = useSelectedProject();
  const { projects } = useProjects();
  const { formatDateTime, zone } = useDateFormat();
  const columns = useMemo(() => buildColumns(formatDateTime), [formatDateTime, zone]);
  const [branch, setBranch] = useState("");
  const [appliedBranch, setAppliedBranch] = useState("");
  const [state, setState] = useState<StateFilter>("all");

  const filters = useMemo(
    () => ({ branch: appliedBranch || undefined, state: state === "all" ? undefined : state }),
    [appliedBranch, state],
  );
  const { status, builds, error, page, hasNext, hasPrev, loadingPage, next, prev, reload } = useBuilds(projectId, filters);

  const project = projects.find((p) => p.id === projectId);
  const filtered = appliedBranch !== "" || state !== "all";

  // Without a project there is nothing to list: send people to pick one.
  if (!projectId) return <Navigate to="/projects" replace />;

  return (
    <PageContainer>
      <PageHeader
        title="Reports"
        description={`Builds from the last 30 days${project ? ` in ${project.name}` : ""}. Open a build to see its details.`}
        actions={
          <Link to="/projects" className={buttonClass("secondary")}>
            Change project
          </Link>
        }
      />

      {error ? (
        <Card className="p-5">
          <p role="alert" className="text-sm font-medium text-red-600">{error.message}</p>
          {error.hint && <p className="mt-1 text-sm text-ink-500">{error.hint}</p>}
          <div className="mt-3 flex gap-2">
            {error.kind === "not_authenticated" || error.kind === "unauthorized" ? (
              <Link to="/login" className={buttonClass("primary")}>Sign in</Link>
            ) : (
              isRetryable(error) && <Button onClick={reload}>Try again</Button>
            )}
          </div>
        </Card>
      ) : (
        <>
          <form
            role="search"
            aria-label="Filter builds"
            onSubmit={(e) => {
              e.preventDefault();
              setAppliedBranch(branch.trim());
            }}
            className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-card p-4"
          >
            <label className="relative min-w-64 flex-1">
              <span className="mb-1.5 block text-sm font-medium text-ink-700">Branch</span>
              <span className="pointer-events-none absolute bottom-0 left-3 flex h-10 items-center text-ink-500">
                <Search size={16} />
              </span>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="Exact branch name, for example main"
                className="h-10 w-full rounded-lg border border-line-strong bg-card pl-9 pr-9 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
              {branch && (
                <button
                  type="button"
                  aria-label="Clear branch"
                  onClick={() => {
                    setBranch("");
                    setAppliedBranch("");
                  }}
                  className="absolute bottom-0 right-1.5 flex h-10 w-7 items-center justify-center text-lg text-ink-400 hover:text-ink-900"
                >
                  ×
                </button>
              )}
            </label>
            <div className="w-44">
              <span className="mb-1.5 block text-sm font-medium text-ink-700">State</span>
              <Select value={state} options={stateOptions} onChange={setState} ariaLabel="Build state" />
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="primary" className="h-10">
                Apply
              </Button>
              {filtered && (
                <Button
                  className="h-10"
                  onClick={() => {
                    setBranch("");
                    setAppliedBranch("");
                    setState("all");
                  }}
                >
                  Reset
                </Button>
              )}
            </div>
          </form>

          {status === "loading" && builds.length === 0 ? (
            <LoadingOverlay label="Loading recent builds">
              <TableSkeleton rows={6} cols={6} />
            </LoadingOverlay>
          ) : (
            <>
              <DataTable
                columns={columns}
                rows={builds}
                rowKey={(b) => b.id}
                empty={filtered ? "No builds match these filters." : "No builds in the last 30 days for this project."}
              />
              <Pagination
                page={page}
                hasPrev={hasPrev}
                hasNext={hasNext}
                onPrev={prev}
                onNext={next}
                busy={loadingPage}
                summary={`${builds.length} build${builds.length === 1 ? "" : "s"} on this page`}
              />
            </>
          )}
        </>
      )}
    </PageContainer>
  );
}