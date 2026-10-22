import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useBuilds } from "../api/builds/useBuilds";
import type { Build, BuildState } from "../api/builds/types";
import { isRetryable } from "../api/errors";
import { useProjects } from "../api/projects/useProjects";
import { useSelectedProject } from "../api/projects/SelectedProjectProvider";
import {
  Button,
  Card,
  Chip,
  DataTable,
  PageContainer,
  PageHeader,
  Select,
  SearchInput,
  StatusPill,
  TextField,
  Truncate,
  buttonClass,
  type Column,
} from "../components/ui";

type StateFilter = "all" | BuildState;

const stateOptions = [
  { value: "all" as const, label: "All" },
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

function stateLabel(s: BuildState) {
  return s === "unknown" ? "Unknown" : s.charAt(0).toUpperCase() + s.slice(1);
}

const columns: Column<Build>[] = [
  {
    key: "build",
    header: "Build",
    render: (b) => (
      <div className="max-w-xl">
        <div className="flex items-center gap-3">
          <Link to={`/reports/${b.id}`} className="shrink-0 text-lg font-semibold text-ink-900 hover:text-brand-600">
            {b.buildNumber !== null ? `#${b.buildNumber}` : b.id}
          </Link>
          {b.branch && (
            <span className="min-w-0 max-w-56 shrink">
              <Chip>
                <Truncate>{b.branch}</Truncate>
              </Chip>
            </span>
          )}
          {b.createdAt && (
            <span className="shrink-0 whitespace-nowrap text-sm text-ink-500">{new Date(b.createdAt).toLocaleString()}</span>
          )}
        </div>
        <Truncate className="mt-1 text-sm text-ink-500">
          {b.isPullRequest && b.pullRequestTitle ? `PR #${b.pullRequestNumber ?? ""} ${b.pullRequestTitle}` : `Build ID ${b.id}`}
        </Truncate>
      </div>
    ),
  },
  {
    key: "snapshots",
    header: "Snapshots",
    align: "right",
    render: (b) => (
      <span className="text-sm tabular-nums text-ink-700">
        {b.totalSnapshots ?? "—"}
        {b.snapshotsWithDiffs ? ` · ${b.snapshotsWithDiffs} with diffs` : ""}
      </span>
    ),
  },
  {
    key: "state",
    header: "Build",
    align: "right",
    render: (b) => (
      <div className="flex flex-col items-end gap-1">
        <StatusPill tone={stateTone[b.state]}>{stateLabel(b.state)}</StatusPill>
        {b.state === "failed" && b.failureReason && <span className="text-xs text-ink-500">{b.failureReason.replace(/_/g, " ")}</span>}
      </div>
    ),
  },
];

export default function Home() {
  const { projectId } = useSelectedProject();
  const { projects } = useProjects();
  const { status, builds, error, hasMore, loadingMore, loadMore, reload } = useBuilds(projectId);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<StateFilter>("all");
  const [buildId, setBuildId] = useState("");
  const navigate = useNavigate();

  const project = projects.find((p) => p.id === projectId);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return builds.filter(
      (b) =>
        (state === "all" || b.state === state) &&
        (q === "" ||
          b.id.includes(q) ||
          String(b.buildNumber ?? "").includes(q) ||
          (b.branch ?? "").toLowerCase().includes(q)),
    );
  }, [builds, query, state]);

  function open() {
    const id = buildId.trim();
    if (id) navigate(`/reports/${encodeURIComponent(id)}`);
  }

  return (
    <PageContainer>
      <PageHeader
        title="Reports"
        description="Open the AI review report for a completed Percy build. Reports package the existing Percy AI Review Agent analysis; screenshots are not re-analyzed."
      />

      <Card className="p-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            open();
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <TextField
            label="Percy build ID"
            value={buildId}
            onChange={setBuildId}
            placeholder="For example, 48213907"
            className="min-w-64 flex-1"
          />
          <Button type="submit" variant="primary" className="h-10" disabled={!buildId.trim()}>
            Open report
          </Button>
        </form>
      </Card>

      {!projectId ? (
        <Card className="p-5">
          <p className="text-sm text-ink-700">Select a project in the sidebar to see its recent builds (last 30 days).</p>
        </Card>
      ) : error ? (
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
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder={`Search ${project?.name ?? "project"} builds by build number or branch`}
            aria-label="Search builds"
            trailing={
              <div className="h-full w-36">
                <Select value={state} options={stateOptions} onChange={setState} ariaLabel="Build state" variant="compact" />
              </div>
            }
          />

          {status === "loading" ? (
            <p role="status" className="text-sm text-ink-500">Loading recent builds…</p>
          ) : (
            <>
              <DataTable
                columns={columns}
                rows={rows}
                rowKey={(b) => b.id}
                empty={builds.length === 0 ? "No builds in the last 30 days for this project." : "No builds match your search."}
              />
              {hasMore && (
                <div className="flex justify-center">
                  <Button onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? "Loading…" : "Load older builds"}
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </PageContainer>
  );
}
