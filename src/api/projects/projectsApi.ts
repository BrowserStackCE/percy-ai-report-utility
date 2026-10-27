import { ApiError } from "../errors";
import { percyGet, type Auth } from "../http";
import { parseOrganizationOwner, parseProjectsResponse } from "./mapper";
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

/** Fetch the name of an organization's owner. Resolves to null when Percy names nobody. */
export async function fetchOrganizationOwner(slug: string, { auth, signal }: ListProjectsOptions): Promise<string | null> {
  const json = await percyGet(`/organizations/${encodeURIComponent(slug)}/organization-users`, {
    auth,
    signal,
    query: { include: "user" },
  });
  return parseOrganizationOwner(json);
}

/**
 * Attach the owner's name to each project's organization. This is one request per organization, not
 * per project. It is best effort: if a lookup fails (for example the token cannot list members) the
 * projects still load and "Ran by" simply stays empty.
 */
async function withOwners(projects: Project[], options: ListProjectsOptions): Promise<Project[]> {
  const slugs = new Set<string>();
  for (const p of projects) if (p.organization?.slug) slugs.add(p.organization.slug);

  const owners = new Map<string, string | null>();
  await Promise.all(
    [...slugs].map(async (slug) => {
      try {
        owners.set(slug, await fetchOrganizationOwner(slug, options));
      } catch (err) {
        // A cancelled load must stay cancelled; any other failure only costs us the owner name.
        if (options.signal?.aborted) throw err;
        owners.set(slug, null);
      }
    }),
  );

  return projects.map((p) =>
    p.organization ? { ...p, organization: { ...p.organization, ownerName: owners.get(p.organization.slug) ?? null } } : p,
  );
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

  const sorted = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  return withOwners(sorted, options);
}
