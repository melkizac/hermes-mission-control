import { FormEvent, useState } from "react";

export function LoginPage() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Login failed");
      const next = new URLSearchParams(window.location.search).get("next");
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";
      window.location.assign(safeNext);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-shell">
        <a className="login-brand" href="/" aria-label="Back to landing page">
          <span className="brand-mark">M</span>
          <span>
            <strong>Melverick OS</strong>
            <small>Secure Mission Control access</small>
          </span>
        </a>

        <div className="login-card">
          <div className="login-card-header">
            <span className="section-kicker">Authorized operators only</span>
            <h1>Login to Mission Control</h1>
            <p>Use your Mission Control credentials to access agents, projects, approvals, and audit history.</p>
          </div>

          <form onSubmit={submit} className="login-form">
            <label>
              <span>Username</span>
              <input
                name="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label>
              <span>Password</span>
              <input
                name="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                autoFocus
                required
              />
            </label>
            {error && <div className="login-error" role="alert">{error}</div>}
            <button className="primary-cta login-submit" type="submit" disabled={loading}>
              {loading ? "Checking credentials…" : "Login securely"}
            </button>
          </form>
        </div>

        <div className="login-assurance">
          <span>Encrypted HTTPS at the edge</span>
          <span>Session cookie access</span>
          <span>APIs remain authenticated</span>
        </div>
      </section>
      <aside className="login-visual" aria-hidden="true">
        <div className="login-orb one" />
        <div className="login-orb two" />
        <div className="login-terminal">
          <div><b>access</b><span>operator verified</span></div>
          <div><b>agents</b><span>ready</span></div>
          <div><b>audit</b><span>recording</span></div>
        </div>
      </aside>
    </main>
  );
}
