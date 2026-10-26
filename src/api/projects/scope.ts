import type { StoredCredentials } from "../../auth/cookies";
import type { Project, ProjectKind } from "./types";

/**
 * Which product family the signed-in credentials can read.
 *
 * Percy project tokens are prefixed by product (`web_...` or `app_...`) and only see their own kind of
 * project. BrowserStack credentials list both kinds. When both are stored, BrowserStack wins because
 * it is the broader credential and is what the API client sends first.
 */
export type CredentialScope = ProjectKind | "both";

export function scopeOfCredentials(c: StoredCredentials): CredentialScope {
  if (c.username && c.accessKey) return "both";
  const token = (c.percyToken ?? "").trim().toLowerCase();
  if (token.startsWith("web_")) return "web";
  if (token.startsWith("app_")) return "app";
  // A token without a known prefix: do not guess, show everything Percy returns.
  return "both";
}

/** Keep only the projects the credentials can actually view. Unknown-kind projects are kept. */
export function projectsForScope(projects: Project[], scope: CredentialScope): Project[] {
  if (scope === "both") return projects;
  return projects.filter((p) => p.kind === scope || p.kind === "unknown");
}
