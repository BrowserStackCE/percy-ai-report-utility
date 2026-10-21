import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 18, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const ChevronDown = (p: IconProps) => <Icon {...p}><path d="m6 9 6 6 6-6" /></Icon>;
export const ChevronUp = (p: IconProps) => <Icon {...p}><path d="m18 15-6-6-6 6" /></Icon>;
export const ChevronsUpDown = (p: IconProps) => <Icon {...p}><path d="m7 15 5 5 5-5M7 9l5-5 5 5" /></Icon>;
export const ChevronRight = (p: IconProps) => <Icon {...p}><path d="m9 18 6-6-6-6" /></Icon>;
export const ChevronLeft = (p: IconProps) => <Icon {...p}><path d="m15 18-6-6 6-6" /></Icon>;
export const ArrowLeft = (p: IconProps) => <Icon {...p}><path d="M19 12H5M12 19l-7-7 7-7" /></Icon>;
export const Check = (p: IconProps) => <Icon {...p}><path d="m5 12 5 5L20 7" /></Icon>;
export const Search = (p: IconProps) => <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Icon>;
export const Filter = (p: IconProps) => <Icon {...p}><path d="M3 5h18l-7 8v6l-4-2v-4z" /></Icon>;
export const Sort = (p: IconProps) => <Icon {...p}><path d="M4 7h16M7 12h10M10 17h4" /></Icon>;
export const Info = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></Icon>;
export const Cube = (p: IconProps) => <Icon {...p}><path d="M12 3 4 7v10l8 4 8-4V7zM4 7l8 4 8-4M12 11v10" /></Icon>;
export const Puzzle = (p: IconProps) => <Icon {...p}><path d="M10 4a2 2 0 1 1 4 0v2h4v4h-2a2 2 0 1 0 0 4h2v4h-4v-2a2 2 0 1 0-4 0v2H6v-4h2a2 2 0 1 0 0-4H6V6h4z" /></Icon>;
export const Settings = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></Icon>;
export const Spark = (p: IconProps) => <Icon {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></Icon>;
export const Pulse = (p: IconProps) => <Icon {...p}><path d="M3 12h4l3-7 4 14 3-7h4" /></Icon>;
export const User = (p: IconProps) => <Icon {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Icon>;
export const Layers = (p: IconProps) => <Icon {...p}><path d="m12 3 9 5-9 5-9-5zM3 13l9 5 9-5" /></Icon>;
export const Download = (p: IconProps) => <Icon {...p}><path d="M12 4v11M7 11l5 5 5-5M5 20h14" /></Icon>;
export const External = (p: IconProps) => <Icon {...p}><path d="M14 4h6v6M20 4l-9 9M18 14v5H5V6h5" /></Icon>;
export const ColumnsSplit = (p: IconProps) => <Icon {...p}><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M12 5v14" /></Icon>;
export const Chat = (p: IconProps) => <Icon {...p}><path d="M5 5h14v10H10l-5 4z" /></Icon>;
export const Bug = (p: IconProps) => <Icon {...p}><rect x="8" y="8" width="8" height="11" rx="4" /><path d="M9 6a3 3 0 0 1 6 0M4 12h4M16 12h4M5 18l3-2M19 18l-3-2M5 7l3 2M19 7l-3 2" /></Icon>;
export const Close = (p: IconProps) => <Icon {...p}><path d="M6 6l12 12M18 6 6 18" /></Icon>;
export const Menu = (p: IconProps) => <Icon {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Icon>;
