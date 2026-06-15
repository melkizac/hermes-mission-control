import { useEffect, useMemo, useState } from "react";
import { SlideOverDrawer } from "../components/SlideOverDrawer";
import { useStore } from "../services/store";
import { InfoTooltip } from "../components/InfoTooltip";

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

type ApprovalMutationResponse = {
  ok: boolean;
  item?: { id?: string; status?: string };
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
  const [approvedAgents, setApprovedAgents] = useState<Record<string, string>>({});
  const [draftedAgents, setDraftedAgents] = useState<Record<string, string>>({});
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

  async function createReflectionApproval(agent: ReflectionAgent) {
    return requestJson<ApprovalMutationResponse>("/api/reflections/approval", {
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
  }

  async function saveAgentApprovalDraft(agent: ReflectionAgent) {
    setBusy(`${agent.agentId}:draft`);
    setNotice(null);
    setError(null);
    try {
      const result = await createReflectionApproval(agent);
      const approvalId = result.item?.id || "";
      setDraftedAgents((prev) => ({ ...prev, [agent.agentId]: approvalId || "drafted" }));
      setNotice(`Saved draft approval for ${agent.agentName}. You can also approve it directly from the drawer.`);
      setDrawerTab("Approval");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save approval draft");
    } finally {
      setBusy(null);
    }
  }

  async function approveAgentReflection(agent: ReflectionAgent) {
    setBusy(`${agent.agentId}:approve`);
    setNotice(null);
    setError(null);
    try {
      const created = await createReflectionApproval(agent);
      const approvalId = created.item?.id;
      if (!approvalId) throw new Error("Approval was created without an id");
      const approved = await requestJson<ApprovalMutationResponse>(`/api/approvals/${encodeURIComponent(approvalId)}`, {
        method: "POST",
        body: JSON.stringify({
          decision: "approve",
          note: `Approved from ${agent.agentName} reflection drawer.`,
        }),
      });
      setApprovedAgents((prev) => ({ ...prev, [agent.agentId]: approvalId }));
      setDraftedAgents((prev) => ({ ...prev, [agent.agentId]: approvalId }));
      setNotice(`Approved reflection proposal for ${agent.agentName}.`);
      setDrawerTab("Approval");
      if (!approved.ok) setError("Approval was submitted, but the server did not confirm ok=true.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to approve reflection");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="reflections-page scroll reflections-agent-list-page">
      <header className="reflections-hero reflection-list-hero">
        <div>
          <span className="stub-tag">AI WORKFORCE REFLECTIONS</span>
          <div className="hero-title-with-help">
            <h1>Review each agent’s learning proposal</h1>
            <InfoTooltip label="About reflections">
              <strong>How to use this page:</strong> select an agent, inspect the tabs, then approve or save a draft without leaving the drawer.
              <br />
              <strong>Safety rule:</strong> approving records the decision. It still does not silently write memory, create skills, or expand authority.
            </InfoTooltip>
          </div>
        </div>
      </header>

      {error && <div className="task-error">{error}</div>}
      {notice && <div className="task-notice">{notice}</div>}

      {loading && <div className="empty big">Loading agent reflections…</div>}
      {data && !loading && (
        <>
          <section className="reflection-metrics reflection-list-metrics">
            <Metric label="Agents" value={data.summary.agents} sub="available for review" />
            <Metric label="Approval mode" value={data.summary.application_mode} sub="changes stay review-gated" />
            <Metric label="Workflow" value="drawer" sub="review and approve per agent" />
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
                  <button className="btn tiny" type="button" onClick={() => openAgent(agent, "Overview")}>Review</button>
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
              <button className="btn primary tiny" type="button" disabled={busy === `${selectedAgent.agentId}:approve`} onClick={() => void approveAgentReflection(selectedAgent)}>
                {busy === `${selectedAgent.agentId}:approve` ? "Approving…" : approvedAgents[selectedAgent.agentId] ? "Approved" : "Approve reflection"}
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
                <p><strong>You are approving:</strong> the reflection proposal for this agent, inside the authority boundary shown here.</p>
                <p><strong>Not approving:</strong> automatic memory writes, automatic skill creation, external posting, production changes, or expanded authority.</p>
                <p><strong>No double work:</strong> approve directly here. Mission Control records the approval card behind the scenes for audit history.</p>
              </div>
              <pre>{approvalBodyForAgent(selectedAgent)}</pre>
              {approvedAgents[selectedAgent.agentId] && (
                <div className="reflection-drawer-callout">
                  <strong>Approved in this drawer</strong>
                  <p>Audit record: {approvedAgents[selectedAgent.agentId]}</p>
                </div>
              )}
              {draftedAgents[selectedAgent.agentId] && !approvedAgents[selectedAgent.agentId] && (
                <div className="reflection-drawer-callout amber">
                  <strong>Draft saved</strong>
                  <p>Audit record: {draftedAgents[selectedAgent.agentId]}</p>
                </div>
              )}
              <div className="reflection-drawer-footer-actions">
                <button className="btn primary" type="button" disabled={busy === `${selectedAgent.agentId}:approve` || Boolean(approvedAgents[selectedAgent.agentId])} onClick={() => void approveAgentReflection(selectedAgent)}>
                  {busy === `${selectedAgent.agentId}:approve` ? "Approving…" : approvedAgents[selectedAgent.agentId] ? "Approved" : "Approve reflection"}
                </button>
                <button className="ghost" type="button" disabled={busy === `${selectedAgent.agentId}:draft` || Boolean(approvedAgents[selectedAgent.agentId])} onClick={() => void saveAgentApprovalDraft(selectedAgent)}>
                  {busy === `${selectedAgent.agentId}:draft` ? "Saving…" : "Save draft only"}
                </button>
                <button className="ghost" type="button" onClick={() => setView("approvals")}>View audit queue</button>
              </div>
            </section>
          )}
        </SlideOverDrawer>
      )}
    </div>
  );
}
