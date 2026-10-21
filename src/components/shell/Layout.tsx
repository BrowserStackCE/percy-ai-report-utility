import { Outlet, useLocation } from "react-router";
import Breadcrumb from "./Breadcrumb";
import Sidebar from "./Sidebar";
import SidebarProvider from "./SidebarProvider";

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
        <div className="flex min-h-0 flex-1 gap-4 p-4">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <Breadcrumb />
            <main className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-line bg-page">
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
