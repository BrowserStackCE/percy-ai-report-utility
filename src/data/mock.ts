import type { BuildHistoryEntry, Finding, Report } from "../types";

const findings: Finding[] = [
  {
    id: "f-1",
    snapshotName: "Homepage",
    pageUrl: "https://stage.example.com/",
    category: "Layout shift",
    classification: "likely_bug",
    diffPercent: 12.4,
    browser: "Chrome",
    width: 1280,
    description:
      "The hero banner is pushed down by roughly 48px and overlaps the primary navigation on the target capture.",
  },
  {
    id: "f-2",
    snapshotName: "Product details",
    pageUrl: "https://stage.example.com/products/12",
    category: "Missing element",
    classification: "likely_bug",
    diffPercent: 6.1,
    browser: "Chrome",
    width: 1280,
    description: "The Add to cart button is absent from the target capture.",
  },
  {
    id: "f-3",
    snapshotName: "Pricing",
    pageUrl: "https://stage.example.com/pricing",
    category: "Content change",
    classification: "not_bug",
    diffPercent: 3.8,
    browser: "Firefox",
    width: 1280,
    description: "Promotional banner text differs between baseline and target, consistent with a copy update.",
  },
  {
    id: "f-4",
    snapshotName: "Checkout",
    category: "Style change",
    classification: "not_classified",
    diffPercent: 0.9,
    browser: "Chrome",
    width: 1920,
    description: "Button corner radius differs slightly. The agent did not return a classification.",
  },
  {
    id: "f-5",
    snapshotName: "Footer",
    pageUrl: "https://stage.example.com/",
    category: "Content change",
    classification: "not_bug",
    diffPercent: 0.4,
    browser: "Chrome",
    width: 1280,
    description: "Copyright year updated in the footer.",
  },
  {
    id: "f-6",
    snapshotName: "Homepage",
    pageUrl: "https://stage.example.com/",
    category: "Layout shift",
    classification: "likely_bug",
    diffPercent: 9.7,
    browser: "Safari",
    width: 1280,
    description: "Feature cards wrap to two rows and the third card is clipped at the right edge.",
  },
];

const history: BuildHistoryEntry[] = [
  { label: "#48203", likelyBugs: 1, notBugs: 3, notClassified: 0 },
  { label: "#48204", likelyBugs: 0, notBugs: 2, notClassified: 1 },
  { label: "#48205", likelyBugs: 2, notBugs: 4, notClassified: 0 },
  { label: "#48206", likelyBugs: 1, notBugs: 2, notClassified: 1 },
  { label: "#48207", likelyBugs: 3, notBugs: 3, notClassified: 0 },
  { label: "#48208", likelyBugs: 1, notBugs: 1, notClassified: 0 },
  { label: "#48209", likelyBugs: 2, notBugs: 3, notClassified: 1 },
  { label: "#48210", likelyBugs: 0, notBugs: 4, notClassified: 0 },
  { label: "#48211", likelyBugs: 2, notBugs: 2, notClassified: 1 },
  { label: "#48213", likelyBugs: 3, notBugs: 2, notClassified: 1 },
];

export const reports: Report[] = [
  {
    buildId: "48213907",
    project: "web-storefront",
    status: "ready",
    generatedAt: "2026-05-20T10:42:00Z",
    branch: "regression_branch",
    commit: "08513f1",
    author: "Demo User",
    percyBuildUrl: "https://percy.io/org/web-storefront/builds/48213907",
    baseline: { label: "Baseline", environment: "Prod" },
    target: { label: "Target", environment: "Stage" },
    findings,
    history,
  },
  {
    buildId: "48199120",
    project: "mobile-web-checkout-and-payments-experience-regression-suite",
    status: "processing",
    generatedAt: "2026-05-20T09:15:00Z",
    branch: "feature/very-long-branch-name-for-the-redesigned-checkout-flow-with-saved-cards-and-wallets",
    percyBuildUrl: "https://percy.io/org/mobile-web/builds/48199120",
    baseline: { label: "Baseline", environment: "Prod" },
    target: { label: "Target", environment: "Stage" },
    findings: [],
    history: [],
  },
];

export function getReport(buildId: string): Report | undefined {
  return reports.find((r) => r.buildId === buildId);
}
