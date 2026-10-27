// Raw JSON:API shapes returned by GET /projects, limited to the fields we read.
// Every attribute is optional/nullable on purpose: Percy returns different sets of attributes for
// different project types, and the mapper must not trust any of them to be present.

export interface RawResourceId {
  type: string;
  id: string;
}

export interface RawRelationship {
  data?: RawResourceId | null;
}

export interface RawProjectAttributes {
  name?: string;
  slug?: string;
  "full-slug"?: string;
  type?: string; // "web" | "app" | "automate" | "visual_monitoring" ...
  product?: string; // "web" | "app"
  "is-enabled"?: boolean;
  "default-base-branch"?: string | null;
  workflow?: string | null;
  source?: string | null;
  "created-at"?: string;
  "updated-at"?: string;
  "current-period-usage"?: number | null;
  "screenshot-limit"?: number | null;
  "publicly-readable"?: boolean;
  "is-demo"?: boolean;
  "ai-enabled"?: boolean;
  "diff-sensitivity-level"?: number | null;
  "wait-for-base-build"?: boolean;
  autofinalize?: boolean;
  "auto-approve-branch-filter"?: string | null;
  "approval-required-branch-filter"?: string | null;
}

export interface RawProject {
  type: "projects";
  id: string;
  attributes?: RawProjectAttributes;
  links?: { self?: string };
  relationships?: {
    organization?: RawRelationship;
    repo?: RawRelationship;
  };
}

export interface RawIncluded {
  type: string;
  id: string;
  attributes?: Record<string, unknown>;
}

/** Percy returns an array for BrowserStack credentials and a single object for a project token. */
export interface RawProjectsResponse {
  data: RawProject | RawProject[];
  included?: RawIncluded[];
  meta?: { next_page?: number | null; all_project_count?: number };
}

// ---- Domain model: what the UI works with ----

/** Product family the project belongs to, normalised from `product` / `type`. */
export type ProjectKind = "web" | "app" | "unknown";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  /** Name of the organization's owner, filled in by the members lookup. Null until it has loaded or when Percy names nobody. */
  ownerName: string | null;
}

/** Raw JSON:API shapes returned by GET /organizations/:slug/organization-users?include=user. */
export interface RawOrganizationUsersResponse {
  data?: Array<{
    type: string;
    id: string;
    attributes?: { owner?: boolean; role?: string };
    relationships?: { user?: RawRelationship };
  }>;
  included?: RawIncluded[];
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  /** "org-slug/project-slug"; the identifier Percy uses in URLs. */
  fullSlug: string;
  kind: ProjectKind;
  /** Raw Percy project type, shown as-is (for example "automate"). */
  type: string;
  enabled: boolean;
  defaultBaseBranch: string | null;
  workflow: string | null;
  source: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  /** Screenshots used in the current billing period. */
  usage: number | null;
  screenshotLimit: number | null;
  publiclyReadable: boolean;
  demo: boolean;
  aiEnabled: boolean;
  diffSensitivity: number | null;
  waitForBaseBuild: boolean;
  autoFinalize: boolean;
  autoApproveBranches: string | null;
  approvalRequiredBranches: string | null;
  organization: Organization | null;
  /** Link to the project on percy.io. */
  percyUrl: string | null;
}

export interface ProjectsPage {
  projects: Project[];
  /** Cursor for the next page, or null on the last one. */
  nextPage: number | null;
}
