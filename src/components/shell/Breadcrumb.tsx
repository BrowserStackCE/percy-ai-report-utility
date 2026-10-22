import { Fragment } from "react";
import { Link, useLocation, useMatch } from "react-router";
import { getReport } from "../../data/mock";
import { ChevronRight } from "../ui/Icons";
import { Truncate } from "../ui/Truncate";

interface Crumb {
  label: string;
  to?: string;
}

/** Builds the trail for the current route. The last crumb is the current page and is not a link. */
function useCrumbs(): Crumb[] {
  const { pathname } = useLocation();
  const comparison = useMatch("/reports/:buildId/findings/:findingId");
  const findings = useMatch("/reports/:buildId/findings");
  const report = useMatch("/reports/:buildId");

  const home: Crumb = { label: "Reports", to: "/" };

  const m = comparison ?? findings ?? report;
  if (m?.params.buildId) {
    const data = getReport(m.params.buildId);
    const base = `/reports/${m.params.buildId}`;
    const buildLabel = data ? `${data.branch} #${data.buildId}` : `#${m.params.buildId}`;

    if (comparison) {
      const finding = data?.findings.find((f) => f.id === comparison.params.findingId);
      return [
        home,
        { label: buildLabel, to: base },
        { label: "Findings", to: `${base}/findings` },
        { label: finding?.snapshotName ?? "Comparison" },
      ];
    }
    if (findings) return [home, { label: buildLabel, to: base }, { label: "Findings" }];
    return [home, { label: buildLabel }];
  }

  if (pathname === "/projects") return [home, { label: "Projects" }];
  if (pathname === "/login") return [home, { label: "Sign in" }];
  if (pathname === "/settings") return [home, { label: "Settings" }];
  if (pathname === "/ai-features") return [home, { label: "AI features" }];
  if (pathname === "/") return [{ label: "Reports" }];
  return [home, { label: "Not found" }];
}

/** Breadcrumb bar shown on every page, in its own card above the page content. */
export default function Breadcrumb() {
  const crumbs = useCrumbs();
  return (
    <nav aria-label="Breadcrumb" className="shrink-0 rounded-xl border border-line bg-white px-6 py-3">
      <ol className="flex min-w-0 items-center gap-2 text-sm">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <Fragment key={`${i}-${c.label}`}>
              {i > 0 && (
                <li aria-hidden="true" className="shrink-0 text-ink-300">
                  <ChevronRight size={14} />
                </li>
              )}
              <li className={last ? "min-w-0 font-semibold text-ink-900" : "min-w-0 shrink-0 text-ink-500"}>
                {c.to && !last ? (
                  <Link to={c.to} className="hover:text-ink-900">
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current={last ? "page" : undefined}>
                    <Truncate>{c.label}</Truncate>
                  </span>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
