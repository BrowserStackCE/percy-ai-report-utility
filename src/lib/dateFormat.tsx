import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

const STORAGE_KEY = "percy_report_timezone";

export interface TimeZoneOption {
  /** IANA zone id, or "local" for the browser's own zone. */
  value: string;
  label: string;
  /** Short name shown next to times, for example "IST". */
  short: string;
}

/** Zones offered in the picker. IST is the default. */
export const TIME_ZONES: TimeZoneOption[] = [
  { value: "Asia/Kolkata", label: "India (IST, UTC+05:30)", short: "IST" },
  { value: "UTC", label: "Coordinated Universal Time (UTC)", short: "UTC" },
  { value: "local", label: "Browser local time", short: "Local" },
  { value: "America/Los_Angeles", label: "US Pacific (PT)", short: "PT" },
  { value: "America/New_York", label: "US Eastern (ET)", short: "ET" },
  { value: "Europe/London", label: "London (GMT/BST)", short: "UK" },
  { value: "Europe/Berlin", label: "Central Europe (CET/CEST)", short: "CET" },
  { value: "Asia/Dubai", label: "Dubai (GST, UTC+04:00)", short: "GST" },
  { value: "Asia/Singapore", label: "Singapore (SGT, UTC+08:00)", short: "SGT" },
  { value: "Asia/Tokyo", label: "Tokyo (JST, UTC+09:00)", short: "JST" },
  { value: "Australia/Sydney", label: "Sydney (AEST/AEDT)", short: "AET" },
];

export const DEFAULT_TIME_ZONE = "Asia/Kolkata";

function isKnownZone(value: string | null): value is string {
  return value !== null && TIME_ZONES.some((z) => z.value === value);
}

function readStored(): string {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return isKnownZone(v) ? v : DEFAULT_TIME_ZONE;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

/**
 * Format an ISO timestamp in the given zone on a 12-hour clock, for example "30 Sep 2026, 08:24:32 PM IST".
 * Returns "—" for empty or unparsable input. "local" uses the browser's own zone.
 */
export function formatInZone(iso: string | null, zone: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const option = TIME_ZONES.find((z) => z.value === zone);
  const timeZone = zone === "local" ? undefined : zone;
  const text = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone,
  }).format(d);
  // en-GB renders the 12-hour marker as "am"/"pm"; show it upper-case for readability.
  return `${text.replace(/\b(am|pm)\b/, (m) => m.toUpperCase())} ${option?.short ?? zone}`;
}

/** Date only, for example "30 Sep 2026", in the given zone. */
export function formatDateInZone(iso: string | null, zone: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: zone === "local" ? undefined : zone,
  }).format(d);
}

interface DateFormatValue {
  zone: string;
  setZone: (zone: string) => void;
  option: TimeZoneOption;
  /** Date and time in the chosen zone. */
  formatDateTime: (iso: string | null) => string;
  /** Date only in the chosen zone. */
  formatDate: (iso: string | null) => string;
}

const DateFormatContext = createContext<DateFormatValue | null>(null);

/** Holds the user's chosen display zone (IST by default) and remembers it across visits. */
export function DateFormatProvider({ children }: { children: ReactNode }) {
  const [zone, setZoneState] = useState<string>(() => readStored());

  const setZone = useCallback((next: string) => {
    if (!isKnownZone(next)) return;
    setZoneState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable: the choice just won't persist */
    }
  }, []);

  const value = useMemo<DateFormatValue>(
    () => ({
      zone,
      setZone,
      option: TIME_ZONES.find((z) => z.value === zone) ?? TIME_ZONES[0],
      formatDateTime: (iso) => formatInZone(iso, zone),
      formatDate: (iso) => formatDateInZone(iso, zone),
    }),
    [zone, setZone],
  );

  return <DateFormatContext.Provider value={value}>{children}</DateFormatContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDateFormat(): DateFormatValue {
  const ctx = useContext(DateFormatContext);
  if (!ctx) throw new Error("useDateFormat must be used inside <DateFormatProvider>");
  return ctx;
}
