import { Outlet, useLocation } from "react-router";
import Breadcrumb from "./Breadcrumb";
import HotReloadButton from "./HotReloadButton";
import Sidebar from "./Sidebar";
import ThemeToggle from "./ThemeToggle";
import TimeZonePicker from "./TimeZonePicker";
import SidebarProvider from "./SidebarProvider";
import SidebarToggle from "./SidebarToggle";
import logo from "../../assets/logo.png";

/**
 * App shell: the sidebar (with the hamburger and brand at its top) and the content column are
 * separate rounded panels inset from the window edge with a gap. The content column stacks the
 * breadcrumb card above the page. Sidebar state lives in the provider.
 */
export default function Layout() {
  const location = useLocation();
  return (
    <SidebarProvider>
      <div className="flex h-screen flex-col bg-page">
        <div className="flex min-h-0 flex-1 gap-0 p-0 md:gap-3 md:p-3 lg:gap-4 lg:p-4">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col gap-0 md:gap-3 lg:gap-4">
            <div className="flex h-[64px] shrink-0 items-stretch gap-2 border-b border-line bg-card px-3 md:h-auto md:border-0 md:bg-transparent md:px-0">
              <div className="min-w-0 flex flex-1 items-center md:block">
                <div className="hidden md:block"><Breadcrumb /></div>
                <div className="flex items-center gap-2 md:hidden">
                  <SidebarToggle />
                  <img src={logo} alt="" className="h-7 w-7 rounded-lg" />
                  <span className="hidden text-sm font-semibold text-ink-900 xs:block">Percy AI Review</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1 md:gap-3 md:rounded-xl md:border md:border-line md:bg-card md:px-3">
                <div className="hidden sm:block"><HotReloadButton /></div>
                <TimeZonePicker />
                <ThemeToggle />
              </div>
            </div>
            <main className="min-h-0 flex-1 overflow-y-auto bg-page md:rounded-xl md:border md:border-line md:shadow-[var(--shadow-card)]">
              <div key={location.pathname} className="page-enter">
                <Outlet />
              </div>
            </main>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
