import { useEffect, useRef } from "react";
import { Navigate } from "react-router";
import { useAuth } from "../auth/AuthProvider";

/** Opened by `percy-report-utility logout`: clears the auth cookie, then goes to the login page. */
export default function LogoutCallback() {
  const { signOut } = useAuth();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    signOut();
  }, [signOut]);

  return <Navigate to="/login?signedOut=1" replace />;
}
