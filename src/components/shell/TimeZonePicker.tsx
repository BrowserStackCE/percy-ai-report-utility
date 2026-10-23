import { TIME_ZONES, useDateFormat } from "../../lib/dateFormat";
import { Select } from "../ui/Select";

/** Global date/time zone switch: every date in the app follows this choice (IST by default). */
export default function TimeZonePicker() {
  const { zone, setZone } = useDateFormat();
  const options = TIME_ZONES.map((z) => ({ value: z.value, label: z.label }));
  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-xs font-medium uppercase tracking-wider text-ink-500 sm:inline">Time zone</span>
      <div className="w-56">
        <Select value={zone} options={options} onChange={setZone} ariaLabel="Time zone" searchable searchPlaceholder="Search time zones" />
      </div>
    </div>
  );
}
