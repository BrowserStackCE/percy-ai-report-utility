// The hook lives with its provider so there is a single source of truth; this re-export keeps the
// import path stable for components.
export { useProjects, type ProjectsState } from "./ProjectsProvider";
