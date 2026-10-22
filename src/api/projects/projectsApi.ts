import { ApiError } from "../errors";
import { percyGet, type Auth } from "../http";
import { parseProjectsResponse } from "./mapper";
import type { Project, ProjectsPage } from "./types";

const PAGE_SIZE = 50;
/** Safety stop so a misbehaving cursor can never loop forever. */
const MAX_PAGES = 40;

export interface ListProjectsOptions {
  auth: Auth;
  signal?: AbortSignal;
}

/** Fetch one page of projects. `page[limit]` and `page[cursor]` are the supported paging params. */
export async function fetchProjectsPage(cursor: number | null, { auth, signal }: ListProjectsOptions): Promise<ProjectsPage> {
  const json = await percyGet("/projects", {
    auth,
    signal,
    query: { "page[limit]": PAGE_SIZE, "page[cursor]": cursor ?? undefined },
  });
  return parseProjectsResponse(json);
}

/**
 * Fetch every project the credentials can access, following `meta.next_page` until it is null.
 * Results are de-duplicated by id because Percy's counts and page sizes do not always add up.
 */
export async function listProjects(options: ListProjectsOptions): Promise<Project[]> {
  const byId = new Map<string, Project>();
  let cursor: number | null = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const result: ProjectsPage = await fetchProjectsPage(cursor, options);
    for (const p of result.projects) byId.set(p.id, p);
    if (result.nextPage === null || result.nextPage === cursor) break;
    cursor = result.nextPage;
    if (page === MAX_PAGES - 1) {
      throw new ApiError("invalid_response", "Percy returned more project pages than expected.");
    }
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}
