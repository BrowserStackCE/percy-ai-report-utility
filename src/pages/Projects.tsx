import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { isRetryable } from "../api/errors";
import { useProjects } from "../api/projects/useProjects";
import { useSelectedProject } from "../api/projects/SelectedProjectProvider";
import type { Project } from "../api/projects/types";
import { useDateFormat } from "../lib/dateFormat";
import {
  Button,
  Card,
  Chip,
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
} from "../components/ui";

type KindFilter = "all" | "web" | "app";

const kindOptions = [
  { value: "all" as const, label: "All types" },
  { value: "web" as const, label: "Web" },
  { value: "app" as const, label: "App" },
];

/** Projects shown per page. Percy returns every project the credentials can see, so paging is done here. */
const PAGE_SIZE = 20;

/** Properly laid-out search box: icon, full-width input, and the type filter as a separate control. */
function ProjectSearch({
  query,
  onQuery,
  kind,
  onKind,
}: {
  query: string;
  onQuery: (v: string) => void;
  kind: KindFilter;
  onKind: (v: KindFilter) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="relative min-w-64 flex-1">
        <span className="sr-only">Search projects</span>
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-500">
          <Search size={18} />
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search projects by name or slug"
          className="h-11 w-full rounded-lg border border-line-strong bg-card pl-10 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
      </label>
      <div className="w-44">
        <Select value={kind} options={kindOptions} onChange={onKind} ariaLabel="Project type" />
      </div>
    </div>
  );
}

function ProjectRow({ project, selected, onOpen }: { project: Project; selected: boolean; onOpen: (p: Project) => void }) {
  const { formatDate } = useDateFormat();
  return (
    <tr
      className="cursor-pointer align-top transition-colors hover:bg-page/60 focus-within:bg-page/60"
      onClick={() => onOpen(project)}
      aria-selected={selected}
    >
      <td className="px-4 py-5 first:pl-6">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(project);
          }}
          className="block w-full max-w-[15rem] text-left"
        >
          <span className="text-base font-semibold text-ink-900 hover:text-brand-600">{project.name}</span>
          <Truncate className="mt-0.5 text-sm text-ink-500">{project.fullSlug}</Truncate>
        </button>
      </td>
      <td className="hidden px-4 py-5 text-sm text-ink-700 2xl:table-cell">{project.organization?.name ?? "—"}</td>
      <td className="px-4 py-5">
        <div className="flex items-center gap-2">
          <Chip>{project.type}</Chip>
          {project.demo && <Chip>demo</Chip>}
        </div>
      </td>
      <td className="px-4 py-5">
        {project.defaultBaseBranch ? <Chip mono>{project.defaultBaseBranch}</Chip> : <span className="text-ink-400">—</span>}
      </td>
      <td className="px-4 py-5 text-right text-sm tabular-nums text-ink-700">
        {project.usage ?? "—"}
        {project.screenshotLimit ? ` / ${project.screenshotLimit}` : ""}
      </td>
      <td className="whitespace-nowrap px-4 py-5 text-right text-sm text-ink-500">{formatDate(project.updatedAt)}</td>
      <td className="px-4 py-5 text-right last:pr-6">
        <StatusPill tone={project.enabled ? "mint" : "warn"}>{project.enabled ? "Enabled" : "Archived"}</StatusPill>
      </td>
    </tr>
  );
}

export default function Projects() {
  const { status, projects, error, reload } = useProjects();
  const { projectId, setProjectId } = useSelectedProject();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter(
      (p) =>
        (kind === "all" || p.kind === kind) &&
        (q === "" || p.name.toLowerCase().includes(q) || p.fullSlug.toLowerCase().includes(q)),
    );
  }, [projects, query, kind]);

  // A new search or filter always starts again from the first page.
  useEffect(() => setPage(1), [query, kind]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * PAGE_SIZE;
  const visible = rows.slice(start, start + PAGE_SIZE);

  /** Picking a project selects it and shows its builds; it no longer leaves for percy.io. */
  function open(project: Project) {
    setProjectId(project.id);
    navigate("/");
  }

  return (
    <PageContainer>
      <PageHeader title="Projects" description="Pick a project to see its recent builds." />

      {error && (
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
      )}

      {!error && (
        <>
          <ProjectSearch query={query} onQuery={setQuery} kind={kind} onKind={setKind} />

          {status === "loading" && projects.length === 0 ? (
            <LoadingOverlay label="Loading projects">
              <TableSkeleton rows={6} cols={6} />
            </LoadingOverlay>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-line bg-card">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line">
                    {["Project", "Organization", "Type", "Base branch", "Screenshots", "Updated", "Status"].map((h, i) => (
                      <th
                        key={h}
                        scope="col"
                        className={`whitespace-nowrap px-4 py-4 text-[11px] font-semibold uppercase tracking-wider text-ink-500 first:pl-6 last:pr-6 ${i === 0 ? "w-[15rem]" : ""} ${i === 1 ? "hidden 2xl:table-cell" : ""} ${i >= 4 ? "text-right" : ""}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {visible.map((p) => (
                    <ProjectRow key={p.id} project={p} selected={p.id === projectId} onOpen={open} />
                  ))}
                  {visible.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-sm text-ink-400">
                        {projects.length === 0 ? "No projects found for these credentials." : "No projects match your search."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {rows.length > PAGE_SIZE && (
            <Pagination
              page={current}
              hasPrev={current > 1}
              hasNext={current < pageCount}
              onPrev={() => setPage(current - 1)}
              onNext={() => setPage(current + 1)}
              summary={`${start + 1}–${Math.min(start + PAGE_SIZE, rows.length)} of ${rows.length} projects`}
            />
          )}
        </>
      )}
    </PageContainer>
  );
}
