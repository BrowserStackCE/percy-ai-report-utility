import type { ReactNode } from "react";
import { cn } from "./cn";

/** Standard page body: consistent padding and a readable max width for non-dashboard pages. */
export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-6xl space-y-6 px-6 py-6", className)}>{children}</div>;
}
