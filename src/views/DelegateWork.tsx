import { useEffect, useMemo, useState } from "react";
import type { DelegateWorkPlan, ProjectMasterInstructions, RiskLevel } from "../types";
import { HttpHermesClient } from "../services/httpHermesClient";
import { RiskBadges, EvidenceTimeline } from "../components/MissionFoundation";
import { InfoTooltip } from "../components/InfoTooltip";

const client = new HttpHermesClient();

export function DelegateWork() {
  const [request, setRequest] = useState("");
  const [projectId, setProjectId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [risk, setRisk] = useState<RiskLevel | "">("");
  const [projects, setProjects] = useState<Array<{ id: string; name: string; summary?: string }>>([]);
  const [agents, setAgents] = useState<Array<{ id: string; name: string; status?: string }>>([]);
  const [masters, setMasters] = useState<ProjectMasterInstructions[]>([]);
  const [riskLevels, setRiskLevels] = useState<RiskLevel[]>([]);
  const [plan, setPlan] = useState<DelegateWorkPlan | null>(null);
  const [createdTask, setCreatedTask] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState<"load" | "plan" | "create" | null>("load");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      setBusy("load");
      setError(null);
      try {
        const data = await client.getDelegateWorkContext();
        if (!alive) return;
        setProjects(data.projects || []);
        setAgents(data.agents || []);
        setMasters(data.masterInstructions || []);
        setRiskLevels(data.riskLevels || []);
        setProjectId(data.defaultProjectId || data.projects?.[0]?.id || "");
        setAgentId(data.agents?.[0]?.id || "");
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Unable to load Delegate Work context");
      } finally {
        if (alive) setBusy(null);
      }
    }
    void load();
    return () => { alive = false; };
  }, []);

  const selectedMaster = useMemo(
    () => masters.find((item) => item.projectId === projectId) || null,
    [masters, projectId],
  );

  async function routeWork() {
    if (!request.trim()) {
      setError("Describe the work to delegate first.");
      return;
    }
    setBusy("plan");
    setError(null);
    setCreatedTask(null);
    try {
      const result = await client.planDelegateWork({ request, projectId, agentId, risk: risk || undefined });
      if (!result.ok || !result.plan) throw new Error(result.error || "Unable to route work");
      setPlan(result.plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to route work");
    } finally {
      setBusy(null);
    }
  }

  async function createDelegatedTask() {
    if (!request.trim()) return;
    setBusy("create");
    setError(null);
    try {
      const result = await client.createDelegateWork({ request, projectId, agentId, risk: risk || undefined, title: plan?.title });
      if (!result.ok || !result.plan) throw new Error(result.error || "Unable to create delegated task");
      setPlan(result.plan);
      setCreatedTask(result.task || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create delegated task");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="delegate-work-page scroll">
      <header className="delegate-work-hero">
        <div>
          <span className="stub-tag">DELEGATE WORK</span>
          <div className="hero-title-with-help">
            <h1>Delegate Work</h1>
            <InfoTooltip label="About delegation">Turn a natural-language request into project-scoped, evidence-ready work with routing, risk, and Project master instructions attached.</InfoTooltip>
          </div>
        </div>
        <button className="btn dark" disabled={busy === "load"} onClick={() => void routeWork()}>{busy === "plan" ? "Routing…" : "Route work"}</button>
      </header>

      {error && <div className="task-error">{error}</div>}
      {createdTask && <div className="task-notice">Created delegated task: {String(createdTask.title || createdTask.id || "queued")}</div>}

      <section className="delegate-work-grid">
        <article className="delegate-work-intake panel-card">
          <div className="section-head compact"><div><span>Intake</span><h2>What should the AI workforce do?</h2></div></div>
          <textarea value={request} onChange={(e) => setRequest(e.target.value)} placeholder="Example: Build the next Mission Control artifact result view using the existing evidence primitives, test it, and report blockers." rows={8} />
          <div className="delegate-work-controls">
            <label>Project<select value={projectId} onChange={(e) => setProjectId(e.target.value)}>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
            <label>Agent<select value={agentId} onChange={(e) => setAgentId(e.target.value)}>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></label>
            <label>Risk<select value={risk} onChange={(e) => setRisk(e.target.value as RiskLevel | "")}><option value="">Auto-detect</option>{riskLevels.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          </div>
          <div className="delegate-work-actions">
            <button className="btn dark" disabled={busy === "plan" || !request.trim()} onClick={() => void routeWork()}>{busy === "plan" ? "Routing…" : "Route work"}</button>
            <button className="btn primary" disabled={busy === "create" || !request.trim()} onClick={() => void createDelegatedTask()}>{busy === "create" ? "Creating…" : "Create delegated task"}</button>
          </div>
        </article>

        <aside className="delegate-master panel-card">
          <div className="section-head compact"><div><span>Project context</span><h2>Project master instructions</h2></div></div>
          {selectedMaster ? <pre>{selectedMaster.masterInstructions}</pre> : <p className="muted">Select a project to preview inherited operating rules.</p>}
          <div className="delegate-master-chips">
            {(selectedMaster?.linkedSkills || []).slice(0, 8).map((skill) => <span key={skill}>{skill}</span>)}
            {!selectedMaster?.linkedSkills?.length && <span>No linked skills yet</span>}
          </div>
        </aside>
      </section>

      {plan && <section className="delegate-work-plan panel-card">
        <div className="section-head compact"><div><span>Routing plan</span><h2>{plan.title}</h2></div><RiskBadges risks={[plan.risk]} /></div>
        <div className="delegate-plan-summary">
          <div><span>Project</span><b>{plan.projectName}</b></div>
          <div><span>Agent</span><b>{plan.agentName}</b></div>
          <div><span>Approval</span><b>{plan.approvalRequired ? "Approval gate required" : "Safe to queue"}</b></div>
        </div>
        <p>{plan.routingReason}</p>
        <div className="delegate-plan-columns">
          <div><h3>Prompt preview</h3><pre>{plan.promptPreview}</pre></div>
          <div><h3>Task body</h3><pre>{plan.taskBody}</pre></div>
        </div>
        <EvidenceTimeline evidence={plan.evidence} />
      </section>}
    </div>
  );
}
