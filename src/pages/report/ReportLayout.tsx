import { Outlet, useParams } from "react-router";
import { getReport } from "../../data/mock";
import type { ReportContext } from "./useReport";
import {
  Button,
  Chip,
  Download,
  External,
  Layers,
  Pulse,
  StatusPill,
  Tabs,
  Truncate,
  buttonClass,
  type TabItem,
} from "../../components/ui";
import NotFound from "../NotFound";

function MetaItem({ children }: { children: React.ReactNode }) {
  return <span className="flex items-center gap-1.5 text-xs text-ink-700">{children}</span>;
}

/** Header, meta row and tabs shared by every report tab. Child routes render in the Outlet. */
export default function ReportLayout() {
  const { buildId = "" } = useParams();
  const report = getReport(buildId);

  if (!report) return <NotFound message={`No report found for build ${buildId}.`} />;

  const base = `/reports/${report.buildId}`;
  const ready = report.status === "ready";
  const likely = report.findings.filter((f) => f.classification === "likely_bug").length;

  const tabs: TabItem[] = [
    { to: base, label: "Insights", icon: <Pulse size={16} />, end: true },
    { to: `${base}/findings`, label: "Findings", icon: <Layers size={16} />, count: report.findings.length },
  ];

  return (
    <div className="min-h-full space-y-4 bg-page p-4">
      <div className="rounded-xl border border-line bg-card px-6 pt-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2.5">
              {/* The branch shrinks and ends in an ellipsis; the build id is never cut off. */}
              <h1 className="flex min-w-0 items-baseline gap-1.5 text-xl font-semibold text-ink-900">
                <Truncate>{report.branch}</Truncate>
                <span className="shrink-0">#{report.buildId}</span>
              </h1>
              <span className="min-w-0 max-w-48 shrink">
                <Chip>
                  <Truncate>{report.project}</Truncate>
                </Chip>
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <StatusPill tone={ready ? (likely > 0 ? "danger" : "mint") : "warn"}>
                {ready ? (likely > 0 ? `${likely} likely bugs` : "No likely bugs") : "Processing"}
              </StatusPill>
              {report.author && <MetaItem>{report.author}</MetaItem>}
              <MetaItem>{new Date(report.generatedAt).toLocaleString()}</MetaItem>
              {report.commit && (
                <MetaItem>
                  <span className="font-mono">{report.commit}</span>
                </MetaItem>
              )}
              <MetaItem>
                {report.baseline.environment} vs {report.target.environment}
              </MetaItem>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 pb-3">
            <a href={report.percyBuildUrl} target="_blank" rel="noreferrer" className={buttonClass("secondary")}>
              <External size={16} />
              Open in Percy
            </a>
            <Button variant="primary" leadingIcon={<Download size={16} />} disabled={!ready}>
              Download
            </Button>
          </div>
        </div>

        <div className="mt-3">
          <Tabs items={tabs} ariaLabel="Report sections" />
        </div>
      </div>

      <div className="rounded-xl border border-line bg-card px-6 py-6">
        <Outlet context={{ report } satisfies ReportContext} />
      </div>
    </div>
  );
}
