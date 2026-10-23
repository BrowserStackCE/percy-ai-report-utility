import { percyGet, type Auth } from "../http";
import { BUILDS_PAGE_SIZE, parseBuildResponse, parseBuildsResponse } from "./mapper";
import type { Build, BuildFilters, BuildsPage } from "./types";

export interface ListBuildsOptions {
  auth: Auth;
  projectId: string;
  /** Build id; returns builds with a lower id than this (the next, older page). */
  cursor?: number | null;
  /** Server-side filters supported by Percy: filter[branch], filter[state], filter[sha]. */
  filters?: BuildFilters;
  signal?: AbortSignal;
}

/** Fetch one page of recent builds (last 30 days) for a project, newest first. */
export async function fetchBuildsPage({ auth, projectId, cursor, filters, signal }: ListBuildsOptions): Promise<BuildsPage> {
  const json = await percyGet("/builds", {
    auth,
    signal,
    query: {
      project_id: projectId,
      "page[limit]": BUILDS_PAGE_SIZE,
      "page[cursor]": cursor ?? undefined,
      "filter[branch]": filters?.branch?.trim() || undefined,
      "filter[state]": filters?.state || undefined,
      "filter[sha]": filters?.sha?.trim() || undefined,
    },
  });
  return parseBuildsResponse(json);
}

/** Fetch one build with all of its details. */
export async function fetchBuild(buildId: string, { auth, signal }: { auth: Auth; signal?: AbortSignal }): Promise<Build> {
  const json = await percyGet(`/builds/${encodeURIComponent(buildId)}`, { auth, signal });
  return parseBuildResponse(json);
}
