import type { Segment } from "./Widget";
import { cn } from "./cn";

export interface BarGroup {
  label: string;
  /** Segments stack bottom to top in the order given. */
  segments: Segment[];
}

interface BarChartProps {
  groups: BarGroup[];
  height?: number;
  ariaLabel: string;
}

/** Simple stacked vertical bar chart with a y-axis, gridlines and x labels. */
export function BarChart({ groups, height = 200, ariaLabel }: BarChartProps) {
  const totals = groups.map((g) => g.segments.reduce((s, x) => s + x.value, 0));
  const max = Math.max(1, ...totals);
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);

  return (
    <figure aria-label={ariaLabel} className="w-full">
      <div className="flex gap-3">
        <div className="relative w-8 shrink-0 text-right text-[11px] text-ink-400" style={{ height }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2 tabular-nums" style={{ bottom: `${(t / top) * 100}%` }}>
              {t}
            </span>
          ))}
        </div>

        <div className="relative flex-1" style={{ height }}>
          {ticks.map((t) => (
            <div
              key={t}
              className="absolute inset-x-0 border-t border-dashed border-line"
              style={{ bottom: `${(t / top) * 100}%` }}
            />
          ))}
          <div className="absolute inset-0 flex items-end justify-around gap-3 px-2">
            {groups.map((g, i) => (
              <div
                key={g.label}
                className="flex w-full max-w-10 flex-col-reverse overflow-hidden rounded-sm"
                style={{ height: `${(totals[i] / top) * 100}%` }}
                title={g.segments.map((s) => `${s.label}: ${s.value}`).join(", ")}
              >
                {g.segments.map((s) => (
                  <div key={s.key} className={cn(s.color)} style={{ height: `${totals[i] ? (s.value / totals[i]) * 100 : 0}%` }} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="ml-11 mt-2 flex justify-around gap-3 px-2 text-[11px] text-ink-500">
        {groups.map((g) => (
          <span key={g.label} className="w-full max-w-10 truncate text-center">
            {g.label}
          </span>
        ))}
      </div>
    </figure>
  );
}

function niceStep(max: number): number {
  const rough = max / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(rough || 1)));
  const n = rough / pow;
  const unit = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return Math.max(1, unit * pow);
}
