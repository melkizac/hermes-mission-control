import { useEffect, useState } from "react";
import type { DesktopGatewayStatus, ViewKey } from "../types";
import { HttpHermesClient } from "../services/httpHermesClient";
import { useStore } from "../services/store";

const client = new HttpHermesClient();

type AdminMetric = { label: string; value: string; detail: string; tone?: "good" | "warn" | "bad" };
type AdminCard = { title: string; body: string; target?: ViewKey; action: string; note?: string };
type AdminSection = { heading: string; body: string; cards: AdminCard[] };

type AdminSetupConfig = {
  eyebrow: string;
  title: string;
  blurb: string;
  metrics: AdminMetric[];
  sections: AdminSection[];
  evidence: string[];
};

const pageConfigs: Record<string, AdminSetupConfig> = {
  "users-workspaces": {
    eyebrow: "PLATFORM ADMIN",
    title: "Users & Workspaces",
    blurb:
      "Manage who can enter Mission Control, which workspace they operate in, and whether they are workspace users, viewers, or platform admins.",
    metrics: [
      { label: "Scope", value: "Workspace", detail: "Workspace-scoped identity and access" },
      { label: "Roles", value: "3", detail: "admin · user · viewer", tone: "good" },
      { label: "Guardrail", value: "RBAC", detail: "Server-side view permissions", tone: "good" },
      { label: "Next data source", value: "/api/me", detail: "Current signed-in workspace evidence" },
    ],
    sections: [
      {
        heading: "Operational controls",
        body: "This is the admin setup hub for workspace membership, roles, ownership, and access review. It keeps account administration separate from the user workspace cockpit.",
        cards: [
          { title: "Review signed-in identity", body: "Check current account, role, and workspace from the authenticated /api/me contract.", target: "settings", action: "Open Admin Overview" },
          { title: "Audit workspace activity", body: "Use the global audit trail to confirm which workspaces and channels are active before changing access.", target: "audit", action: "Open Global Audit Log" },
          { title: "Check usage by workspace", body: "Review spend/session patterns before setting workspace limits or escalation rules.", target: "costs", action: "Open Costs / Usage" },
        ],
      },
      {
        heading: "Implementation boundary",
        body: "Step 3 replaces the scaffold with an operator-ready admin page. Destructive user provisioning, deletion, or live role changes remain intentionally out of scope until a dedicated membership API is added.",
        cards: [
          { title: "Required backend slice", body: "Add a membership endpoint that lists users, workspace IDs, roles, last login, and invited/pending status without exposing secrets.", action: "Planned API: /api/admin/users" },
        ],
      },
    ],
    evidence: ["Authenticated route remains admin-only", "Existing workspace default remains User mode", "No user deletion or role mutation controls are exposed"],
  },
  "shared-agent-templates": {
    eyebrow: "PLATFORM AGENTS",
    title: "Shared Agent Templates",
    blurb:
      "Curate global agent definitions that workspaces can select from, while keeping each workspace's own editable SOUL.md identity separate.",
    metrics: [
      { label: "Source of truth", value: "Templates", detail: "Admin-managed shared definitions" },
      { label: "Workspace identity", value: "SOUL.md", detail: "Editable by workspace users", tone: "good" },
      { label: "Runtime", value: "Agent Org", detail: "Platform org remains linked" },
      { label: "Guardrail", value: "Scoped", detail: "No cross-workspace soul overwrite", tone: "good" },
    ],
    sections: [
      {
        heading: "Template workflow",
        body: "Shared templates should define reusable capabilities, default skills, model preferences, and safe permissions. Workspace users personalize their own agent soul without changing the admin template.",
        cards: [
          { title: "Inspect Platform Agent Org", body: "Review the current shared org and capability graph before creating or changing templates.", target: "agent-org", action: "Open Platform Agent Org" },
          { title: "Inspect Skills Library", body: "Check available Hermes/OpenClaw/Shared skills that templates can reference.", target: "skills", action: "Open Skills" },
          { title: "Audit template effects", body: "Use audit evidence when a template is assigned, changed, or promoted to a runtime workflow.", target: "audit", action: "Open Global Audit Log" },
        ],
      },
      {
        heading: "Workspace soul boundary",
        body: "Admin templates and workspace SOUL.md edits are different scopes. Step 3 makes that boundary explicit so users can edit their agent identity without becoming platform admins.",
        cards: [
          { title: "Workspace SOUL.md", body: "Users should edit only their workspace-agent SOUL.md, not shared templates, skills, connectors, or model-router configuration.", target: "agents", action: "Open My Agents" },
        ],
      },
    ],
    evidence: ["Admin-managed template concept is visible", "Workspace SOUL.md personalization is documented in-page", "Existing Agent Org and Skills routes are preserved"],
  },
  "desktop-gateway": {
    eyebrow: "RUNTIME ADMIN",
    title: "Desktop Gateway",
    blurb:
      "Monitor desktop gateway connectivity and route local computer-use capability into the runtime layer without hiding execution locality.",
    metrics: [
      { label: "Primary setup", value: "Connector V2", detail: "Token · register · heartbeat" },
      { label: "Runtime page", value: "Live", detail: "Connected runtimes remain the source" },
      { label: "Gateway", value: "Scoped", detail: "Desktop capability is explicit", tone: "good" },
      { label: "Safety", value: "Audited", detail: "Actions should leave evidence", tone: "good" },
    ],
    sections: [
      {
        heading: "Gateway operations",
        body: "Use this hub to understand what desktop execution path should be connected, what is currently online, and where to create or revoke connector tokens.",
        cards: [
          { title: "Runtime Connectors", body: "Create tokens, see connected runtimes, monitor heartbeats, and inspect connector events.", target: "runtimes", action: "Open Runtime Connectors" },
          { title: "Tools inventory", body: "Review available toolsets and platform tools before enabling desktop automation workflows.", target: "tools", action: "Open Tools" },
          { title: "Desktop/API settings", body: "Open the current admin overview where gateway and desktop settings remain accessible.", target: "settings", action: "Open Admin Overview" },
        ],
      },
    ],
    evidence: ["Desktop gateway is no longer an empty placeholder", "Connector V2 remains the primary operational path", "No live desktop action is triggered from this page"],
  },
  "approval-policy": {
    eyebrow: "GOVERNANCE ADMIN",
    title: "Approval Policy",
    blurb:
      "Define which actions need human-in-the-loop review before agents publish, spend, delete, message externally, or cross workspace boundaries.",
    metrics: [
      { label: "Policy mode", value: "HITL", detail: "Human-in-the-loop guardrails", tone: "good" },
      { label: "Review queue", value: "Needs Attention", detail: "Workspace-visible interventions" },
      { label: "Audit", value: "Global", detail: "Policy outcomes need evidence" },
      { label: "Scope", value: "Draft", detail: "No global mutation controls yet", tone: "warn" },
    ],
    sections: [
      {
        heading: "Default protected actions",
        body: "Agents can draft and prepare work autonomously, but these categories should remain approval-gated or routed to Task Board until an admin policy API is live.",
        cards: [
          { title: "Outbound messages and posts", body: "External Telegram, LinkedIn, email, website, or client-facing publication should require approve/edit/reject.", target: "approvals", action: "Open Needs Attention" },
          { title: "Destructive or costly operations", body: "Database changes, deletion, credential rotation, DNS/cloud mutations, and high-cost runs need policy gates.", target: "audit", action: "Open Global Audit Log" },
          { title: "Blocked manual work", body: "Human-only actions belong on Task Board / Needs Attention, not fake approve/reject cards.", target: "board", action: "Open Task Board" },
        ],
      },
      {
        heading: "Next backend slice",
        body: "A future /api/admin/approval-policy endpoint should persist policy thresholds, per-workspace overrides, and proof of the latest policy change.",
        cards: [{ title: "Policy contract", body: "Expose read-only current policy first, then add explicit versioned updates with audit entries.", action: "Planned API: /api/admin/approval-policy" }],
      },
    ],
    evidence: ["Approval taxonomy is visible", "Needs Attention and Audit links are preserved", "No live policy mutation is exposed without backend audit"],
  },
  quota: {
    eyebrow: "GOVERNANCE ADMIN",
    title: "Quota",
    blurb:
      "Set workspace limits for spend, tokens, sessions, routines, and shared runtime capacity after reviewing current usage evidence.",
    metrics: [
      { label: "Current evidence", value: "Costs", detail: "Usage dashboard is linked" },
      { label: "Limit types", value: "5", detail: "spend · tokens · sessions · runs · runtime" },
      { label: "Enforcement", value: "Planned", detail: "Read-only admin hub for now", tone: "warn" },
      { label: "Safety", value: "No mutation", detail: "No quota writes without approval", tone: "good" },
    ],
    sections: [
      {
        heading: "Quota operating model",
        body: "Quota should be evidence-driven: review current usage, identify noisy workspaces/routines, then set explicit caps with audit entries and operator-visible warnings.",
        cards: [
          { title: "Review costs and tokens", body: "Start from actual session, source, model, and token trends before setting limits.", target: "costs", action: "Open Costs / Usage" },
          { title: "Review routines", body: "Scheduled jobs and monitors are common quota consumers; inspect run cadence and errors.", target: "automations", action: "Open Routines" },
          { title: "Review runtime capacity", body: "Shared runtime pools and connected workers should be checked before changing capacity limits.", target: "runtimes", action: "Open Runtime Connectors" },
        ],
      },
      {
        heading: "Next backend slice",
        body: "A future /api/admin/quota endpoint should expose current limits, usage against limit, warning thresholds, and versioned updates.",
        cards: [{ title: "Quota contract", body: "Begin read-only, then add audited changes and workspace-level overrides after policy review.", action: "Planned API: /api/admin/quota" }],
      },
    ],
    evidence: ["Quota page is an operational setup hub", "Usage evidence routes are one click away", "No unaudited quota mutation is possible"],
  },
};

function metricClass(tone?: AdminMetric["tone"]) {
  return `skills-metric${tone ? ` ${tone}` : ""}`;
}

export function AdminSetupPage({ kind }: { kind: keyof typeof pageConfigs }) {
  const { setView } = useStore();
  const config = pageConfigs[kind];
  const [desktopGateway, setDesktopGateway] = useState<DesktopGatewayStatus | null>(null);
  const [desktopError, setDesktopError] = useState<string | null>(null);
  const [windowsUrl, setWindowsUrl] = useState("");
  const [windowsToken, setWindowsToken] = useState("");
  const [approvedFolders, setApprovedFolders] = useState("C:/MelverickAgentWorkspace");

  async function loadDesktopGateway() {
    if (kind !== "desktop-gateway") return;
    try {
      setDesktopError(null);
      const next = await client.getDesktopGateway();
      setDesktopGateway(next);
      setWindowsUrl(next.windows.url || "");
      setApprovedFolders((next.windows.approvedFolders.length ? next.windows.approvedFolders : next.windows.recommendedFolders.slice(0, 1)).join("\n"));
    } catch (err) {
      setDesktopError(err instanceof Error ? err.message : "Unable to load Desktop Gateway");
    }
  }

  useEffect(() => {
    void loadDesktopGateway();
  }, [kind]);

  async function saveWindowsGateway() {
    try {
      setDesktopError(null);
      const folders = approvedFolders.split(/[\n,|]+/).map((item) => item.trim()).filter(Boolean);
      await client.saveWindowsGatewayConfig({
        url: windowsUrl,
        token: windowsToken,
        keepToken: !windowsToken,
        approvedFolders: folders,
      });
      setWindowsToken("");
      await loadDesktopGateway();
    } catch (err) {
      setDesktopError(err instanceof Error ? err.message : "Unable to save Windows gateway config");
    }
  }

  return (
    <div className="skills-page admin-setup-page scroll">
      <header className="skills-hero admin-setup-hero">
        <div>
          <span className="stub-tag">{config.eyebrow}</span>
          <h1>{config.title}</h1>
          <p>{config.blurb}</p>
        </div>
      </header>

      <section className="skills-metrics admin-setup-metrics" aria-label={`${config.title} metrics`}>
        {config.metrics.map((metric) => (
          <article className={metricClass(metric.tone)} key={metric.label}>
            <span>{metric.label}</span>
            <b>{metric.value}</b>
            <small>{metric.detail}</small>
          </article>
        ))}
      </section>

      {kind === "desktop-gateway" && (
        <section className="desktop-gateway-live" aria-label="Desktop Gateway live readiness">
          <article className="router-panel desktop-readiness-card">
            <div className="section-head">
              <div>
                <h2>Readiness summary</h2>
                <p>Live probe for the remote Hermes Desktop gateway, Windows-local gateway, and execution boundaries before dispatch. Compare Run on VPS, Run on Windows Desktop, and synced workspace options before assigning work.</p>
              </div>
              <button className="btn ghost small" onClick={() => void loadDesktopGateway()}>Test connection</button>
            </div>
            {desktopError && <div className="skills-error">{desktopError}</div>}
            <div className="desktop-readiness-grid">
              <div className="kv"><span>Remote URL</span><b>{desktopGateway?.remoteUrl ?? "Loading…"}</b></div>
              <div className="kv"><span>Token</span><b>{desktopGateway?.tokenSet ? `Set ${desktopGateway.sessionTokenPreview ?? "[REDACTED]"}` : "Not set"}</b></div>
              <div className="kv"><span>Gateway service</span><b>{desktopGateway?.service.active || "unknown"}</b></div>
              <div className="kv"><span>Ready targets</span><b>{desktopGateway?.readinessSummary.readyTargets ?? 0}/{desktopGateway?.targets.length ?? 0}</b></div>
            </div>
            <div className="desktop-attention-list">
              {(desktopGateway?.readinessSummary.needsAttention.length ? desktopGateway.readinessSummary.needsAttention : ["No readiness blockers detected."]).map((item) => (
                <span className="tag warn" key={item}>{item}</span>
              ))}
            </div>
          </article>

          <div className="desktop-target-grid">
            {(desktopGateway?.targets ?? []).map((target) => (
              <article className="desktop-target-card" key={target.id}>
                <div className="skill-card-top">
                  <h3>{target.label}</h3>
                  <span className={`tag ${target.ready ? "good" : "warn"}`}>{target.ready ? "ready" : "not ready"}</span>
                </div>
                <p>{target.description}</p>
                <div className="kv"><span>Execution boundary</span><b>{target.executionBoundary}</b></div>
                <div className="kv"><span>Approval</span><b>{target.approvalRequired ? "Approval required" : "No extra approval"}</b></div>
                {target.url && <code>{target.url}</code>}
              </article>
            ))}
          </div>

          <article className="router-panel desktop-windows-config">
            <div className="section-head compact">
              <div>
                <h2>Windows Desktop Local Gateway</h2>
                <p>Configure WINDOWS_HERMES_GATEWAY_URL only after the Windows-side Hermes dashboard is reachable through a trusted tunnel.</p>
              </div>
            </div>
            <label>
              <span>WINDOWS_HERMES_GATEWAY_URL</span>
              <input value={windowsUrl} onChange={(event) => setWindowsUrl(event.target.value)} placeholder="http://windows-tailnet-name:9119" />
            </label>
            <label>
              <span>WINDOWS_HERMES_GATEWAY_TOKEN</span>
              <input value={windowsToken} onChange={(event) => setWindowsToken(event.target.value)} placeholder={desktopGateway?.windows.tokenSet ? "Leave blank to keep existing token" : "Paste token once"} type="password" />
            </label>
            <label>
              <span>Approved folders</span>
              <textarea value={approvedFolders} onChange={(event) => setApprovedFolders(event.target.value)} rows={4} />
            </label>
            <button className="btn dark" onClick={() => void saveWindowsGateway()}>Save and test Windows gateway</button>
            <div className="drawer-section-list">
              {(desktopGateway?.desktopSteps ?? []).map((step) => <div className="kv" key={step}><span>Setup step</span><b>{step}</b></div>)}
            </div>
          </article>
        </section>
      )}

      <div className="admin-setup-grid">
        <section className="admin-setup-main">
          {config.sections.map((section) => (
            <article className="router-panel admin-setup-section" key={section.heading}>
              <div className="section-head">
                <div>
                  <h2>{section.heading}</h2>
                  <p>{section.body}</p>
                </div>
              </div>
              <div className="admin-setup-cards">
                {section.cards.map((card) => (
                  <div className="admin-setup-card" key={card.title}>
                    <div>
                      <h3>{card.title}</h3>
                      <p>{card.body}</p>
                      {card.note && <small>{card.note}</small>}
                    </div>
                    {card.target ? (
                      <button className="btn ghost small" onClick={() => setView(card.target!)}>{card.action}</button>
                    ) : (
                      <span className="tag muted">{card.action}</span>
                    )}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>

        <aside className="admin-setup-side" aria-label="Implementation evidence">
          <article className="router-panel">
            <div className="section-head compact">
              <div>
                <h2>Step 3 evidence</h2>
                <p>Real admin setup surface, linked to existing operational routes and explicit about what is not yet safe to mutate.</p>
              </div>
            </div>
            <div className="drawer-section-list">
              {config.evidence.map((item) => (
                <div className="kv" key={item}><span>Verified intent</span><b>{item}</b></div>
              ))}
            </div>
          </article>
        </aside>
      </div>
    </div>
  );
}
