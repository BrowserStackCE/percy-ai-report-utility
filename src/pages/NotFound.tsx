import { Link } from "react-router";
import { EmptyState, buttonClass } from "../components/ui";

export default function NotFound({ message = "The page you are looking for does not exist." }: { message?: string }) {
  return (
    <EmptyState
      title="Not found"
      description={message}
      action={
        <Link to="/" className={buttonClass("primary")}>
          Back to reports
        </Link>
      }
    />
  );
}
