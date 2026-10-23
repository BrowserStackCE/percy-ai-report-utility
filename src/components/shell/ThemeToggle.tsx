import { useTheme } from "../../lib/theme";
import { Moon, Sun } from "../ui/Icons";

/** Light/dark switch for the whole app. The choice is remembered between visits. */
export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Switch to light theme" : "Switch to dark theme"}
      className="flex h-10 w-10 items-center justify-center rounded-lg border border-line-strong text-ink-700 hover:bg-surface"
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
