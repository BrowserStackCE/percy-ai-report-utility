import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import { router } from "./router";
import { AuthProvider } from "./auth/AuthProvider";
import { ProjectsProvider } from "./api/projects/ProjectsProvider";
import { SelectedProjectProvider } from "./api/projects/SelectedProjectProvider";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <ProjectsProvider>
        <SelectedProjectProvider>
          <RouterProvider router={router} />
        </SelectedProjectProvider>
      </ProjectsProvider>
    </AuthProvider>
  </StrictMode>,
);
