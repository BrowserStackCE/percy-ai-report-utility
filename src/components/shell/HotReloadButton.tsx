import { useLocation } from "react-router";
import { useProjects } from "../../api/projects/useProjects";
import { useDateFormat } from "../../lib/dateFormat";
import { Button } from "../ui/Button";
import { RefreshCw } from "../ui/Icons";

/**
 * Clears the cached projects list and asks Percy again. Shown on the Projects page only, because
 * projects are the one thing the app caches.
 */
export default function HotReloadButton() {
  const { pathname } = useLocation();
  const { hotReload, status, fetchedAt, fromCache } = useProjects();
  const { formatDateTime } = useDateFormat();

  if (pathname !== "/projects") return null;

  const busy = status === "loading";
  const when = fetchedAt ? formatDateTime(new Date(fetchedAt).toISOString()) : null;
  const title = busy
    ? "Fetching projects from Percy"
    : `Projects are stored in this browser${when ? ` (${fromCache ? "saved" : "fetched"} ${when})` : ""}. Clear them and fetch the latest from Percy.`;

  return (
    <Button onClick={hotReload} disabled={busy} title={title} aria-label="Hot reload projects" leadingIcon={<RefreshCw size={16} className={busy ? "animate-spin" : undefined} />}>
      Hot reload
    </Button>
  );
}
