export type Classification = "likely_bug" | "not_bug" | "not_classified";

export type ReportStatus = "processing" | "ready";

export interface Finding {
  id: string;
  snapshotName: string;
  pageUrl?: string;
  category: string;
  classification: Classification;
  /** Short explanation supplied by the Percy AI Review Agent. */
  description: string;
  /** Percentage of the snapshot that differs, as reported by Percy. */
  diffPercent?: number;
  /** Browser and width the snapshot was captured at. */
  browser?: string;
  width?: number;
  /** Captured Percy screenshots, not live pages. */
  baselineImage?: string;
  targetImage?: string;
}

/** One past build, used for the history chart. */
export interface BuildHistoryEntry {
  label: string;
  likelyBugs: number;
  notBugs: number;
  notClassified: number;
}

export interface Report {
  buildId: string;
  project: string;
  status: ReportStatus;
  generatedAt: string;
  branch: string;
  commit?: string;
  author?: string;
  percyBuildUrl: string;
  baseline: { label: string; environment: string };
  target: { label: string; environment: string };
  findings: Finding[];
  history: BuildHistoryEntry[];
}
