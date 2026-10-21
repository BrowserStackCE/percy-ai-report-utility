import { useMemo } from "react";
import { Link } from "react-router";
import { useReport } from "./useReport";
import type { Classification } from "../../types";
import { BarChart, BigNumber, InlineAction, LegendRows, StackedBar, Widget, type Segment } from "../../components/ui";

const COLORS: Record<Classification, string> = {
  likely_bug: "bg-danger-600",
  not_bug: "bg-mint-700",
  not_classified: "bg-ink-300",
};

export default function InsightsTab() {
  const report = useReport();
  const base = `/reports/${report.buildId}`;
  const { findings, history } = report;

  const summary = useMemo(() => {
    const n = (c: Classification) => findings.filter((f) => f.classification === c).length;
    return { total: findings.length, likely: n("likely_bug"), notBug: n("not_bug"), unclassified: n("not_classified") };
  }, [findings]);

  const classSegments: Segment[] = [
    { key: "likely", label: "Likely bugs", value: summary.likely, color: COLORS.likely_bug },
    { key: "notbug", label: "Not bugs", value: summary.notBug, color: COLORS.not_bug },
    { key: "unclassified", label: "Not classified", value: summary.unclassified, color: COLORS.not_classified },
  ];

  const categories = useMemo(() => {
    const names = [...new Set(findings.map((f) => f.category))];
    return names
      .map((name) => ({ name, value: findings.filter((f) => f.category === name).length }))
      .sort((a, b) => b.value - a.value);
  }, [findings]);

  const pages = useMemo(() => {
    const names = [...new Set(findings.map((f) => f.snapshotName))];
    return names
      .map((name) => {
        const rows = findings.filter((f) => f.snapshotName === name);
        return { name, total: rows.length, bugs: rows.filter((f) => f.classification === "likely_bug").length };
      })
      .sort((a, b) => b.bugs - a.bugs || b.total - a.total);
  }, [findings]);

  const historyGroups = history.map((h) => ({
    label: h.label,
    segments: [
      { key: "notbug", label: "Not bugs", value: h.notBugs, color: "bg-mint-700" },
      { key: "unclassified", label: "Not classified", value: h.notClassified, color: "bg-ink-300" },
      { key: "likely", label: "Likely bugs", value: h.likelyBugs, color: "bg-danger-600" },
    ],
  }));

  const bugShare = summary.total ? Math.round((summary.likely / summary.total) * 100) : 0;
  const topCategory = categories[0];

  return (
    <div className="grid items-start gap-4 lg:grid-cols-12">
      <Widget title="Build summary" info="Differences reported by the Percy AI Review Agent" className="lg:col-span-4 lg:row-span-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-ink-900">All differences</span>
          <span className="text-lg font-semibold tabular-nums text-ink-900">{summary.total}</span>
        </div>
        <div className="mt-2">
          <StackedBar segments={classSegments} />
        </div>
        <div className="mt-5">
          <LegendRows segments={classSegments} />
        </div>
        <div className="mt-5">
          <InlineAction
            action={
              <Link to={`${base}/findings`} className="font-medium text-brand-600 hover:underline">
                View findings
              </Link>
            }
          >
            {summary.likely} flagged as likely bugs
          </InlineAction>
        </div>
      </Widget>

      <div className="grid gap-4 lg:col-span-3">
        <Widget title="Likely bugs" info="Classified by the AI Review Agent. Not confirmed defects.">
          <BigNumber value={summary.likely} caption={`${summary.likely} out of ${summary.total} differences`} />
        </Widget>
        <Widget title="Not bugs" info="Classified by the AI Review Agent as intentional or benign.">
          <BigNumber value={summary.notBug} caption={`${summary.notBug} out of ${summary.total} differences`} />
        </Widget>
        <Widget title="Not classified" info="No classification was returned for these differences.">
          <BigNumber value={summary.unclassified} caption={`${summary.unclassified} out of ${summary.total} differences`} />
        </Widget>
      </div>

      <Widget title="Build history" info="Differences per build, by AI classification" className="lg:col-span-5">
        <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-ink-500">
          {classSegments.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${s.color}`} />
              {s.label}
            </span>
          ))}
        </div>
        <BarChart groups={historyGroups} ariaLabel="Differences per build by classification" />
      </Widget>

      <Widget title="Top categories" info="Categories supplied by the AI Review Agent" className="lg:col-span-4">
        <ul className="space-y-3">
          {categories.map((c) => (
            <li key={c.name} className="flex items-center gap-3 text-sm">
              <span className="w-32 shrink-0 truncate text-ink-700">{c.name}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-chip">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${(c.value / summary.total) * 100}%` }} />
              </div>
              <span className="w-5 text-right tabular-nums text-ink-700">{c.value}</span>
            </li>
          ))}
        </ul>
      </Widget>

      <Widget title="Pages affected" info="Pages with the most likely bugs first" className="lg:col-span-4">
        <ul className="divide-y divide-line text-sm">
          {pages.map((p) => (
            <li key={p.name} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
              <span className="text-ink-900">{p.name}</span>
              <span className="text-xs text-ink-500">
                {p.bugs} likely {p.bugs === 1 ? "bug" : "bugs"} of {p.total}
              </span>
            </li>
          ))}
        </ul>
      </Widget>

      <Widget title="Highlights" info="Quick read of this build" className="lg:col-span-4">
        <ul className="space-y-3 text-sm">
          <li className="flex items-start justify-between gap-3 border-b border-line pb-3">
            <span className="text-ink-700">
              {bugShare}% of differences are likely bugs
            </span>
            <Link
              to={`${base}/findings`}
              className="shrink-0 rounded-full border border-line-strong px-3 py-1 text-xs font-medium text-ink-900 hover:bg-surface"
            >
              View findings
            </Link>
          </li>
          {topCategory && (
            <li className="text-ink-700">
              Most common category is {topCategory.name} ({topCategory.value} of {summary.total})
            </li>
          )}
          {summary.unclassified > 0 && (
            <li className="text-ink-700">{summary.unclassified} differences have no classification</li>
          )}
        </ul>
      </Widget>
    </div>
  );
}
