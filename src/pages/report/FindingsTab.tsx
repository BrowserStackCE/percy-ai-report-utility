import { useCallback, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useReport } from "./useReport";
import type { Classification, Finding } from "../../types";
import {
  Checkbox,
  Chip,
  ClassificationBadge,
  DataTable,
  Drawer,
  Filter,
  FilterPanel,
  FilterSection,
  IconButton,
  ImagePlaceholder,
  Popover,
  Radio,
  SearchInput,
  Select,
  Sort,
  Truncate,
  buttonClass,
  classificationLabels,
  type Column,
} from "../../components/ui";

type SortKey = "bugs" | "diff" | "page";
type GroupBy = "none" | "category" | "page";

const classificationOrder: Classification[] = ["likely_bug", "not_bug", "not_classified"];

const groupOptions = [
  { value: "none" as const, label: "No grouping" },
  { value: "category" as const, label: "Category" },
  { value: "page" as const, label: "Page" },
];

const sortOptions: Array<{ value: SortKey; label: string }> = [
  { value: "bugs", label: "Bugs (High to Low)" },
  { value: "diff", label: "Diff % (High to Low)" },
  { value: "page", label: "Page (A to Z)" },
];

export default function FindingsTab() {
  const report = useReport();
  const { findings } = report;
  const [params, setParams] = useSearchParams();

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("bugs");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [classes, setClasses] = useState<Record<Classification, boolean>>({
    likely_bug: true,
    not_bug: true,
    not_classified: true,
  });
  const [categoryOff, setCategoryOff] = useState<Set<string>>(new Set());

  const selectedId = params.get("finding");
  const selected = findings.find((f) => f.id === selectedId);

  const openFinding = (id: string) => setParams({ finding: id });
  const closeFinding = useCallback(() => setParams({}), [setParams]);

  const categories = useMemo(() => [...new Set(findings.map((f) => f.category))], [findings]);
  const countBy = (c: Classification) => findings.filter((f) => f.classification === c).length;
  const countCategory = (name: string) => findings.filter((f) => f.category === name).length;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rank = (f: Finding) => classificationOrder.indexOf(f.classification);
    const list = findings.filter(
      (f) =>
        classes[f.classification] &&
        !categoryOff.has(f.category) &&
        (!q || f.snapshotName.toLowerCase().includes(q) || (f.pageUrl ?? "").toLowerCase().includes(q)),
    );
    list.sort((a, b) => {
      if (groupBy === "category" && a.category !== b.category) return a.category.localeCompare(b.category);
      if (groupBy === "page" && a.snapshotName !== b.snapshotName) return a.snapshotName.localeCompare(b.snapshotName);
      if (sort === "bugs") return rank(a) - rank(b);
      if (sort === "diff") return (b.diffPercent ?? 0) - (a.diffPercent ?? 0);
      return a.snapshotName.localeCompare(b.snapshotName);
    });
    return list;
  }, [findings, query, classes, categoryOff, sort, groupBy]);

  const filtersActive = classificationOrder.some((c) => !classes[c]) || categoryOff.size > 0 || groupBy !== "none";

  function resetFilters() {
    setClasses({ likely_bug: true, not_bug: true, not_classified: true });
    setCategoryOff(new Set());
    setGroupBy("none");
  }

  function toggleCategory(name: string, on: boolean) {
    setCategoryOff((prev) => {
      const next = new Set(prev);
      if (on) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const columns: Column<Finding>[] = [
    {
      key: "page",
      header: "Page / snapshot",
      render: (f) => (
        <button
          type="button"
          onClick={() => openFinding(f.id)}
          className="block w-full max-w-64 text-left"
          aria-label={`Open details for ${f.snapshotName}, ${f.category}`}
        >
          <Truncate className="font-semibold text-ink-900 hover:text-brand-600">{f.snapshotName}</Truncate>
          {f.pageUrl && <Truncate className="mt-0.5 font-mono text-xs text-ink-400">{f.pageUrl}</Truncate>}
        </button>
      ),
    },
    { key: "category", header: "Category", render: (f) => <span className="text-ink-700">{f.category}</span> },
    { key: "class", header: "Classification", render: (f) => <ClassificationBadge classification={f.classification} /> },
    {
      key: "diff",
      header: "Diff",
      render: (f) => <span className="tabular-nums text-ink-700">{f.diffPercent !== undefined ? `${f.diffPercent}%` : "-"}</span>,
    },
    {
      key: "desc",
      header: "AI description",
      className: "max-w-sm",
      render: (f) => <span className="line-clamp-2 text-ink-700">{f.description}</span>,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <SearchInput
          className="flex-1"
          value={query}
          onChange={setQuery}
          placeholder="Search by page or snapshot"
          aria-label="Search findings"
        />

        <Popover
          align="right"
          panelClassName="w-64 py-2"
          trigger={({ toggle, triggerProps }) => (
            <IconButton label="Sort" onClick={toggle} {...triggerProps}>
              <Sort />
            </IconButton>
          )}
        >
          {({ close }) => (
            <div role="radiogroup" aria-label="Sort findings">
              {sortOptions.map((o) => (
                <Radio
                  key={o.value}
                  name="sort"
                  label={o.label}
                  checked={sort === o.value}
                  onChange={() => {
                    setSort(o.value);
                    close();
                  }}
                />
              ))}
            </div>
          )}
        </Popover>

        <Popover
          align="right"
          trigger={({ toggle, triggerProps }) => (
            <IconButton label="Filters" active={filtersActive} onClick={toggle} {...triggerProps}>
              <Filter />
            </IconButton>
          )}
        >
          {() => (
            <FilterPanel onReset={resetFilters} canReset={filtersActive}>
              <FilterSection title="Bug classification">
                {classificationOrder.map((c) => (
                  <Checkbox
                    key={c}
                    label={classificationLabels[c]}
                    count={countBy(c)}
                    checked={classes[c]}
                    onChange={(on) => setClasses((prev) => ({ ...prev, [c]: on }))}
                  />
                ))}
              </FilterSection>
              <FilterSection title="Category">
                {categories.map((name) => (
                  <Checkbox
                    key={name}
                    label={name}
                    count={countCategory(name)}
                    checked={!categoryOff.has(name)}
                    onChange={(on) => toggleCategory(name, on)}
                  />
                ))}
              </FilterSection>
              <div className="px-5 py-4">
                <p className="mb-2 text-base font-semibold text-ink-900">Group by</p>
                <Select value={groupBy} options={groupOptions} onChange={setGroupBy} ariaLabel="Group by" />
              </div>
            </FilterPanel>
          )}
        </Popover>
      </div>

      <p className="text-sm text-ink-500">
        Showing {rows.length} of {findings.length} findings
      </p>

      <DataTable columns={columns} rows={rows} rowKey={(f) => f.id} empty="No findings match the selected filters." />

      <Drawer open={Boolean(selected)} onClose={closeFinding} title={selected?.snapshotName ?? "Finding"}>
        {selected && (
          <FindingDetail
            finding={selected}
            buildId={report.buildId}
            baseline={report.baseline.environment}
            target={report.target.environment}
          />
        )}
      </Drawer>
    </div>
  );
}

function FindingDetail({
  finding,
  buildId,
  baseline,
  target,
}: {
  finding: Finding;
  buildId: string;
  baseline: string;
  target: string;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <ClassificationBadge classification={finding.classification} />
        <Chip>{finding.category}</Chip>
        {finding.browser && (
          <Chip>
            {finding.browser}
            {finding.width ? ` ${finding.width}px` : ""}
          </Chip>
        )}
      </div>

      <section>
        <h3 className="text-sm font-semibold text-ink-900">AI description</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-700">{finding.description}</p>
      </section>

      {finding.pageUrl && (
        <section>
          <h3 className="text-sm font-semibold text-ink-900">Tested page</h3>
          <a
            href={finding.pageUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 block break-all font-mono text-xs text-brand-600 hover:underline"
          >
            {finding.pageUrl}
          </a>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3">
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-ink-500">Baseline ({baseline})</p>
          {finding.baselineImage ? (
            <img
              src={finding.baselineImage}
              alt={`Baseline capture of ${finding.snapshotName}`}
              className="w-full rounded-lg border border-line"
            />
          ) : (
            <ImagePlaceholder label="No capture" />
          )}
        </div>
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-ink-500">Target ({target})</p>
          {finding.targetImage ? (
            <img
              src={finding.targetImage}
              alt={`Target capture of ${finding.snapshotName}`}
              className="w-full rounded-lg border border-line"
            />
          ) : (
            <ImagePlaceholder label="No capture" />
          )}
        </div>
      </section>

      <Link to={`/reports/${buildId}/findings/${finding.id}`} className={buttonClass("primary", "w-full")}>
        View comparison
      </Link>
    </div>
  );
}