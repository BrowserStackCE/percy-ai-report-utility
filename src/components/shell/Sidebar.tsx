import type { ReactNode } from "react";
import { Link, NavLink } from "react-router";
import logo from "../../assets/logo.png";
import SidebarToggle from "./SidebarToggle";
import { Layers, Settings, Spark } from "../ui/Icons";
import { useProjects } from "../../api/projects/useProjects";
import { useSelectedProject } from "../../api/projects/SelectedProjectProvider";
import { Select } from "../ui/Select";
import { NewTag } from "../ui/Badge";
import { Eyebrow } from "../ui/Card";
import { cn } from "../ui/cn";
import { useSidebar } from "./sidebarContext";

interface NavItemProps {
  to: string;
  icon: ReactNode;
  label: string;
  end?: boolean;
  tag?: ReactNode;
}

/** Sidebar link. In the collapsed rail only the icon shows; the label stays as a tooltip and accessible name. */
function SidebarNavItem({ to, icon, label, end, tag }: NavItemProps) {
  const { collapsed } = useSidebar();
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
          isActive ? "bg-brand-50 text-brand-700" : "text-ink-700 hover:bg-chip",
        )
      }
    >
      <span className="shrink-0 text-ink-500">{icon}</span>
      <span className={cn("flex-1 truncate", collapsed && "sr-only")}>{label}</span>
      {!collapsed && tag}
    </NavLink>
  );
}

/** Navigation panel. Holds the hamburger and brand at the top; open and closed state comes from the sidebar context. */
export default function Sidebar() {
  const { collapsed } = useSidebar();
  const { projects: loaded } = useProjects();
  const { projectId: project, setProjectId: setProject } = useSelectedProject();
  const projects = loaded.map((p) => ({ value: p.id, label: p.name }));

  return (
    <aside
      id="app-sidebar"
      aria-label="Sidebar"
      className={cn(
        "flex h-full shrink-0 flex-col overflow-hidden rounded-xl border border-line bg-white transition-[width]",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* Hamburger and brand. In the collapsed rail only the hamburger shows. */}
      <div className={cn("flex h-14 shrink-0 items-center gap-2 px-3", collapsed && "justify-center")}>
        <SidebarToggle />
        {!collapsed && (
          <Link to="/" className="flex min-w-0 items-center gap-2" aria-label="Percy AI Review home">
            <img src={logo} alt="" className="h-7 w-7 shrink-0 rounded-md" />
            <span className="truncate text-[15px] font-semibold tracking-tight text-ink-900">Percy AI Review</span>
          </Link>
        )}
      </div>

      {/* The project picker needs room, so it is hidden in the collapsed rail. */}
      <div className={cn("border-t border-line p-4", collapsed && "hidden")}>
        <Eyebrow>Project</Eyebrow>
        <div className="mt-2 w-56">
          <Select
            value={project}
            options={projects}
            onChange={setProject}
            ariaLabel="Project"
            placeholder="Select project"
            searchable
            searchPlaceholder="Search projects"
          />
        </div>
      </div>

      <nav aria-label="Primary" className={cn("flex-1 p-3", !collapsed && "border-t border-line p-4")}>
        <div className="space-y-0.5">
          <SidebarNavItem to="/projects" icon={<Layers size={18} />} label="Projects" />
          <SidebarNavItem to="/" end icon={<Layers size={18} />} label="Reports" />
          <SidebarNavItem to="/settings" icon={<Settings size={18} />} label="Settings" />
          <SidebarNavItem to="/ai-features" icon={<Spark size={18} />} label="AI features" tag={<NewTag />} />
        </div>
      </nav>
    </aside>
  );
}