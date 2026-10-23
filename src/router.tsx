import { createBrowserRouter } from "react-router";
import Layout from "./components/shell/Layout";
import Home from "./pages/Home";
import BuildDetails from "./pages/BuildDetails";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Projects from "./pages/Projects";
import AuthCallback from "./pages/AuthCallback";
import LogoutCallback from "./pages/LogoutCallback";

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      // Builds of the project selected in the sidebar (or on the Projects page).
      { path: "/", element: <Home /> },
      // One build with all of its details.
      { path: "/reports/:buildId", element: <BuildDetails /> },
      { path: "/projects", element: <Projects /> },
      { path: "/login", element: <Login /> },
      { path: "/auth/callback", element: <AuthCallback /> },
      { path: "/auth/logout", element: <LogoutCallback /> },

      { path: "*", element: <NotFound /> },
    ],
  },
]);
