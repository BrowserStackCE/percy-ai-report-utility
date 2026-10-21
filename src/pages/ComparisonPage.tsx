import { useState } from "react";
import { useParams } from "react-router";
import { getReport } from "../data/mock";
import {
  Button,
  Card,
  ChevronDown,
  ChevronUp,
  Chip,
  ClassificationBadge,
  ColumnsSplit,
  External,
  ImagePlaceholder,
  Kbd,
  Layers,
  OptionTileGroup,
  PageContainer,
  PageHeader,
  Truncate,
  Popover,
  Segmented,
  SnapshotCard,
  buttonClass,
} from "../components/ui";
import NotFound from "./NotFound";

type ViewMode = "split" | "stacked";

const browsers = [
  { value: "chrome", label: "Chrome" },
  { value: "firefox", label: "Firefox" },
  { value: "safari", label: "Safari" },
  { value: "edge", label: "Edge" },
];

const widths = [
  { value: "1280", label: "1280" },
  { value: "1920", label: "1920" },
];

const viewOptions = [
  { value: "split" as const, label: "Side by side", icon: <ColumnsSplit size={18} /> },
  { value: "stacked" as const, label: "Stacked", icon: <Layers size={18} /> },
];

export default function ComparisonPage() {
  const { buildId = "", findingId = "" } = useParams();
  const report = getReport(buildId);
  const finding = report?.findings.find((f) => f.id === findingId);

  const [view, setView] = useState<ViewMode>("split");
  const [browser, setBrowser] = useState("chrome");
  const [width, setWidth] = useState("1280");

  if (!report || !finding) return <NotFound message="This comparison could not be found." />;

  const browserLabel = browsers.find((b) => b.value === browser)?.label ?? "";
  const panes = [
    { side: report.baseline, image: finding.baselineImage },
    { side: report.target, image: finding.targetImage },
  ];

  return (
    <PageContainer>
      <PageHeader
        title={finding.snapshotName}
        backTo={`/reports/${report.buildId}/findings`}
        meta={<ClassificationBadge classification={finding.classification} />}
        description={finding.description}
        actions={
          finding.pageUrl ? (
            <a href={finding.pageUrl} target="_blank" rel="noreferrer" className={buttonClass("secondary")}>
              <External size={16} />
              Open tested page
            </a>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 max-w-full items-center gap-2 text-sm text-ink-500">
          <Chip>{finding.category}</Chip>
          {finding.pageUrl && <Truncate className="font-mono text-xs text-ink-400">{finding.pageUrl}</Truncate>}
        </div>

        <div className="flex items-center gap-2">
          <Segmented value={view} options={viewOptions} onChange={setView} ariaLabel="Comparison layout" />

          <Popover
            align="right"
            panelClassName="w-96 space-y-5 p-5"
            trigger={({ open, toggle, triggerProps }) => (
              <Button
                onClick={toggle}
                {...triggerProps}
                className={open ? "border-brand-500 bg-brand-50 text-brand-700" : undefined}
              >
                {browserLabel} <span className="text-ink-400">·</span> {width}px
                {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </Button>
            )}
          >
            {() => (
              <>
                <OptionTileGroup title="Browsers" value={browser} options={browsers} onChange={setBrowser} />
                <OptionTileGroup title="Widths" value={width} options={widths} onChange={setWidth} tileClassName="min-w-24" />
                <p className="flex flex-wrap items-center gap-2 border-t border-line pt-4 text-xs text-ink-500">
                  <Kbd>[</Kbd>
                  <Kbd>]</Kbd>
                  switches browsers <span aria-hidden="true">·</span>
                  <Kbd>,</Kbd>
                  <Kbd>.</Kbd>
                  switches widths
                </p>
              </>
            )}
          </Popover>
        </div>
      </div>

      <div className={view === "split" ? "grid gap-4 md:grid-cols-2" : "grid gap-4"}>
        {panes.map(({ side, image }) => (
          <Card key={side.label} className="p-4">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-ink-900">{side.label} capture</h2>
              <span className="text-xs text-ink-500">{side.environment}</span>
            </div>
            {image ? (
              <SnapshotCard to="#" title={finding.snapshotName} image={image} />
            ) : (
              <ImagePlaceholder label="Captured screenshot appears here" />
            )}
          </Card>
        ))}
      </div>

      <p className="text-xs text-ink-400">
        These are the screenshots captured for the Percy comparison, not the current live pages.
      </p>
    </PageContainer>
  );
}