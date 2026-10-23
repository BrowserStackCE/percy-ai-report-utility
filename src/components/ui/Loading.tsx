import type { ReactNode } from "react";
import logo from "../../assets/logo.png";
import { cn } from "./cn";

/** Grey shimmering placeholder block. Size and shape come from `className`. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("skeleton rounded-md", className)} />;
}

/** Several shimmering text lines, the last one shorter. */
export function SkeletonLines({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("space-y-2.5", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-3.5", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

interface LogoLoaderProps {
  /** Short caption under the logo, for example "Loading builds". */
  label?: string;
  className?: string;
}

/** Brand loader: the logo breathes inside an expanding ring, with a caption and pulsing dots. */
export function LogoLoader({ label = "Loading", className }: LogoLoaderProps) {
  return (
    <div role="status" aria-live="polite" className={cn("flex flex-col items-center justify-center gap-4 py-16", className)}>
      <div className="relative flex h-16 w-16 items-center justify-center">
        <span aria-hidden="true" className="logo-ring absolute inset-0 rounded-2xl bg-brand-300/40" />
        <span aria-hidden="true" className="logo-ring absolute inset-0 rounded-2xl bg-brand-300/30 [animation-delay:0.5s]" />
        <img src={logo} alt="" className="logo-breathe relative h-12 w-12 rounded-xl shadow-sm" />
      </div>
      <p className="sr-only">
        {label}
        <span aria-hidden="true" className="flex gap-0.5">
          <span className="logo-dot">.</span>
          <span className="logo-dot [animation-delay:0.2s]">.</span>
          <span className="logo-dot [animation-delay:0.4s]">.</span>
        </span>
      </p>
    </div>
  );
}

/**
 * Puts the brand loader on top of a skeleton. The skeleton keeps its place in the layout, so nothing
 * jumps; the loader floats centred above it on a soft backdrop.
 */
export function LoadingOverlay({ label, children, className }: { label?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      {children}
      <div className="absolute inset-0 z-10 flex items-start justify-center bg-page/50 pt-16 backdrop-blur-[1px]">
        <LogoLoader label={label} className="py-0" />
      </div>
    </div>
  );
}

/** Table-shaped placeholder: a header row and shimmering body rows. */
export function TableSkeleton({ rows = 6, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div role="status" aria-label="Loading" className="overflow-hidden rounded-xl border border-line bg-card">
      <div aria-hidden="true" className="flex gap-6 border-b border-line px-6 py-4">
        {Array.from({ length: cols }, (_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      <div aria-hidden="true" className="divide-y divide-line">
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex items-center gap-6 px-6 py-5">
            {Array.from({ length: cols }, (_, c) => (
              <div key={c} className="flex-1 space-y-2">
                <Skeleton className={cn("h-4", c === 0 ? "w-1/2" : "w-4/5")} />
                {c < 2 && <Skeleton className="h-3 w-2/3" />}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Card-shaped placeholder for stat cards and detail widgets. */
export function CardSkeleton({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("rounded-xl border border-line bg-card p-5", className)}>
      {children ?? (
        <>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-4 h-8 w-20" />
          <Skeleton className="mt-3 h-3 w-32" />
        </>
      )}
    </div>
  );
}