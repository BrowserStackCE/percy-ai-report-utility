import { beforeEach, describe, expect, it, vi } from "vitest";
import { cacheOwner, clearProjectsCache, readProjectsCache, writeProjectsCache } from "../projects/cache";
import { projectsForProduct } from "../projects/ProductProvider";
import type { Project, ProjectKind } from "../projects/types";

const project = (id: string, kind: ProjectKind): Project => ({
  id,
  name: `P${id}`,
  slug: `p${id}`,
  fullSlug: `org/p${id}`,
  kind,
  type: kind,
  enabled: true,
  defaultBaseBranch: null,
  workflow: null,
  source: null,
  createdAt: null,
  updatedAt: null,
  usage: null,
  screenshotLimit: null,
  publiclyReadable: false,
  demo: false,
  aiEnabled: false,
  diffSensitivity: null,
  waitForBaseBuild: false,
  autoFinalize: false,
  autoApproveBranches: null,
  approvalRequiredBranches: null,
  organization: null,
  percyUrl: null,
});

/** Minimal in-memory localStorage; the tests run in Node, which has none. */
function stubStorage() {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  });
  return data;
}

describe("projects cache", () => {
  beforeEach(() => {
    stubStorage();
  });

  it("returns what was written for the same owner", () => {
    const owner = cacheOwner({ username: "u", accessKey: "k" });
    writeProjectsCache(owner, [project("1", "web")]);
    const hit = readProjectsCache(owner);
    expect(hit?.projects.map((p) => p.id)).toEqual(["1"]);
    expect(hit?.savedAt).toBeGreaterThan(0);
  });

  it("is a miss for different credentials, so one user never sees another's projects", () => {
    writeProjectsCache(cacheOwner({ username: "u", accessKey: "k" }), [project("1", "web")]);
    expect(readProjectsCache(cacheOwner({ username: "other", accessKey: "k" }))).toBeNull();
    expect(readProjectsCache(cacheOwner({ percyToken: "web_x" }))).toBeNull();
  });

  it("is a miss after clearing (Hot reload)", () => {
    const owner = cacheOwner({ percyToken: "web_x" });
    writeProjectsCache(owner, [project("1", "web")]);
    clearProjectsCache();
    expect(readProjectsCache(owner)).toBeNull();
  });

  it("ignores corrupt or wrong-version entries", () => {
    const data = stubStorage();
    const owner = cacheOwner({ percyToken: "web_x" });
    data.set("percy_report_projects_cache", "{not json");
    expect(readProjectsCache(owner)).toBeNull();
    data.set("percy_report_projects_cache", JSON.stringify({ v: 999, owner, savedAt: 1, projects: [] }));
    expect(readProjectsCache(owner)).toBeNull();
  });

  it("never stores the credentials themselves in the owner key", () => {
    const owner = cacheOwner({ username: "someone", accessKey: "super-secret-key" });
    expect(owner).not.toContain("someone");
    expect(owner).not.toContain("super-secret-key");
  });

  it("does not throw when storage is unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    });
    expect(() => writeProjectsCache("o", [])).not.toThrow();
    expect(readProjectsCache("o")).toBeNull();
    expect(() => clearProjectsCache()).not.toThrow();
  });
});

describe("projectsForProduct", () => {
  const all = [project("1", "web"), project("2", "app"), project("3", "unknown"), project("4", "web")];

  it("keeps only web projects (and unknown ones) for web", () => {
    expect(projectsForProduct(all, "web").map((p) => p.id)).toEqual(["1", "3", "4"]);
  });

  it("keeps only app projects (and unknown ones) for app", () => {
    expect(projectsForProduct(all, "app").map((p) => p.id)).toEqual(["2", "3"]);
  });
});