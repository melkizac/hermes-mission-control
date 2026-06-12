import { useEffect, useMemo, useState } from "react";
import { SlideOverDrawer } from "../components/SlideOverDrawer";
import { useStore } from "../services/store";

type ReflectionAgent = {
  agentId: string;
  agentName: string;
  role: string;
  focus: string;
  summary: string;
  memoryCandidates: string[];
  skillCandidates: string[];
  authorityBoundaries: string[];
  evidence: string[];
};

type WorkforceReflection = {
  id: string;
  title: string;
  summary: string;
  outputs: string[];
  governanceRules: string[];
  reviewQuestions: string[];
};

type ReflectionsResponse = {
  ok: boolean;
  generated_at: string;
  summary: {
    agents: number;
    agent_sharpening: number;
    workforce_alignment: number;
    application_mode: string;
  };
  principles: string[];
  agentSharpening: ReflectionAgent[];
  workforceAlignment: WorkforceReflection;
};

type DrawerTab = "Overview" | "Memory" | "Skills" | "Authority" | "Evidence" | "Approval";

const DRAWER_TABS: DrawerTab[] = ["Overview", "Memory", "Skills", "Authority", "Evidence", "Approval"];

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${window.location.protocol}//${window.location.host}${path}`, {
    credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

function Metric({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <article className="reflection-metric">
      <span>{label}</span>
      <b>{value}</b>
      <small>{sub}</small>
    </article>
  );
}

function BulletList({ title, items, empty = "No proposal yet." }: { title: string; items: string[]; empty?: string }) {
  return (
    <div className="reflection-list-block">
      <h3>{title}</h3>
      {items.length ? (
        <ul>
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : <p>{empty}</p>}
    </div>
  );
}

function approvalBodyForAgent(agent: ReflectionAgent) {
  return [
    `Agent Sharpening proposal for ${agent.agentName}`,
    "",
    `Focus: ${agent.focus}`,
    `Why: ${agent.summary}`,
    "",
    "Memory candidates:",
    ...agent.memoryCandidates.map((item) => `- ${item}`),
    "",
    "Skill/playbook candidates:",
    ...agent.skillCandidates.map((item) => `- ${item}`),
    "",
    "Authority boundaries:",
    ...agent.authorityBoundaries.map((item) => `- ${item}`),
    "",
    "Evidence shown:",
    ...agent.evidence.map((item) => `- ${item}`),
  ].join("\n");
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "A";
}

export function Reflections() {
  const { setView } = useStore();
  const [data, setData] = useState<ReflectionsResponse | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("Overview");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await requestJson<ReflectionsResponse>("/api/reflections");
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load reflections");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const selectedAgent = useMemo(() => {
    if (!data || !selectedAgentId) return null;
    return data.agentSharpening.find((agent) => agent.agentId === selectedAgentId) || null;
  }, [data, selectedAgentId]);

  function openAgent(agent: ReflectionAgent, tab: DrawerTab = "Overview") {
    setSelectedAgentId(agent.agentId);
    setDrawerTab(tab);
  }

  async function requestAgentApproval(agent: ReflectionAgent) {
    setBusy(agent.agentId);
    setNotice(null);
    setError(null);
    try {
      await requestJson("/api/reflections/approval", {
        method: "POST",
        body: JSON.stringify({
          proposalId: `agent-${agent.agentId}`,
          kind: "agent_sharpening",
          title: `Approve Agent Sharpening proposal: ${agent.agentName}`,
          target: agent.agentName,
          effect: `Future reflection runs may propose memory and skill improvements for ${agent.agentName} inside this role boundary: ${agent.authorityBoundaries.join("; ")}.`,
          reason: "Agent-specific learning should improve competence without silently expanding authority.",
          body: approvalBodyForAgent(agent),
        }),
      });
      setNotice(`Created approval card for ${agent.agentName}.`);
      setDrawerTab("Approval");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create approval");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="reflections-page scroll reflections-agent-list-page">
      <header className="reflections-hero reflection-list-hero">
        <div>
          <span className="stub-tag">AI WORKFORCE REFLECTIONS</span>
          <h1>Review each agent’s learning proposal</h1>
          <p>
            Click an agent to open its reflection drawer. Review memory, skills, authority, evidence, and approval from one place. Nothing is applied until an approval card is created and reviewed.
          </p>
        </div>
        <div className="reflections-hero-actions">
          <button className="task-icon-action dark" aria-label="Refresh reflections" title="Refresh reflections" onClick={() => void load()}>↻</button>
          <button className="btn" onClick={() => setView("approvals")}>Open Approvals</button>
        </div>
      </header>

      {error && <div className="task-error">{error}</div>}
      {notice && <div className="task-notice">{notice} <button className="ghost tiny" onClick={() => setView("approvals")}>Open Approvals</button></div>}

      {loading && <div className="empty big">Loading agent reflections…</div>}
      {data && !loading && (
        <>
          <section className="reflection-metrics reflection-list-metrics">
            <Metric label="Agents" value={data.summary.agents} sub="available for review" />
            <Metric label="Approval mode" value={data.summary.application_mode} sub="changes stay review-gated" />
            <Metric label="Workflow" value="drawer" sub="review and approve per agent" />
          </section>

          <section className="reflection-list-guidance" aria-label="How to use reflections">
            <div>
              <strong>How to use this page</strong>
              <p>Select an agent. Review its proposal in the drawer tabs. If it makes sense, create an approval card from the drawer.</p>
            </div>
            <div>
              <strong>Safety rule</strong>
              <p>Reflections propose learning. They do not automatically write memory, create skills, or expand authority.</p>
            </div>
          </section>

          <section className="reflection-agent-list" aria-label="Agent reflection list">
            {data.agentSharpening.map((agent) => (
              <article className="reflection-agent-row" key={agent.agentId}>
                <button className="reflection-agent-row-main" type="button" onClick={() => openAgent(agent)}>
                  <span className="reflection-agent-avatar" aria-hidden="true">{initials(agent.agentName)}</span>
                  <span className="reflection-agent-row-text">
                    <span className="reflection-agent-role">{agent.role}</span>
                    <strong>{agent.agentName}</strong>
                    <em>{agent.focus}</em>
                  </span>
                  <span className="reflection-agent-row-counts" aria-label="Reflection proposal counts">
                    <b>{agent.memoryCandidates.length}</b> memory
                    <b>{agent.skillCandidates.length}</b> skills
                    <b>{agent.authorityBoundaries.length}</b> boundaries
                  </span>
                </button>
                <div className="reflection-agent-row-actions">
                  <button className="ghost tiny" type="button" onClick={() => openAgent(agent, "Overview")}>Review</button>
                  <button className="btn tiny" type="button" onClick={() => openAgent(agent, "Approval")}>Approval</button>
                </div>
              </article>
            ))}
          </section>

          <section className="reflection-workforce-summary-card">
            <span className="stub-tag">WORKFORCE ALIGNMENT</span>
            <h2>{data.workforceAlignment.title}</h2>
            <p>{data.workforceAlignment.summary}</p>
            <div className="reflection-workforce-summary-grid">
              <BulletList title="Governance rules" items={data.workforceAlignment.governanceRules} />
              <BulletList title="Review questions" items={data.workforceAlignment.reviewQuestions} />
            </div>
          </section>
        </>
      )}

      {selectedAgent && (
        <SlideOverDrawer<DrawerTab>
          title={selectedAgent.agentName}
          subtitle={selectedAgent.focus}
          eyebrow={selectedAgent.role}
          closeLabel={`Close ${selectedAgent.agentName} reflection`}
          tabs={DRAWER_TABS}
          activeTab={drawerTab}
          onTabChange={setDrawerTab}
          onClose={() => setSelectedAgentId(null)}
          width="wide"
          className="reflection-detail-drawer"
          contentClassName="reflection-drawer-body"
          actions={(
            <>
              <button className="ghost tiny" type="button" onClick={() => setDrawerTab("Approval")}>Review approval</button>
              <button className="btn primary tiny" type="button" disabled={busy === selectedAgent.agentId} onClick={() => void requestAgentApproval(selectedAgent)}>
                {busy === selectedAgent.agentId ? "Creating…" : "Create approval card"}
              </button>
            </>
          )}
        >
          {drawerTab === "Overview" && (
            <section className="reflection-drawer-section">
              <div className="reflection-drawer-callout">
                <strong>What this reflection is asking</strong>
                <p>{selectedAgent.summary}</p>
              </div>
              <div className="reflection-drawer-overview-grid">
                <BulletList title="Memory candidates" items={selectedAgent.memoryCandidates} />
                <BulletList title="Skill candidates" items={selectedAgent.skillCandidates} />
                <BulletList title="Authority boundary" items={selectedAgent.authorityBoundaries} />
              </div>
            </section>
          )}

          {drawerTab === "Memory" && (
            <section className="reflection-drawer-section">
              <div className="reflection-drawer-callout amber">
                <strong>Review before saving memory</strong>
                <p>Only durable facts should become memory. Temporary progress, PR numbers, and stale operational notes should not be saved.</p>
              </div>
              <BulletList title="Proposed memory candidates" items={selectedAgent.memoryCandidates} />
            </section>
          )}

          {drawerTab === "Skills" && (
            <section className="reflection-drawer-section">
              <div className="reflection-drawer-callout">
                <strong>Review repeatable workflows</strong>
                <p>Skill candidates should capture repeatable procedures, verification steps, pitfalls, and rollback notes.</p>
              </div>
              <BulletList title="Proposed skill/playbook candidates" items={selectedAgent.skillCandidates} />
            </section>
          )}

          {drawerTab === "Authority" && (
            <section className="reflection-drawer-section">
              <div className="reflection-drawer-callout danger">
                <strong>Authority does not expand automatically</strong>
                <p>This tab defines the safe operating boundary for the agent. Any expansion needs a separate explicit approval.</p>
              </div>
              <BulletList title="Authority boundaries" items={selectedAgent.authorityBoundaries} />
            </section>
          )}

          {drawerTab === "Evidence" && (
            <section className="reflection-drawer-section">
              <BulletList title="Evidence used for this reflection" items={selectedAgent.evidence} />
              <div className="reflection-drawer-callout">
                <strong>Evidence standard</strong>
                <p>Apply the proposal only if the evidence matches the agent’s actual work and role. If the evidence is weak, leave it as a proposal.</p>
              </div>
            </section>
          )}

          {drawerTab === "Approval" && (
            <section className="reflection-drawer-section">
              <div className="approval-decision-summary">
                <h3>Approve reflection proposal for {selectedAgent.agentName}</h3>
                <p><strong>You are approving:</strong> a reviewable proposal that this agent may use these memory/skill improvements inside its current role boundary.</p>
                <p><strong>Not approving:</strong> automatic memory writes, automatic skill creation, external posting, production changes, or expanded authority.</p>
                <p><strong>Next step:</strong> create an approval card, then review it in Approvals before applying any durable change.</p>
              </div>
              <pre>{approvalBodyForAgent(selectedAgent)}</pre>
              <div className="reflection-drawer-footer-actions">
                <button className="btn primary" type="button" disabled={busy === selectedAgent.agentId} onClick={() => void requestAgentApproval(selectedAgent)}>
                  {busy === selectedAgent.agentId ? "Creating approval…" : "Create approval card in Approvals"}
                </button>
                <button className="ghost" type="button" onClick={() => setView("approvals")}>Open Approvals</button>
              </div>
            </section>
          )}
        </SlideOverDrawer>
      )}
    </div>
  );
}
