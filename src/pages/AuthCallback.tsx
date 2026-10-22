import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import type { StoredCredentials } from "../auth/cookies";

function decode(hash: string): StoredCredentials | null {
  const m = /^#d=([A-Za-z0-9_-]+)$/.exec(hash);
  if (!m) return null;
  try {
    const b64 = m[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
    const data = JSON.parse(json) as Record<string, unknown>;
    const out: StoredCredentials = {};
    if (typeof data.percyToken === "string" && data.percyToken) out.percyToken = data.percyToken;
    if (typeof data.username === "string" && typeof data.accessKey === "string" && data.username && data.accessKey) {
      out.username = data.username;
      out.accessKey = data.accessKey;
    }
    return out.percyToken || out.username ? out : null;
  } catch {
    return null;
  }
}

/** Receives credentials from the CLI via the URL fragment, stores them in a cookie and clears the URL. */
export default function AuthCallback() {
  const { save } = useAuth();
  const [done, setDone] = useState<"ok" | "invalid" | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const creds = decode(window.location.hash);
    window.history.replaceState(null, "", window.location.pathname);
    if (creds) save(creds);
    setDone(creds ? "ok" : "invalid");
  }, [save]);

  if (done === "ok") return <Navigate to="/" replace />;
  if (done === "invalid") return <Navigate to="/login?error=callback" replace />;
  return null;
}
