import { EmptyState } from "../components/ui";

/** Placeholder for sections that are part of the shell but not built yet. */
export default function ComingSoon({ title }: { title: string }) {
  return <EmptyState title={title} description="This section is not part of the skeleton yet." />;
}
