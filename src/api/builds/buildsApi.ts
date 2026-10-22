import { percyGet, type Auth } from "../http";
import { BUILDS_PAGE_SIZE, parseBuildsResponse } from "./mapper";
import type { BuildsPage } from "./types";

export interface ListBuildsOptions {
  auth: Auth;
  projectId: string;
  /** Build id; returns builds with a lower id than this (the next, older page). */
  cursor?: number | null;
  signal?: AbortSignal;
}

/** Fetch one page of recent builds (last 30 days) for a project, newest first. */
export async function fetchBuildsPage({ auth, projectId, cursor, signal }: ListBuildsOptions): Promise<BuildsPage> {
  const json = await percyGet("/builds", {
    auth,
    signal,
    query: {
      project_id: projectId,
      "page[limit]": BUILDS_PAGE_SIZE,
      "page[cursor]": cursor ?? undefined,
    },
  });
  return parseBuildsResponse(json);
}
