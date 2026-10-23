import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import { router } from "./router";
import { AuthProvider } from "./auth/AuthProvider";
import { ProjectsProvider } from "./api/projects/ProjectsProvider";
import { SelectedProjectProvider } from "./api/projects/SelectedProjectProvider";
import { DateFormatProvider } from "./lib/dateFormat";
import { ThemeProvider } from "./lib/theme";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <ProjectsProvider>
          <SelectedProjectProvider>
            <DateFormatProvider>
              <RouterProvider router={router} />
            </DateFormatProvider>
          </SelectedProjectProvider>
        </ProjectsProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);
