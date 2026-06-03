const proofPoints = [
  { label: "Live agents", value: "Always-on", copy: "See agent status, conversations, approvals, and bottlenecks in one operational surface." },
  { label: "Workspaces", value: "Context-aware", copy: "Projects connect goals, knowledge, routines, files, and execution history without duplicate noise." },
  { label: "Governance", value: "Auditable", copy: "Every decision, task handoff, and human-in-the-loop approval stays traceable." },
];

const capabilities = [
  "Agent command center with live conversations",
  "Project/workspace context mapped to actual operations",
  "Task board ownership for humans and agents",
  "Approval gates, audit logs, cost telemetry, and routines",
];

export function LandingPage() {
  return (
    <main className="landing-page">
      <nav className="landing-nav" aria-label="Landing navigation">
        <a className="landing-brand" href="/" aria-label="Hermes Mission Control home">
          <span className="brand-mark">M</span>
          <span>
            <strong>Melverick OS</strong>
            <small>Hermes Mission Control</small>
          </span>
        </a>
        <div className="landing-nav-actions">
          <a href="/mission-control-docs">Docs</a>
          <a className="landing-login-link" href="/login">Login</a>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="hero-copy">
          <div className="eyebrow"><span /> Operator-grade AI workforce control</div>
          <h1>Run your digital coworkers from one professional command center.</h1>
          <p>
            Mission Control turns agents, projects, tasks, knowledge, and approvals into a single execution layer — built for accountable work, not chatbot sprawl.
          </p>
          <div className="hero-actions">
            <a className="primary-cta" href="/login">Login to Mission Control</a>
            <a className="secondary-cta" href="/app">Open dashboard</a>
          </div>
          <div className="trust-strip" aria-label="Platform qualities">
            <span>Secure access</span>
            <span>Live telemetry</span>
            <span>Human approvals</span>
          </div>
        </div>

        <div className="hero-panel" aria-label="Mission Control preview">
          <div className="panel-topbar">
            <span className="window-dot red" />
            <span className="window-dot amber" />
            <span className="window-dot green" />
            <small>mission-control / live</small>
          </div>
          <div className="ops-preview-grid">
            <div className="ops-card main-card">
              <small>Active goal</small>
              <strong>Agentic AI course lead generation</strong>
              <p>LinkedIn, website leads, and follow-up workflows coordinated with human approval gates.</p>
              <div className="progress"><i style={{ width: "68%" }} /></div>
            </div>
            <div className="ops-card">
              <small>Agents</small>
              <strong>8 online</strong>
              <span className="status-line good">4 executing · 2 waiting · 2 idle</span>
            </div>
            <div className="ops-card">
              <small>Approval Gates</small>
              <strong>3 pending</strong>
              <span className="status-line warn">Needs Melverick decision</span>
            </div>
            <div className="ops-feed">
              <div><b>Melkizac</b><span>Updated task ownership on lead funnel.</span></div>
              <div><b>Content Ops</b><span>Prepared LinkedIn post angle for approval.</span></div>
              <div><b>Second Brain</b><span>Linked project context to source notes.</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-proof" aria-label="Mission Control highlights">
        {proofPoints.map((item) => (
          <article key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.copy}</p>
          </article>
        ))}
      </section>

      <section className="landing-capabilities">
        <div>
          <span className="section-kicker">Built for operators</span>
          <h2>From AI chat to governed execution.</h2>
        </div>
        <ul>
          {capabilities.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>
    </main>
  );
}
