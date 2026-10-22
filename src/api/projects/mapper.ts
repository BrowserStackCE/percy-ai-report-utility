import { ApiError } from "../errors";
import type {
  Organization,
  Project,
  ProjectKind,
  ProjectsPage,
  RawIncluded,
  RawProject,
  RawProjectsResponse,
} from "./types";

const PERCY_WEB = "https://percy.io";

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Percy's web-based products. The scanners render URLs in a browser, so they belong with web projects.
const WEB_TYPES = new Set(["web", "automate", "visual_monitoring", "visual_scanner", "responsive_scanner"]);

function kindOf(product: string | null, type: string | null): ProjectKind {
  const p = (product ?? "").toLowerCase();
  const t = (type ?? "").toLowerCase();
  if (p === "app" || t === "app") return "app";
  if (WEB_TYPES.has(p) || WEB_TYPES.has(t)) return "web";
  return "unknown";
}

function buildOrganizations(included: RawIncluded[] | undefined): Map<string, Organization> {
  const map = new Map<string, Organization>();
  for (const item of included ?? []) {
    if (item.type !== "organizations") continue;
    const name = str(item.attributes?.name);
    const slug = str(item.attributes?.slug);
    if (name || slug) map.set(item.id, { id: item.id, name: name ?? slug ?? item.id, slug: slug ?? "" });
  }
  return map;
}

/** Map one raw project to the domain model. Returns null when it lacks the identity fields. */
export function mapProject(raw: RawProject, orgs: Map<string, Organization>): Project | null {
  const a = raw.attributes;
  if (!raw.id || !a) return null;
  const slug = str(a.slug);
  const name = str(a.name) ?? slug;
  if (!name || !slug) return null;

  const type = str(a.type) ?? "unknown";
  const fullSlug = str(a["full-slug"]) ?? slug;
  const orgId = raw.relationships?.organization?.data?.id;

  return {
    id: String(raw.id),
    name,
    slug,
    fullSlug,
    kind: kindOf(str(a.product), str(a.type)),
    type,
    enabled: a["is-enabled"] !== false,
    defaultBaseBranch: str(a["default-base-branch"]),
    workflow: str(a.workflow),
    source: str(a.source),
    createdAt: str(a["created-at"]),
    updatedAt: str(a["updated-at"]),
    usage: num(a["current-period-usage"]),
    screenshotLimit: num(a["screenshot-limit"]),
    publiclyReadable: a["publicly-readable"] === true,
    demo: a["is-demo"] === true,
    aiEnabled: a["ai-enabled"] === true,
    diffSensitivity: num(a["diff-sensitivity-level"]),
    waitForBaseBuild: a["wait-for-base-build"] === true,
    autoFinalize: a.autofinalize === true,
    autoApproveBranches: str(a["auto-approve-branch-filter"]),
    approvalRequiredBranches: str(a["approval-required-branch-filter"]),
    organization: (orgId && orgs.get(orgId)) || null,
    percyUrl: `${PERCY_WEB}/${fullSlug}`,
  };
}

/** Validate and map a GET /projects response. Throws ApiError("invalid_response") on a wrong shape. */
export function parseProjectsResponse(json: unknown): ProjectsPage {
  if (!isObject(json) || !("data" in json)) {
    throw new ApiError("invalid_response", "Percy returned an unexpected response while loading projects.");
  }
  const body = json as unknown as RawProjectsResponse;
  const rawList = Array.isArray(body.data) ? body.data : isObject(body.data) ? [body.data] : null;
  if (!rawList) {
    throw new ApiError("invalid_response", "Percy returned an unexpected response while loading projects.");
  }

  const orgs = buildOrganizations(Array.isArray(body.included) ? body.included : undefined);
  const projects: Project[] = [];
  for (const raw of rawList) {
    const mapped = isObject(raw) ? mapProject(raw, orgs) : null;
    if (mapped) projects.push(mapped);
  }

  const next = body.meta?.next_page;
  return { projects, nextPage: typeof next === "number" ? next : null };
}
