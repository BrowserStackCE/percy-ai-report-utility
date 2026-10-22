import { createBrowserRouter } from "react-router";
import Layout from "./components/shell/Layout";
import Home from "./pages/Home";
import ReportLayout from "./pages/report/ReportLayout";
import InsightsTab from "./pages/report/InsightsTab";
import FindingsTab from "./pages/report/FindingsTab";
import ComparisonPage from "./pages/ComparisonPage";
import NotFound from "./pages/NotFound";
import ComingSoon from "./pages/ComingSoon";
import Login from "./pages/Login";
import Projects from "./pages/Projects";
import AuthCallback from "./pages/AuthCallback";

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <Home /> },
      {
        path: "/reports/:buildId",
        element: <ReportLayout />,
        children: [
          { index: true, element: <InsightsTab /> },
          { path: "findings", element: <FindingsTab /> },
        ],
      },
      { path: "/reports/:buildId/findings/:findingId", element: <ComparisonPage /> },
      { path: "/projects", element: <Projects /> },
      { path: "/login", element: <Login /> },
      { path: "/auth/callback", element: <AuthCallback /> },
      { path: "/settings", element: <ComingSoon title="Settings" /> },
      { path: "/ai-features", element: <ComingSoon title="AI features" /> },

      { path: "*", element: <NotFound /> },
    ],
  },
]);
