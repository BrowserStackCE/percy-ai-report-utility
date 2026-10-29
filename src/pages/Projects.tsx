import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { isRetryable } from "../api/errors";
import { useProjects } from "../api/projects/useProjects";
import { useSelectedProject } from "../api/projects/SelectedProjectProvider";
import { projectsForProduct, useProduct } from "../api/projects/ProductProvider";
import type { Project } from "../api/projects/types";
import { useDateFormat } from "../lib/dateFormat";
import {
  Button,
  Card,
  EmptyState,
  Chip,
  LoadingOverlay,
  PageContainer,
  PageHeader,
  Pagination,
  Search,
  StatusPill,
  TableSkeleton,
  Truncate,
  buttonClass,
} from "../components/ui";

/** Projects shown per page. Percy returns every project the credentials can see, so paging is done here. */
const PAGE_SIZE = 20;

/** Properly laid-out search box: icon and full-width input. */
function ProjectSearch({ query, onQuery }: { query: string; onQuery: (v: string) => void }) {
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
    </div>
  );
}

function ProjectRow({ project, selected, onOpen }: { project: Project; selected: boolean; onOpen: (p: Project) => void }) {
  const { formatDate } = useDateFormat();
  const ranBy = project.organization?.ownerName ?? null;
  const orgName = project.organization?.name ?? null;
  // The organization only earns a second line when it is not just the person's own name again.
  const orgLabel = orgName && orgName !== ranBy ? orgName : null;
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
          {/* Percy's URL id for the project. The account prefix of the full slug is the same on every row, so it is left out. */}
          <Truncate className="mt-0.5 font-mono text-xs text-ink-500">{project.slug}</Truncate>
        </button>
      </td>
      <td className="px-4 py-5">
        <div className="max-w-[12rem] min-w-0">
          {ranBy ? (
            <Truncate className="text-sm font-medium text-ink-900">{ranBy}</Truncate>
          ) : (
            <span className="text-sm italic text-ink-400" title="Percy did not return who owns this project">
              Not provided
            </span>
          )}
          {orgLabel && <Truncate className="mt-0.5 text-xs text-ink-500">{orgLabel}</Truncate>}
        </div>
      </td>
      <td className="whitespace-nowrap px-4 py-5 text-sm text-ink-500">{formatDate(project.createdAt)}</td>
      {/* Type and base branch share one cell so the table fits without a horizontal scroll. */}
      <td className="px-4 py-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip>{project.type}</Chip>
          {project.demo && <Chip>demo</Chip>}
          {project.defaultBaseBranch && (
            <Chip mono>
              <span className="max-w-[8rem] truncate" title={`Base branch: ${project.defaultBaseBranch}`}>
                {project.defaultBaseBranch}
              </span>
            </Chip>
          )}
        </div>
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
  const { status, projects, error, reload, scope } = useProjects();
  const { projectId, setProjectId } = useSelectedProject();
  const { product: chosen } = useProduct();
  const navigate = useNavigate();
  const { formatDate } = useDateFormat();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  // Follows the Web / App switch in the sidebar, the same list the project picker offers.
  const product = scope === "web" || scope === "app" ? scope : chosen;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projectsForProduct(projects, product).filter(
      (p) => q === "" || p.name.toLowerCase().includes(q) || p.fullSlug.toLowerCase().includes(q),
    );
  }, [projects, query, product]);

  // A new search or product always starts again from the first page.
  useEffect(() => setPage(1), [query, product]);

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
      <PageHeader
        title="Projects"
        description={
          scope === "both"
            ? `Showing ${product} projects. Switch between Web and App in the sidebar. Pick a project to see its recent builds.`
            : `Showing ${scope} projects, the only kind your Percy token can read. Pick one to see its recent builds.`
        }
      />

      {error && (
        <Card className="p-5">
          <p role="alert" className="text-sm font-medium text-danger-600">{error.message}</p>
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
          <ProjectSearch query={query} onQuery={setQuery} />

          {status === "loading" && projects.length === 0 ? (
            <LoadingOverlay label="Loading projects">
              <TableSkeleton rows={6} cols={7} />
            </LoadingOverlay>
          ) : (
            <>
            <div className="space-y-3 md:hidden">
              {visible.map((p) => (
                <Card key={p.id} className="p-4">
                  <button type="button" onClick={() => open(p)} className="w-full text-left">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink-900">{p.name}</p>
                        <Truncate className="mt-1 font-mono text-xs text-ink-500">{p.fullSlug}</Truncate>
                      </div>
                      <StatusPill tone={p.enabled ? "mint" : "warn"}>{p.enabled ? "Enabled" : "Archived"}</StatusPill>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
                      <span>{p.organization?.ownerName ?? "Owner not provided"}</span>
                      <span>Updated {formatDate(p.updatedAt)}</span>
                    </div>
                  </button>
                </Card>
              ))}
              {visible.length === 0 && <EmptyState title="No projects found" description={query ? "Try a different search." : `No ${product} projects are available.`} />}
            </div>
            <div className="hidden overflow-x-auto rounded-xl border border-line bg-card md:block">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line">
                    {["Project", "Ran by", "Created", "Type / base branch", "Screenshots", "Updated", "Status"].map((h, i) => (
                      <th
                        key={h}
                        scope="col"
                        className={`whitespace-nowrap px-4 py-4 text-[11px] font-semibold uppercase tracking-wider text-ink-500 first:pl-6 last:pr-6 ${i === 0 ? "w-[15rem]" : ""} ${i >= 4 ? "text-right" : ""}`}
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
                        {projects.length === 0
                          ? "No projects found for these credentials."
                          : query.trim() === ""
                            ? `No ${product} projects found.`
                            : "No projects match your search."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            </>
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
