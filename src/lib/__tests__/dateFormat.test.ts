import { describe, expect, it } from "vitest";
import { DEFAULT_TIME_ZONE, TIME_ZONES, formatDateInZone, formatInZone } from "../dateFormat";

// 14:54:32 UTC is 20:24:32 in India (UTC+05:30), the time shown for build #3 in the app.
const ISO = "2026-09-30T14:54:32.000Z";

// Newer ICU versions (Node 22+) write "Sept", older ones "Sep"; accept both so the test is not tied to one runtime.
const SEP = "Sept?";

describe("formatInZone", () => {
  it("defaults to India time, shown with an IST suffix", () => {
    expect(DEFAULT_TIME_ZONE).toBe("Asia/Kolkata");
    expect(formatInZone(ISO, DEFAULT_TIME_ZONE)).toMatch(new RegExp(`^30 ${SEP} 2026, 20:24:32 IST$`));
  });

  it("switches to UTC", () => {
    expect(formatInZone(ISO, "UTC")).toMatch(new RegExp(`^30 ${SEP} 2026, 14:54:32 UTC$`));
  });

  it("applies other zones including their daylight-saving offset", () => {
    // 30 Sep is summer time in New York (UTC-4) and London (UTC+1).
    expect(formatInZone(ISO, "America/New_York")).toMatch(new RegExp(`^30 ${SEP} 2026, 10:54:32 ET$`));
    expect(formatInZone(ISO, "Europe/London")).toMatch(new RegExp(`^30 ${SEP} 2026, 15:54:32 UK$`));
  });

  it("rolls the calendar date over when the zone is on the next day", () => {
    // 20:30 UTC is already the next morning in India.
    expect(formatInZone("2026-09-30T20:30:00.000Z", "Asia/Kolkata")).toBe("01 Oct 2026, 02:00:00 IST");
  });

  it("returns a dash for empty or invalid input", () => {
    expect(formatInZone(null, "UTC")).toBe("—");
    expect(formatInZone("", "UTC")).toBe("—");
    expect(formatInZone("not a date", "UTC")).toBe("—");
  });

  it("formats in the browser zone for 'local' without throwing", () => {
    expect(formatInZone(ISO, "local")).toMatch(/2026.*Local$/);
  });
});

describe("formatDateInZone", () => {
  it("returns only the date in the chosen zone", () => {
    expect(formatDateInZone("2026-09-30T20:30:00.000Z", "UTC")).toMatch(new RegExp(`^30 ${SEP} 2026$`));
    expect(formatDateInZone("2026-09-30T20:30:00.000Z", "Asia/Kolkata")).toBe("01 Oct 2026");
  });

  it("returns a dash for empty or invalid input", () => {
    expect(formatDateInZone(null, "UTC")).toBe("—");
    expect(formatDateInZone("nope", "UTC")).toBe("—");
  });
});

describe("TIME_ZONES", () => {
  it("lists IST first, includes UTC, and has unique values", () => {
    expect(TIME_ZONES[0].value).toBe("Asia/Kolkata");
    expect(TIME_ZONES.some((z) => z.value === "UTC")).toBe(true);
    expect(new Set(TIME_ZONES.map((z) => z.value)).size).toBe(TIME_ZONES.length);
  });

  it("only lists zones the runtime can format", () => {
    for (const z of TIME_ZONES) {
      if (z.value === "local") continue;
      expect(() => new Intl.DateTimeFormat("en-GB", { timeZone: z.value })).not.toThrow();
    }
  });
});