import { describe, expect, it } from "vitest";
import { projectsForScope, scopeOfCredentials } from "../projects/scope";
import { timeAgo } from "../../components/report/ReportHeader";
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

describe("scopeOfCredentials", () => {
  it("reads a web token as web and an app token as app", () => {
    expect(scopeOfCredentials({ percyToken: "web_abc123" })).toBe("web");
    expect(scopeOfCredentials({ percyToken: "app_abc123" })).toBe("app");
  });

  it("is case-insensitive and ignores surrounding spaces", () => {
    expect(scopeOfCredentials({ percyToken: "  WEB_abc " })).toBe("web");
  });

  it("covers both kinds for BrowserStack credentials, even next to a single-kind token", () => {
    expect(scopeOfCredentials({ username: "u", accessKey: "k" })).toBe("both");
    expect(scopeOfCredentials({ username: "u", accessKey: "k", percyToken: "web_x" })).toBe("both");
  });

  it("does not guess for a token without a known prefix or for no credentials", () => {
    expect(scopeOfCredentials({ percyToken: "abc123" })).toBe("both");
    expect(scopeOfCredentials({})).toBe("both");
  });
});

describe("projectsForScope", () => {
  const all = [project("1", "web"), project("2", "app"), project("3", "unknown")];

  it("keeps everything for both", () => {
    expect(projectsForScope(all, "both")).toHaveLength(3);
  });

  it("keeps only web projects (and unknown ones) for a web scope", () => {
    expect(projectsForScope(all, "web").map((p) => p.id)).toEqual(["1", "3"]);
  });

  it("keeps only app projects (and unknown ones) for an app scope", () => {
    expect(projectsForScope(all, "app").map((p) => p.id)).toEqual(["2", "3"]);
  });
});

describe("timeAgo", () => {
  const now = Date.parse("2026-06-10T12:00:00Z");
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it("words recent times in minutes, hours, days and months", () => {
    expect(timeAgo(ago(20_000), now)).toBe("just now");
    expect(timeAgo(ago(60_000), now)).toBe("1 min ago");
    expect(timeAgo(ago(5 * 60_000), now)).toBe("5 mins ago");
    expect(timeAgo(ago(2 * 3_600_000), now)).toBe("2 hrs ago");
    expect(timeAgo(ago(3 * 86_400_000), now)).toBe("3 days ago");
    expect(timeAgo(ago(65 * 86_400_000), now)).toBe("2 months ago");
  });

  it("returns null for empty or unparsable input and never goes negative", () => {
    expect(timeAgo(null, now)).toBeNull();
    expect(timeAgo("not a date", now)).toBeNull();
    expect(timeAgo(new Date(now + 60_000).toISOString(), now)).toBe("just now");
  });
});