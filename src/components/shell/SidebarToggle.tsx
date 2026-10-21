import { IconButton } from "../ui/Button";
import { HamburgerIcon } from "../ui/HamburgerIcon";
import { useSidebar } from "./sidebarContext";

/**
 * Hamburger button. Takes no props: it reads and flips the sidebar state itself, so it can be
 * placed in any bar without wiring. The icon is a hamburger while the sidebar is closed
 * (collapsed rail) and morphs to an X while it is open.
 */
export default function SidebarToggle() {
  const { collapsed, toggle } = useSidebar();
  return (
    <IconButton
      label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-expanded={!collapsed}
      aria-controls="app-sidebar"
      onClick={toggle}
    >
      <HamburgerIcon open={!collapsed} />
    </IconButton>
  );
}
