import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { useStore } from "../../services/store";
import type { ViewKey } from "../../types";

interface AdminDashboardSummary {
  ok: boolean;
  gateway: { ok: boolean; process_running: boolean; api_ok: boolean; label: string; error?: string };
  users: { active: number; total: number; workspaces: number };
  runtimes: { running: number; total: number };
  delivery: { active: number; failed_24h: number; last_updated_at?: string | null };
  approvals: { pending: number; high_risk: number };
  attention: string[];
  generated_at: string;
}

interface AdminArea {
  eyebrow: string;
  title: string;
  detail: string;
  status: string;
  statusTone: "good" | "warn" | "bad";
  icon: Parameters<typeof Icon>[0]["name"];
  primary: { label: string; view: ViewKey };
  secondary?: { label: string; view: ViewKey };
}

const advancedTools: Array<{ label: string; detail: string; view: ViewKey }> = [
  { label: "Shared Agent Templates", detail: "Reusable agent blueprints", view: "shared-agent-templates" },
  { label: "Platform Agent Org", detail: "Agent classes and policy domains", view: "agent-platform-admin" },
  { label: "Workflow Templates", detail: "Reusable execution patterns", view: "workflow-library" },
  { label: "Research Monitor", detail: "Long-running research activity", view: "research-runs" },
  { label: "Capabilities", detail: "Tools, permissions, and evidence", view: "capabilities" },
  { label: "Routine Governance", detail: "Scheduled automation controls", view: "automations" },
  { label: "Costs & Usage", detail: "Spend and token evidence", view: "costs" },
  { label: "Quota & Limits", detail: "Capacity and usage guardrails", view: "quota" },
];

async function requestDashboard(): Promise<AdminDashboardSummary> {
  const response = await fetch(`${window.location.protocol}//${window.location.host}/api/admin/dashboard`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("Unable to load ADMIN status");
  return response.json() as Promise<AdminDashboardSummary>;
}

export function AdminDashboardPane() {
  const { setView } = useStore();
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadHealth() {
    setError(null);
    setLoading(true);
    try {
      setSummary(await requestDashboard());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load ADMIN status");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadHealth();
    const interval = window.setInterval(() => void loadHealth(), 60000);
    return () => window.clearInterval(interval);
  }, []);

  const primaryAreas = useMemo<AdminArea[]>(() => {
    const gatewayOk = Boolean(summary?.gateway.ok);
    const runtimeIssue = Boolean(summary?.runtimes.total && summary.runtimes.running < summary.runtimes.total);
    const failedDeliveries = summary?.delivery.failed_24h ?? 0;
    const pendingApprovals = summary?.approvals.pending ?? 0;
    const highRiskApprovals = summary?.approvals.high_risk ?? 0;

    return [
      {
        eyebrow: "COMMUNICATION",
        title: "System Status",
        detail: summary?.gateway.label ?? "Checking Hermes communication services.",
        status: failedDeliveries ? `${failedDeliveries} failed ${failedDeliveries === 1 ? "delivery" : "deliveries"} in 24h` : gatewayOk ? "Communication online" : "Status unavailable",
        statusTone: failedDeliveries ? "bad" : gatewayOk ? "good" : "warn",
        icon: "dashboard",
        primary: { label: "Open runtime connectors", view: "runtimes" },
      },
      {
        eyebrow: "EXECUTION",
        title: "Agents & Runtimes",
        detail: "Supervise agent assignments, runtime isolation, and connection health.",
        status: summary ? `${summary.runtimes.running}/${summary.runtimes.total} runtimes running` : "Runtime status unavailable",
        statusTone: runtimeIssue ? "warn" : summary ? "good" : "warn",
        icon: "runtimes",
        primary: { label: "Open agents & runtimes", view: "workspace-runtime-console" },
      },
      {
        eyebrow: "IDENTITY",
        title: "Users & Access",
        detail: "Manage accounts, roles, workspaces, sessions, and access recovery.",
        status: summary ? `${summary.users.active}/${summary.users.total} users active · ${summary.users.workspaces} workspaces` : "Access status unavailable",
        statusTone: summary ? "good" : "warn",
        icon: "profile",
        primary: { label: "Open users & access", view: "users-workspaces" },
      },
      {
        eyebrow: "GOVERNANCE",
        title: "Safety & Activity",
        detail: "Review approval boundaries, recent failures, retries, and audit evidence.",
        status: highRiskApprovals ? `${highRiskApprovals} high-risk approvals` : pendingApprovals ? `${pendingApprovals} approvals waiting` : "No approvals waiting",
        statusTone: highRiskApprovals ? "bad" : pendingApprovals ? "warn" : "good",
        icon: "approvals",
        primary: { label: "Open safety rules", view: "approval-policy" },
        secondary: { label: "View activity", view: "audit" },
      },
    ];
  }, [summary]);

  const needsAttention = Boolean(error || summary?.attention.length);
  const healthTitle = loading ? "Checking essential services…" : error ? "ADMIN status unavailable" : needsAttention ? "Some items need attention" : "Essential services are operational";
  const healthDetail = error
    ? "Refresh the status before changing access, runtimes, or policies."
    : summary?.delivery.active
      ? `${summary.delivery.active} chat request${summary.delivery.active === 1 ? " is" : "s are"} currently processing.`
      : "Hermes communication, access, and runtime status are backed by live server data.";

  return (
    <div className="admin-pane admin-dashboard-essential">
      <header className="admin-pane-header">
        <div>
          <span className="stub-tag">ADMIN CONSOLE</span>
          <h1>Essential controls</h1>
          <p>Check communication health, recover agents, manage access, and review safety issues.</p>
        </div>
        <button className="task-icon-action dark" aria-label="Refresh ADMIN status" title="Refresh" onClick={() => void loadHealth()} disabled={loading}>
          <Icon name={loading ? "spinner" : "refresh"} size={18} className={loading ? "admin-refresh-spinner" : undefined} />
        </button>
      </header>

      <section className={`admin-health-summary ${needsAttention ? "warn" : "good"}`} aria-live="polite">
        <span className="admin-health-icon"><Icon name={needsAttention ? "admin" : "check"} size={20} /></span>
        <div>
          <b>{healthTitle}</b>
          <p>{healthDetail}</p>
        </div>
        {!loading && error && <button className="btn ghost small" onClick={() => void loadHealth()}>Retry</button>}
      </section>

      <section className="admin-primary-grid" aria-label="Essential ADMIN areas">
        {primaryAreas.map((area) => (
          <article className="admin-primary-card" key={area.title}>
            <div className="admin-primary-card-head">
              <span className="admin-primary-card-icon"><Icon name={area.icon} size={20} /></span>
              <span>{area.eyebrow}</span>
            </div>
            <div className="admin-primary-card-copy">
              <h2>{area.title}</h2>
              <p>{area.detail}</p>
            </div>
            <div className={`admin-primary-status ${area.statusTone}`}><span />{loading ? "Checking…" : area.status}</div>
            <div className="admin-primary-actions">
              <button className="btn dark small" onClick={() => setView(area.primary.view)}>{area.primary.label}</button>
              {area.secondary && <button className="btn ghost small" onClick={() => setView(area.secondary!.view)}>{area.secondary.label}</button>}
            </div>
          </article>
        ))}
      </section>

      <details className="admin-advanced-tools">
        <summary>
          <span><b>Advanced administration</b><small>Templates, capability governance, research, routines, costs, and limits</small></span>
          <Icon name="chevronDown" size={16} />
        </summary>
        <div className="admin-advanced-grid">
          {advancedTools.map((tool) => (
            <button type="button" key={tool.view} onClick={() => setView(tool.view)}>
              <b>{tool.label}</b>
              <small>{tool.detail}</small>
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}
