import { useEffect, useMemo, useState } from "react";
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

type TabKey = "agent" | "workforce" | "approval";

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

function BulletList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="reflection-list-block">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
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

function approvalBodyForWorkforce(workforce: WorkforceReflection, agents: ReflectionAgent[]) {
  return [
    workforce.title,
    "",
    workforce.summary,
    "",
    "Agent Sharpening lanes included:",
    ...agents.map((agent) => `- ${agent.agentName}: ${agent.focus}`),
    "",
    "Workforce Alignment outputs:",
    ...workforce.outputs.map((item) => `- ${item}`),
    "",
    "Governance rules:",
    ...workforce.governanceRules.map((item) => `- ${item}`),
    "",
    "Review questions:",
    ...workforce.reviewQuestions.map((item) => `- ${item}`),
  ].join("\n");
}

export function Reflections() {
  const { setView } = useStore();
  const [data, setData] = useState<ReflectionsResponse | null>(null);
  const [tab, setTab] = useState<TabKey>("agent");
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

  const approvalPreview = useMemo(() => {
    if (!data) return "";
    return approvalBodyForWorkforce(data.workforceAlignment, data.agentSharpening);
  }, [data]);

  async function requestWorkforceApproval() {
    if (!data) return;
    setBusy("workforce");
    setNotice(null);
    setError(null);
    try {
      await requestJson("/api/reflections/approval", {
        method: "POST",
        body: JSON.stringify({
          proposalId: data.workforceAlignment.id,
          kind: "workforce_alignment",
          title: "Approve Agent Reflection & Workforce Review operating model",
          target: "AI Workforce",
          effect: "Melkizac may run cross-agent reflection reviews and create approval-gated proposals for memory, skills, and workforce-map updates. Individual agents may sharpen inside their lane, but authority does not expand without a separate approval.",
          reason: "This changes how future agents learn and coordinate, so the approval record must be explicit and reviewable.",
          body: approvalPreview,
        }),
      });
      setNotice("Created an approval card for Agent Reflection & Workforce Review.");
      setTab("approval");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create approval");
    } finally {
      setBusy(null);
    }
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create approval");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="reflections-page scroll">
      <header className="reflections-hero">
        <div>
          <span className="stub-tag">AGENT REFLECTION</span>
          <h1>Agent Sharpening & Workforce Alignment</h1>
          <p>
            Reflection turns past sessions and current memory into reviewable proposals. Agents become sharper inside their own lanes while Melkizac keeps the whole AI Workforce aligned, approval-gated, and auditable.
          </p>
        </div>
        <div className="reflections-hero-actions">
          <button className="task-icon-action dark" aria-label="Refresh reflections" title="Refresh reflections" onClick={() => void load()}>↻</button>
          <button className="btn primary" disabled={!data || busy === "workforce"} onClick={() => void requestWorkforceApproval()}>
            {busy === "workforce" ? "Creating approval…" : "Create approval to adopt"}
          </button>
        </div>
      </header>

      {error && <div className="task-error">{error}</div>}
      {notice && <div className="task-notice">{notice} <button className="ghost tiny" onClick={() => setView("approvals")}>Open Approvals</button></div>}

      {loading && <div className="empty big">Loading reflection model…</div>}
      {data && !loading && (
        <>
          <section className="reflection-metrics">
            <Metric label="Agents sharpened" value={data.summary.agent_sharpening} sub="role-specific lanes" />
            <Metric label="Workforce review" value={data.summary.workforce_alignment} sub="cross-agent alignment loop" />
            <Metric label="Apply mode" value={data.summary.application_mode} sub="no silent memory or authority changes" />
          </section>

          <section className="reflection-principles">
            {data.principles.map((principle) => <span key={principle}>{principle}</span>)}
          </section>

          <div className="reflection-tabs" role="tablist" aria-label="Reflection views">
            <button className={tab === "agent" ? "on" : ""} onClick={() => setTab("agent")}>Agent Sharpening</button>
            <button className={tab === "workforce" ? "on" : ""} onClick={() => setTab("workforce")}>Workforce Alignment</button>
            <button className={tab === "approval" ? "on" : ""} onClick={() => setTab("approval")}>Approval Detail</button>
          </div>

          {tab === "agent" && (
            <section className="reflection-agent-grid">
              {data.agentSharpening.map((agent) => (
                <article className="reflection-agent-card" key={agent.agentId}>
                  <div className="reflection-card-head">
                    <div>
                      <span>{agent.role}</span>
                      <h2>{agent.agentName}</h2>
                    </div>
                    <em>Sharpening</em>
                  </div>
                  <h3>{agent.focus}</h3>
                  <p>{agent.summary}</p>
                  <div className="reflection-card-columns">
                    <BulletList title="Memory candidates" items={agent.memoryCandidates} />
                    <BulletList title="Skill candidates" items={agent.skillCandidates} />
                    <BulletList title="Authority boundary" items={agent.authorityBoundaries} />
                  </div>
                  <div className="reflection-evidence-row">
                    {agent.evidence.map((item) => <span key={item}>{item}</span>)}
                  </div>
                  <footer>
                    <button className="ghost tiny" disabled={busy === agent.agentId} onClick={() => void requestAgentApproval(agent)}>
                      {busy === agent.agentId ? "Creating…" : "Create approval for this agent"}
                    </button>
                  </footer>
                </article>
              ))}
            </section>
          )}

          {tab === "workforce" && (
            <section className="reflection-workforce-panel">
              <div className="reflection-workforce-main">
                <span className="stub-tag">WORKFORCE ALIGNMENT</span>
                <h2>{data.workforceAlignment.title}</h2>
                <p>{data.workforceAlignment.summary}</p>
                <div className="reflection-workforce-grid">
                  <BulletList title="Outputs" items={data.workforceAlignment.outputs} />
                  <BulletList title="Governance rules" items={data.workforceAlignment.governanceRules} />
                  <BulletList title="Review questions" items={data.workforceAlignment.reviewQuestions} />
                </div>
              </div>
              <aside className="reflection-scope-card">
                <h3>Separation of scope</h3>
                <p><strong>Agent Sharpening</strong> improves each agent’s competence inside its own lane.</p>
                <p><strong>Workforce Alignment</strong> lets Melkizac detect contradictions, ownership drift, and handoff gaps across agents.</p>
                <p><strong>Approval gate</strong> prevents silent changes to memory, skills, workforce map, or authority.</p>
              </aside>
            </section>
          )}

          {tab === "approval" && (
            <section className="reflection-approval-panel">
              <div className="approval-decision-summary">
                <h3>What exactly am I approving?</h3>
                <p><strong>You are approving:</strong> the operating model where individual agents sharpen their own memory/skills and Melkizac performs cross-agent workforce alignment.</p>
                <p><strong>If approved:</strong> HMC can create reviewable reflection proposals for memory, skills, role ownership, and approval-policy improvements. Nothing is applied silently.</p>
                <p><strong>Boundary:</strong> smarter agents do not gain more authority unless a separate approval grants it.</p>
              </div>
              <pre>{approvalPreview}</pre>
              <button className="btn primary" disabled={busy === "workforce"} onClick={() => void requestWorkforceApproval()}>
                {busy === "workforce" ? "Creating approval…" : "Create approval card"}
              </button>
            </section>
          )}
        </>
      )}
    </div>
  );
}
