import type { ReactNode } from "react";
import type { Build, BuildState } from "../../api/builds/types";
import { formatDuration, humanize, shortSha } from "../../lib/format";
import { useDateFormat } from "../../lib/dateFormat";
import { Chip, Clock, External, Popover, StatusPill, User, buttonClass } from "../ui";

const stateTone: Record<BuildState, "mint" | "warn" | "danger" | "neutral"> = {
  finished: "mint",
  processing: "warn",
  waiting: "warn",
  failed: "danger",
  unknown: "neutral",
};

const stateLabel: Record<BuildState, string> = {
  finished: "Finished",
  processing: "Processing",
  waiting: "Waiting",
  failed: "Failed",
  unknown: "Unknown",
};

const reviewTone: Record<string, "mint" | "warn" | "danger" | "neutral"> = {
  approved: "mint",
  unreviewed: "warn",
  changes_requested: "danger",
  rejected: "danger",
};

function Meta({ icon, children, title }: { icon?: ReactNode; children: ReactNode; title?: string }) {
  return (
    <span className="flex items-center gap-1.5 text-sm text-ink-700" title={title}>
      {icon && <span className="text-ink-500">{icon}</span>}
      {children}
    </span>
  );
}

/** Who ran the build: the commit author, else whoever failed it manually. Null when Percy does not say. */
export function runBy(b: Build): string | null {
  return b.commit?.author ?? b.failedBy ?? null;
}

/** "5 mins ago" style label for a past timestamp. Returns null for empty or unparsable input. */
export function timeAgo(iso: string | null, now = Date.now()): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  const mo = Math.floor(d / 30);
  return `${mo} month${mo === 1 ? "" : "s"} ago`;
}

/** Chips beside the title: the first few, then a "+N" that opens the rest. */
function ChipOverflow({ items, visible = 2 }: { items: string[]; visible?: number }) {
  const shown = items.slice(0, visible);
  const rest = items.slice(visible);
  return (
    <>
      {shown.map((c) => (
        <Chip key={c}>{c}</Chip>
      ))}
      {rest.length > 0 && (
        <Popover
          panelClassName="w-56 p-3"
          trigger={({ toggle, triggerProps }) => (
            <button
              type="button"
              onClick={toggle}
              aria-label={`${rest.length} more: ${rest.join(", ")}`}
              className="inline-flex items-center rounded-md bg-chip px-2 py-0.5 text-xs text-ink-700 transition-colors hover:bg-line"
              {...triggerProps}
            >
              +{rest.length}
            </button>
          )}
        >
          {() => (
            <div className="flex flex-wrap gap-1.5">
              {rest.map((c) => (
                <Chip key={c}>{c}</Chip>
              ))}
            </div>
          )}
        </Popover>
      )}
    </>
  );
}

/**
 * Compact report header: "Project #123" with branch and commit chips, then one line of facts
 * (status, who ran it, how long, when). Everything else lives in the Build details tab.
 */
export function ReportHeader({ build: b }: { build: Build }) {
  const { formatDateTime } = useDateFormat();
  const who = runBy(b);
  const started = b.cliStartedAt ?? b.createdAt;
  const ago = timeAgo(started);
  const chips = [b.branch, b.commit?.sha ? shortSha(b.commit.sha) : null, b.isPullRequest ? `PR #${b.pullRequestNumber ?? "?"}` : null].filter(
    (c): c is string => Boolean(c),
  );
  const flags = [
    b.isLatestOnBranch ? "Latest on branch" : null,
    b.partial ? "Partial" : null,
    b.prodBuild ? "Production" : null,
    b.designBuild ? "Design" : null,
  ].filter((c): c is string => Boolean(c));

  return (
    <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight text-ink-900 sm:truncate">
            {b.projectName ?? "Build"} #{b.buildNumber ?? b.id}
          </h1>
          <ChipOverflow items={[...chips, ...flags]} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <StatusPill tone={stateTone[b.state]}>{stateLabel[b.state]}</StatusPill>
          {b.reviewState && <StatusPill tone={reviewTone[b.reviewState] ?? "neutral"}>{humanize(b.reviewState)}</StatusPill>}
          {who && <Meta icon={<User size={16} />}>{who}</Meta>}
          {b.processingSeconds !== null && (
            <Meta icon={<Clock size={16} />} title="Time Percy took to process the build">
              {formatDuration(b.processingSeconds)}
            </Meta>
          )}
          {started && (
            <Meta icon={<Clock size={16} />} title={formatDateTime(started)}>
              {ago ?? formatDateTime(started)}
            </Meta>
          )}
          {b.pullRequestTitle && <span className="max-w-xs truncate text-sm text-ink-500">{b.pullRequestTitle}</span>}
        </div>
      </div>

      {b.percyUrl && (
        <a href={b.percyUrl} target="_blank" rel="noreferrer" className={`${buttonClass("secondary")} w-full justify-center sm:w-auto sm:justify-start`}>
          <External size={16} />
          Open in Percy
        </a>
      )}
    </div>
  );
}