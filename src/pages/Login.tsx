import { useState } from "react";
import { useSearchParams } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { AuthError, validateBrowserStack, validatePercyToken } from "../auth/percyAuth";
import { Button, Card, TextField } from "../components/ui";

type Result = { ok: boolean; text: string; hint?: string };

function toResult(err: unknown): Result {
  if (err instanceof AuthError) return { ok: false, text: err.message, hint: err.hint };
  return { ok: false, text: "Something went wrong while validating." };
}

export default function Login() {
  const { save, signOut, hasPercy, hasBrowserStack, isAuthenticated, credentials } = useAuth();
  const [params] = useSearchParams();
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [tokenResult, setTokenResult] = useState<Result | null>(null);
  const [bsResult, setBsResult] = useState<Result | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setTokenResult(null);
    setBsResult(null);
    if (token.trim()) {
      try {
        await validatePercyToken(token.trim());
        save({ percyToken: token.trim() });
        setTokenResult({ ok: true, text: "Percy token verified." });
        setToken("");
      } catch (err) {
        setTokenResult(toResult(err));
      }
    }
    if (username.trim() || accessKey.trim()) {
      if (!username.trim() || !accessKey.trim()) {
        setBsResult({ ok: false, text: "Enter both the BrowserStack username and access key." });
      } else {
        try {
          await validateBrowserStack(username.trim(), accessKey.trim());
          save({ username: username.trim(), accessKey: accessKey.trim() });
          setBsResult({ ok: true, text: "BrowserStack credentials verified." });
          setUsername("");
          setAccessKey("");
        } catch (err) {
          setBsResult(toResult(err));
        }
      }
    }
    setBusy(false);
  };

  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="text-xl font-semibold text-ink-900">Authenticate</h1>
      <p className="mt-1 text-sm text-ink-500">
        Sign in with a Percy project token and/or BrowserStack credentials. You can also run{" "}
        <code>percy-report login</code> in your terminal.
      </p>

      {params.get("error") === "callback" && (
        <p role="alert" className="mt-4 text-sm text-red-600">The link from the terminal was invalid. Run the CLI again or sign in below.</p>
      )}

      <Card className="mt-4 p-4">
        <p className="text-sm font-medium text-ink-900" role="status">
          {isAuthenticated ? "✔ Authenticated" : "Not authenticated"}
        </p>
        <ul className="mt-2 text-sm text-ink-700">
          <li>Percy token: {hasPercy ? "✔ connected" : "— not set"}</li>
          <li>BrowserStack: {hasBrowserStack ? `✔ connected as ${credentials.username}` : "— not set"}</li>
        </ul>
        {isAuthenticated && (
          <Button className="mt-3" onClick={signOut}>Sign out</Button>
        )}
      </Card>

      <form onSubmit={submit} className="mt-4 space-y-4">
        <TextField label="Percy token" type="password" autoComplete="off" value={token} onChange={setToken} />
        <Feedback r={tokenResult} />
        <TextField label="BrowserStack username" value={username} onChange={setUsername} autoComplete="off" />
        <TextField label="BrowserStack access key" type="password" value={accessKey} onChange={setAccessKey} autoComplete="off" />
        <Feedback r={bsResult} />
        <Button type="submit" variant="primary" disabled={busy || (!token && !username && !accessKey)}>
          {busy ? "Validating…" : "Authenticate"}
        </Button>
      </form>
    </div>
  );
}

function Feedback({ r }: { r: Result | null }) {
  if (!r) return null;
  return (
    <p role={r.ok ? "status" : "alert"} className={r.ok ? "text-sm text-green-700" : "text-sm text-red-600"}>
      {r.text}
      {r.hint && <span className="block text-ink-500">{r.hint}</span>}
    </p>
  );
}
