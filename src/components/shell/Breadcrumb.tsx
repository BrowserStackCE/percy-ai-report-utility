import { Fragment } from "react";
import { Link, useLocation, useMatch } from "react-router";
import { useBuild } from "../../api/builds/useBuild";
import { useProjects } from "../../api/projects/useProjects";
import { useSelectedProject } from "../../api/projects/SelectedProjectProvider";
import { ChevronRight } from "../ui/Icons";
import { Truncate } from "../ui/Truncate";

interface Crumb {
  label: string;
  to?: string;
}

/** Builds the trail for the current route. The last crumb is the current page and is not a link. */
function useCrumbs(buildId: string | undefined): Crumb[] {
  const { pathname } = useLocation();
  const { projectId } = useSelectedProject();
  const { projects } = useProjects();
  const { build } = useBuild(buildId ?? "");
  const projectName = projects.find((p) => p.id === projectId)?.name;

  const projectsCrumb: Crumb = { label: "Projects", to: "/projects" };
  const buildsCrumb: Crumb = { label: projectName ?? "Reports", to: "/" };

  if (buildId) {
    const label = build?.buildNumber != null ? `Build #${build.buildNumber}` : `Build ${buildId}`;
    return [projectsCrumb, buildsCrumb, { label }];
  }
  if (pathname === "/") return [projectsCrumb, { label: projectName ?? "Reports" }];
  if (pathname === "/projects") return [{ label: "Projects" }];
  if (pathname === "/login") return [projectsCrumb, { label: "Sign in" }];
  return [projectsCrumb, { label: "Not found" }];
}

/** Breadcrumb bar shown on every page, in its own card above the page content. */
export default function Breadcrumb() {
  const match = useMatch("/reports/:buildId");
  const crumbs = useCrumbs(match?.params.buildId);
  return (
    <nav aria-label="Breadcrumb" className="shrink-0 rounded-xl border border-line bg-card px-6 py-3">
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
