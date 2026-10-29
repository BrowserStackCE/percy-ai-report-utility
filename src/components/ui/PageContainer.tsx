import type { ReactNode } from "react";
import { cn } from "./cn";

/** Standard page body: consistent padding and a readable max width for non-dashboard pages. */
export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[72rem] space-y-5 px-4 py-5 sm:space-y-6 sm:px-7 sm:py-7 lg:px-8", className)}>{children}</div>;
}
