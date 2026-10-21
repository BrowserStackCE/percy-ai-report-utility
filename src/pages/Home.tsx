import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { reports } from "../data/mock";
import type { Report } from "../types";
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
  type Column,
} from "../components/ui";

type StatusFilter = "all" | "ready" | "processing";

const statusOptions = [
  { value: "all" as const, label: "All" },
  { value: "ready" as const, label: "Ready" },
  { value: "processing" as const, label: "Processing" },
];

const columns: Column<Report>[] = [
  {
    key: "build",
    header: "Build",
    render: (r) => (
      <div className="max-w-xl">
        <div className="flex items-center gap-3">
          <Link to={`/reports/${r.buildId}`} className="shrink-0 text-lg font-semibold text-ink-900 hover:text-brand-600">
            {r.buildId}
          </Link>
          <span className="min-w-0 max-w-56 shrink">
            <Chip>
              <Truncate>{r.branch}</Truncate>
            </Chip>
          </span>
          {r.commit && <Chip mono>{r.commit}</Chip>}
          <span className="shrink-0 whitespace-nowrap text-sm text-ink-500">
            {new Date(r.generatedAt).toLocaleString()}
          </span>
        </div>
        <Truncate className="mt-1 text-sm text-ink-500">{r.project}</Truncate>
      </div>
    ),
  },
  {
    key: "status",
    header: "Report",
    align: "right",
    render: (r) => (
      <StatusPill tone={r.status === "ready" ? "mint" : "warn"}>
        {r.status === "ready" ? "Ready" : "Processing"}
      </StatusPill>
    ),
  },
];

export default function Home() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [buildId, setBuildId] = useState("");
  const navigate = useNavigate();

  const rows = reports.filter(
    (r) =>
      (status === "all" || r.status === status) &&
      (r.buildId.includes(query.trim()) || r.branch.toLowerCase().includes(query.trim().toLowerCase())),
  );

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

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search builds by build number or branch"
        aria-label="Search builds"
        trailing={
          <div className="h-full w-32">
            <Select value={status} options={statusOptions} onChange={setStatus} ariaLabel="Report status" variant="compact" />
          </div>
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.buildId}
        empty="No builds match your search."
      />
    </PageContainer>
  );
}
