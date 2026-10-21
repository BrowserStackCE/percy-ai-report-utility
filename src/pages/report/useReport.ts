import { useOutletContext } from "react-router";
import type { Report } from "../../types";

export interface ReportContext {
  report: Report;
}

/** The report loaded by ReportLayout, available to every report tab. */
export function useReport(): Report {
  return useOutletContext<ReportContext>().report;
}
