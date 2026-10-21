import type { ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "./cn";

interface SnapshotCardProps {
  to: string;
  title: string;
  selected?: boolean;
  /** Image URL of the captured screenshot. A neutral block is shown when absent. */
  image?: string;
  /** Overlay shown at the top right of the thumbnail, for example a comment count. */
  badge?: ReactNode;
}

/** Thumbnail card for the snapshot list: mint border, tinted when selected. */
export function SnapshotCard({ to, title, selected, image, badge }: SnapshotCardProps) {
  return (
    <Link
      to={to}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "block rounded-xl border p-2 transition-colors",
        selected ? "border-mint-300 bg-mint-50" : "border-mint-300/60 bg-white hover:bg-mint-50/50",
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-line bg-surface">
        {image && <img src={image} alt="" className="h-full w-full object-cover object-top" />}
        {badge && <div className="absolute right-2 top-2">{badge}</div>}
      </div>
      <p className="mt-2 truncate px-1 text-sm font-semibold text-ink-900">{title}</p>
    </Link>
  );
}
