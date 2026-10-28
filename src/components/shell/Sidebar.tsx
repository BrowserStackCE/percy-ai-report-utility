import type { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router";
import logo from "../../assets/logo.png";
import SidebarToggle from "./SidebarToggle";
import { FileText, Folder, Pulse } from "../ui/Icons";
import { useProjects } from "../../api/projects/useProjects";
import { useSelectedProject } from "../../api/projects/SelectedProjectProvider";
import { projectsForProduct, useProduct, type Product } from "../../api/projects/ProductProvider";
import { Select } from "../ui/Select";
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
  const { projects: loaded, scope } = useProjects();
  const { projectId: project, setProjectId: setProject } = useSelectedProject();
  const { product: chosen, setProduct } = useProduct();
  const navigate = useNavigate();
  // A single-kind token only ever sees one product, so there is nothing to switch between.
  const product: Product = scope === "web" || scope === "app" ? scope : chosen;
  const projects = projectsForProduct(loaded, product).map((p) => ({ value: p.id, label: p.name }));

  function pickProduct(next: Product) {
    setProduct(next);
    // The open project may belong to the other product; clear it rather than show a mismatched one.
    const current = loaded.find((p) => p.id === project);
    if (current && current.kind !== "unknown" && current.kind !== next) setProject("");
  }

  return (
    <aside
      id="app-sidebar"
      aria-label="Sidebar"
      className={cn(
        "flex h-full shrink-0 flex-col overflow-hidden rounded-xl border border-line bg-card transition-[width]",
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
        {scope === "both" && (
          <div role="group" aria-label="Product" className="mb-3 flex w-56 rounded-lg border border-line-strong bg-card p-0.5">
            {(["web", "app"] as const).map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={product === p}
                onClick={() => pickProduct(p)}
                className={cn(
                  "h-8 flex-1 rounded-md text-sm font-medium transition-colors",
                  product === p ? "bg-brand-50 text-brand-700" : "text-ink-700 hover:bg-chip",
                )}
              >
                {p === "web" ? "Web" : "App"}
              </button>
            ))}
          </div>
        )}
        <Eyebrow>{product === "web" ? "Web project" : "App project"}</Eyebrow>
        <div className="mt-2 w-56">
          <Select
            value={project}
            options={projects}
            onChange={(id) => {
              setProject(id);
              navigate("/");
            }}
            ariaLabel="Project"
            placeholder={`Select ${product} project`}
            searchable
            searchPlaceholder="Search projects"
          />
        </div>
      </div>

      <nav aria-label="Primary" className={cn("flex-1 p-3", !collapsed && "border-t border-line p-4")}>
        <div className="space-y-0.5">
          <SidebarNavItem to="/projects" icon={<Folder size={18} />} label="Projects" />
          <SidebarNavItem to="/" end icon={<FileText size={18} />} label="Reports" />
          <SidebarNavItem to="/analytics" icon={<Pulse size={18} />} label="Analytics" />
        </div>
      </nav>
    </aside>
  );
}