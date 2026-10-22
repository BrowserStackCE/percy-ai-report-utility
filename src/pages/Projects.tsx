import { useMemo, useState } from "react";
import { Link } from "react-router";
import { isRetryable } from "../api/errors";
import { useProjects } from "../api/projects/useProjects";
import type { Project } from "../api/projects/types";
import {
  Button,
  Card,
  Chip,
  DataTable,
  PageContainer,
  PageHeader,
  SearchInput,
  Select,
  StatusPill,
  Truncate,
  buttonClass,
  type Column,
} from "../components/ui";

type KindFilter = "all" | "web" | "app";

const kindOptions = [
  { value: "all" as const, label: "All" },
  { value: "web" as const, label: "Web" },
  { value: "app" as const, label: "App" },
];

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString() : "—";
}

const columns: Column<Project>[] = [
  {
    key: "project",
    header: "Project",
    render: (p) => (
      <div className="max-w-xl">
        <a
          href={p.percyUrl ?? undefined}
          target="_blank"
          rel="noreferrer"
          className="text-base font-semibold text-ink-900 hover:text-brand-600"
        >
          {p.name}
        </a>
        <Truncate className="mt-0.5 text-sm text-ink-500">{p.fullSlug}</Truncate>
      </div>
    ),
  },
  {
    key: "organization",
    header: "Organization",
    render: (p) => <span className="text-sm text-ink-700">{p.organization?.name ?? "—"}</span>,
  },
  {
    key: "type",
    header: "Type",
    render: (p) => (
      <div className="flex items-center gap-2">
        <Chip>{p.type}</Chip>
        {p.demo && <Chip>demo</Chip>}
      </div>
    ),
  },
  {
    key: "branch",
    header: "Base branch",
    render: (p) => (p.defaultBaseBranch ? <Chip mono>{p.defaultBaseBranch}</Chip> : <span className="text-ink-400">—</span>),
  },
  {
    key: "usage",
    header: "Screenshots",
    align: "right",
    render: (p) => (
      <span className="text-sm tabular-nums text-ink-700">
        {p.usage ?? "—"}
        {p.screenshotLimit ? ` / ${p.screenshotLimit}` : ""}
      </span>
    ),
  },
  {
    key: "updated",
    header: "Updated",
    align: "right",
    render: (p) => <span className="whitespace-nowrap text-sm text-ink-500">{formatDate(p.updatedAt)}</span>,
  },
  {
    key: "status",
    header: "Status",
    align: "right",
    render: (p) => <StatusPill tone={p.enabled ? "mint" : "warn"}>{p.enabled ? "Enabled" : "Archived"}</StatusPill>,
  },
];

export default function Projects() {
  const { status, projects, error, reload } = useProjects();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter(
      (p) =>
        (kind === "all" || p.kind === kind) &&
        (q === "" || p.name.toLowerCase().includes(q) || p.fullSlug.toLowerCase().includes(q)),
    );
  }, [projects, query, kind]);

  return (
    <PageContainer>
      <PageHeader title="Projects" description="Every Percy project your credentials can access." />

      {error && (
        <Card className="p-5" >
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
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search projects by name or slug"
            aria-label="Search projects"
            trailing={
              <div className="h-full w-32">
                <Select value={kind} options={kindOptions} onChange={setKind} ariaLabel="Project type" variant="compact" />
              </div>
            }
          />

          {status === "loading" && projects.length === 0 ? (
            <p role="status" className="text-sm text-ink-500">Loading projects…</p>
          ) : (
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(p) => p.id}
              empty={projects.length === 0 ? "No projects found for these credentials." : "No projects match your search."}
            />
          )}
        </>
      )}
    </PageContainer>
  );
}
