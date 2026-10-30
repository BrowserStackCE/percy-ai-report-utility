import { useLocation } from "react-router";
import { useProjects } from "../../api/projects/useProjects";
import { useDateFormat } from "../../lib/dateFormat";
import { Button } from "../ui/Button";
import { RefreshCw } from "../ui/Icons";

/**
 * Clears the cached data and asks Percy again. Shown on the pages that cache: Projects, the build
 * list, a build's report and Analytics. Everything else is fetched fresh each time.
 */
export default function HotReloadButton() {
  const { pathname } = useLocation();
  const { hotReload, status, fetchedAt, fromCache } = useProjects();
  const { formatDateTime } = useDateFormat();

  const cachedPage = pathname === "/projects" || pathname === "/" || pathname === "/analytics" || pathname.startsWith("/reports/");
  if (!cachedPage) return null;

  const busy = status === "loading";
  const when = fetchedAt ? formatDateTime(new Date(fetchedAt).toISOString()) : null;
  const title = busy
    ? "Fetching from Percy"
    : `Data on this page is stored in this browser${when ? ` (${fromCache ? "saved" : "fetched"} ${when})` : ""}. Clear it and fetch the latest from Percy.`;

  return (
    <Button onClick={hotReload} disabled={busy} title={title} aria-label="Hot reload data" leadingIcon={<RefreshCw size={16} className={busy ? "animate-spin" : undefined} />}>
      Hot reload
    </Button>
  );
}
