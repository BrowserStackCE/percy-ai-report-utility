import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { ApiError, isApiError } from "../errors";
import { authFromCredentials } from "../http";
import { fetchSnapshot } from "./snapshotsApi";
import type { Snapshot } from "./types";

export interface SnapshotState {
  status: "loading" | "ready" | "error";
  snapshot: Snapshot | null;
  error: ApiError | null;
  reload: () => void;
}

/** One snapshot with all of its comparisons (GET /snapshots/:id). */
export function useSnapshot(snapshotId: string): SnapshotState {
  const { credentials } = useAuth();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [status, setStatus] = useState<SnapshotState["status"]>("loading");
  const [error, setError] = useState<ApiError | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!snapshotId) {
      setSnapshot(null);
      setError(null);
      setStatus("loading");
      return;
    }
    const auth = authFromCredentials(credentials);
    if (!auth) {
      setSnapshot(null);
      setStatus("error");
      setError(new ApiError("not_authenticated", "You are not signed in.", { hint: "Sign in to see this snapshot." }));
      return;
    }
    const controller = new AbortController();
    setStatus("loading");
    setError(null);
    fetchSnapshot(snapshotId, { auth, signal: controller.signal })
      .then((s) => {
        setSnapshot(s);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setSnapshot(null);
        setError(isApiError(err) ? err : new ApiError("unexpected", "Something went wrong while loading the snapshot."));
        setStatus("error");
      });
    return () => controller.abort();
  }, [credentials, snapshotId, nonce]);

  return { status, snapshot, error, reload };
}
