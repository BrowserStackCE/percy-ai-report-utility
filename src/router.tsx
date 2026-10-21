import { createBrowserRouter } from "react-router";
import Layout from "./components/shell/Layout";
import Home from "./pages/Home";
import ReportLayout from "./pages/report/ReportLayout";
import InsightsTab from "./pages/report/InsightsTab";
import FindingsTab from "./pages/report/FindingsTab";
import ComparisonPage from "./pages/ComparisonPage";
import NotFound from "./pages/NotFound";
import ComingSoon from "./pages/ComingSoon";

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
      { path: "/settings", element: <ComingSoon title="Settings" /> },
      { path: "/ai-features", element: <ComingSoon title="AI features" /> },

      { path: "*", element: <NotFound /> },
    ],
  },
]);
