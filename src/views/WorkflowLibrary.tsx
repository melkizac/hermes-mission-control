import { ReactNode, useEffect, useState } from "react";
import type { PackagedWorkflow, WorkflowLibraryResponse } from "../types";
import { HttpHermesClient } from "../services/httpHermesClient";
import { ArtifactCard, EvidenceTimeline, RiskBadges } from "../components/MissionFoundation";
import { Icon } from "../components/Icon";
import { InfoTooltip } from "../components/InfoTooltip";

type WorkflowDetailTab = "overview" | "actions" | "approvals" | "evidence" | "runs" | "rules" | "metrics" | "learning";

const workflowDetailTabs: WorkflowDetailTab[] = ["overview", "actions", "approvals", "evidence", "runs", "rules", "metrics", "learning"];
const workflowDetailLabels: Record<WorkflowDetailTab, string> = {
  overview: "Overview",
  actions: "Actions",
  approvals: "Approvals",
  evidence: "Evidence",
  runs: "Runs",
  rules: "Rules",
  metrics: "Metrics",
  learning: "Learning",
};

const client = new HttpHermesClient();

function WorkflowEmpty({ children }: { children: ReactNode }) {
  return <div className="empty big workflow-detail-empty">{children}</div>;
}

function WorkflowInfo({ label, value }: { label: string; value: ReactNode }) {
  return <div className="workflow-detail-info"><span>{label}</span><b>{value || "—"}</b></div>;
}

function workflowTabCount(workflow: PackagedWorkflow, tab: WorkflowDetailTab) {
  if (tab === "actions") return workflow.steps.length + workflow.nextActions.length;
  if (tab === "approvals") return workflow.approvalGates.length;
  if (tab === "evidence") return workflow.evidence.length + workflow.artifacts.length;
  if (tab === "runs") return workflow.routines?.length ?? 0;
  return 0;
}

function workflowAutonomy(workflow: PackagedWorkflow) {
  if (workflow.approvalGates.length > 0 || workflow.launchDefaults?.noSubmit) return "Approval-gated";
  return workflow.taskMaterialization?.enabled ? "Agent-owned" : "Manual launch";
}

function workflowProgress(workflow: PackagedWorkflow) {
  const hasTasks = workflow.taskMaterialization?.enabled ? 1 : 0;
  const evidence = workflow.evidence.length > 0 ? 1 : 0;
  const artifacts = workflow.artifacts.length > 0 ? 1 : 0;
  const routines = (workflow.routines?.length ?? 0) > 0 ? 1 : 0;
  return Math.round(((hasTasks + evidence + artifacts + routines) / 4) * 100);
}

function formatWorkflowUpdated(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function WorkflowTabBody({ workflow, tab, funnelTargetUrl, funnelSchedule, setFunnelTargetUrl, setFunnelSchedule, scheduleFunnelWorkflow, launching }: {
  workflow: PackagedWorkflow;
  tab: WorkflowDetailTab;
  funnelTargetUrl: string;
  funnelSchedule: string;
  setFunnelTargetUrl: (value: string) => void;
  setFunnelSchedule: (value: string) => void;
  scheduleFunnelWorkflow: (workflow: PackagedWorkflow) => void;
  launching: string | null;
}) {
  if (tab === "overview") return (
    <>
      <div className="workflow-detail-section">
        <b>Summary</b>
        <p>{workflow.summary}</p>
        <p>{workflow.idealFor}</p>
      </div>
      <div className="workflow-detail-section">
        <b>Linked skills</b>
        <div className="workflow-chips strong">{workflow.skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
      </div>
      {workflow.taskMaterialization?.enabled && (
        <div className="workflow-detail-section workflow-materialization">
          <b>Task Board materialization</b>
          <p>Workflow output becomes Task Board cards under <span className="mono">{workflow.taskMaterialization.taskBoardTenant}</span>.</p>
          <div className="workflow-chips strong">
            <span>Assignee: {workflow.taskMaterialization.assignee}</span>
            <span>{workflow.taskMaterialization.statuses.join(" → ")}</span>
            <span>{workflow.taskMaterialization.sourceOfTruth}</span>
          </div>
        </div>
      )}
    </>
  );

  if (tab === "actions") return (
    <div className="workflow-detail-section">
      <b>Action plan</b>
      {workflow.steps.length === 0 ? <WorkflowEmpty>No workflow actions are defined yet.</WorkflowEmpty> : (
        <ol className="workflow-steps workflow-action-list">
          {workflow.steps.map((step, index) => <li key={step.id}><span>{index + 1}. {step.title}</span><small>{step.summary}</small></li>)}
        </ol>
      )}
      {workflow.nextActions.length > 0 && <div className="workflow-next-actions"><b>Next actions</b>{workflow.nextActions.map((item) => <p key={item}>{item}</p>)}</div>}
    </div>
  );

  if (tab === "approvals") return (
    <div className="workflow-detail-section">
      <b>Approval Gates</b>
      {workflow.approvalGates.length === 0 ? <WorkflowEmpty>No human Approval Gate is configured for this workflow template.</WorkflowEmpty> : (
        <div className="workflow-approval-card-list">
          {workflow.approvalGates.map((gate) => <div className="workflow-approval-card" key={gate.id}><div className="workflow-approval-card-head"><b>{gate.title}</b><span>{gate.risk}</span></div><p>{gate.reason}</p></div>)}
        </div>
      )}
    </div>
  );

  if (tab === "evidence") return (
    <>
      <div className="workflow-detail-section"><b>Artifacts</b>{workflow.artifacts.length === 0 ? <WorkflowEmpty>No artifact template is defined yet.</WorkflowEmpty> : workflow.artifacts.map((artifact) => <ArtifactCard key={artifact.id} artifact={artifact} />)}</div>
      <div className="workflow-detail-section"><b>Evidence</b>{workflow.evidence.length === 0 ? <WorkflowEmpty>No evidence records are attached yet.</WorkflowEmpty> : <EvidenceTimeline evidence={workflow.evidence} />}</div>
    </>
  );

  if (tab === "runs") return (
    <div className="workflow-detail-section workflow-routines-linked">
      <b>Linked routines</b>
      {(workflow.routines?.length ?? 0) === 0 ? <WorkflowEmpty>No recurring routine is bound to this workflow yet.</WorkflowEmpty> : (
        <ol className="workflow-steps">{workflow.routines?.map((routine) => <li key={routine.id ?? routine.name}><span>{routine.label ?? routine.name}</span><small>{routine.schedule ?? "manual"} · {routine.enabled ? "enabled" : "paused"} · latest {routine.last_status ?? routine.status ?? "not-run"}</small></li>)}</ol>
      )}
    </div>
  );

  if (tab === "rules") return (
    <>
      <div className="workflow-detail-section"><b>Autonomy contract</b><div className="workflow-rule-grid"><WorkflowInfo label="Owner" value={workflow.agentName || workflow.agentId} /><WorkflowInfo label="Risk" value={workflow.risk} /><WorkflowInfo label="Autonomy" value={workflowAutonomy(workflow)} /><WorkflowInfo label="Safe target" value={workflow.launchDefaults?.safeTargetRequired ? "Required" : "Not required"} /><WorkflowInfo label="No-submit" value={workflow.launchDefaults?.noSubmit ? "Enforced" : "Not enforced"} /><WorkflowInfo label="Run mode" value={workflow.launchDefaults?.runMode ?? "Launch"} /></div></div>
      {workflow.id === "website-funnel-check" && <div className="workflow-detail-section workflow-funnel-settings"><b>No-submit funnel schedule</b><label className="workflow-funnel-target"><span>targetUrl for no-submit funnel check</span><input value={funnelTargetUrl} onChange={(event) => setFunnelTargetUrl(event.target.value)} placeholder="https://example.com/contact" /><span>schedule cron for recurring check</span><input value={funnelSchedule} onChange={(event) => setFunnelSchedule(event.target.value)} placeholder="0 9 * * 1" /><small>NO_SUBMIT is enforced; Mission Control blocks before external form submit.</small><button className="ghost tiny" type="button" disabled={launching === `${workflow.id}:schedule`} onClick={() => scheduleFunnelWorkflow(workflow)}>{launching === `${workflow.id}:schedule` ? "Scheduling…" : "Schedule recurring check"}</button></label></div>}
    </>
  );

  if (tab === "metrics") return (
    <div className="workflow-detail-section"><b>Workflow metrics</b><section className="workflow-metrics workflow-detail-metrics"><Metric label="Steps" value={workflow.steps.length} sub="Planned actions" /><Metric label="Evidence" value={workflow.evidence.length + workflow.artifacts.length} sub="Proof + artifacts" tone={workflow.evidence.length + workflow.artifacts.length > 0 ? "good" : undefined} /><Metric label="Approvals" value={workflow.approvalGates.length} sub="Human gates" /><Metric label="Routines" value={workflow.routines?.length ?? 0} sub="Scheduled bindings" /></section></div>
  );

  return <div className="workflow-detail-section"><b>Learning</b><WorkflowEmpty>No learning notes have been recorded for this workflow template yet. Retrospectives, prompt improvements, and rule changes will appear here once captured.</WorkflowEmpty></div>;
}

function compact(value: number | undefined | null) {
  return Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value ?? 0);
}

export function WorkflowLibrary() {
  const [data, setData] = useState<WorkflowLibraryResponse | null>(null);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState<PackagedWorkflow | null>(null);
  const [activeTab, setActiveTab] = useState<WorkflowDetailTab>("overview");
  const [launching, setLaunching] = useState<string | null>(null);
  const [launchNote, setLaunchNote] = useState<string | null>(null);
  const [funnelTargetUrl, setFunnelTargetUrl] = useState("https://httpbingo.org/forms/post");
  const [funnelSchedule, setFunnelSchedule] = useState("0 9 * * 1");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const next = await client.listWorkflows({ q, category });
      setData(next);
      setError(next.error ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load workflow library");
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 180);
    return () => window.clearTimeout(timer);
  }, [q, category]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const workflows = data?.workflows ?? [];
  const summary = data?.summary;

  async function launchWorkflow(workflow: PackagedWorkflow) {
    setLaunching(workflow.id);
    setLaunchNote(null);
    setError(null);
    try {
      const input = workflow.id === "website-funnel-check"
        ? { title: workflow.name, request: workflow.launchPrompt, targetUrl: funnelTargetUrl, expected: "public lead/order form submit boundary", runMode: "create-task" }
        : { title: workflow.name, request: workflow.launchPrompt };
      const result = await client.launchWorkflow(workflow.id, input);
      if (!result.ok) throw new Error(result.error || "Workflow launch failed");
      const taskCount = Array.isArray(result.tasks) ? result.tasks.length : 0;
      const taskId = taskCount > 1
        ? ` ${taskCount} Task Board block cards are queued.`
        : typeof result.task?.id === "string" ? ` Task ${result.task.id} is queued.` : " A Task Board item is queued.";
      setLaunchNote(`${workflow.name} launched.${taskId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to launch workflow");
    } finally {
      setLaunching(null);
    }
  }

  async function scheduleFunnelWorkflow(workflow: PackagedWorkflow) {
    setLaunching(`${workflow.id}:schedule`);
    setLaunchNote(null);
    setError(null);
    try {
      const result = await client.launchWorkflow(workflow.id, { title: `Scheduled ${workflow.name}`, request: workflow.launchPrompt, targetUrl: funnelTargetUrl, expected: "public lead/order form submit boundary", runMode: "schedule", schedule: funnelSchedule });
      if (!result.ok) throw new Error(result.error || "Workflow schedule failed");
      const routineId = typeof result.routine?.id === "string" ? ` Routine ${result.routine.id} is prepared paused.` : " A paused routine binding is prepared.";
      setLaunchNote(`${workflow.name} scheduled.${routineId} NO_SUBMIT routine remains approval-gated.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to schedule workflow");
    } finally {
      setLaunching(null);
    }
  }

  return (
    <div className="workflow-library-page scroll">
      <header className="workflow-hero">
        <div>
          <span className="stub-tag">PACKAGED SME WORKFLOWS</span>
          <div className="hero-title-with-help">
            <h1>Workflow library</h1>
            <InfoTooltip label="About workflows">
              Launch repeatable SME operating loops with linked skills, built-in evidence requirements, artifacts, and approval gates.
            </InfoTooltip>
          </div>
        </div>
        <button className="task-icon-action dark" aria-label="Refresh workflow library" title="Refresh workflow library" onClick={() => void load()}>
          <Icon name="refresh" size={18} />
        </button>
      </header>

      <section className="workflow-metrics">
        <Metric label="Templates" value={summary?.total ?? workflows.length} sub="Packaged workflows" />
        <Metric label="Skills" value={compact(summary?.skills_linked)} sub="Linked capabilities" />
        <Metric label="Evidence-ready" value={summary?.evidence_ready ?? 0} sub="With artifacts + proof" tone="good" />
        <Metric label="Approval gates" value={summary?.approval_required ?? 0} sub="Human-in-loop controls" />
      </section>

      <section className="workflow-filters">
        <label>
          <span>Search</span>
          <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="lead intake, LinkedIn, skill…" />
        </label>
        <label>
          <span>Category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All categories</option>
            {(data?.categories ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <div className="filter-help"><InfoTooltip label="About workflow launch">Evidence-ready workflows launch as Task Board items, not hidden chats.</InfoTooltip></div>
      </section>

      {error && <div className="skills-error">{error}</div>}
      {launchNote && <div className="workflow-launch-note">{launchNote}</div>}

      <div className="workflow-layout">
        <section className="workflow-grid">
          {workflows.map((workflow) => (
            <article className={`workflow-card ${selected?.id === workflow.id ? "on" : ""}`} data-testid="workflow-card" key={workflow.id}>
              <button className="workflow-card-main" onClick={() => { setSelected(workflow); setActiveTab("overview"); }}>
                <div className="workflow-card-top">
                  <span>{workflow.category}</span>
                  <RiskBadges risks={[workflow.risk]} />
                </div>
                <h2>{workflow.name}</h2>
                <p>{workflow.summary}</p>
                <div className="workflow-chips">
                  <span>{workflow.steps.length} steps</span>
                  <span>{workflow.skills.length} skills</span>
                  <span>{workflow.approvalGates.length} Approval gates</span>
                  {(workflow.routines?.length ?? 0) > 0 && <span>{workflow.routines?.length} routines</span>}
                  {workflow.taskMaterialization?.enabled && <span>Task Board materialization</span>}
                </div>
              </button>
              <button className="btn dark workflow-launch" disabled={launching === workflow.id} onClick={() => void launchWorkflow(workflow)}>
                {launching === workflow.id ? "Launching…" : "Launch workflow"}
              </button>
            </article>
          ))}
          {workflows.length === 0 && <div className="empty big">No packaged workflows matched this filter.</div>}
        </section>
      </div>

      {selected && (
        <div className="workflow-detail-layer" role="presentation">
          <button className="workflow-detail-scrim" aria-label="Close workflow details" onClick={() => setSelected(null)} />
          <aside className="workflow-detail-drawer workflow-detail-drawer-standard" data-testid="workflow-detail-drawer" aria-label="Selected workflow details">
            <div className="workflow-detail-head">
              <div>
                <span>Evidence-ready template</span>
                <h2>{selected.name}</h2>
                <p>{selected.idealFor}</p>
              </div>
              <button className="mc-drawer-close" type="button" aria-label="Close workflow details" title="Close workflow details" onClick={() => setSelected(null)}>×</button>
            </div>
            {activeTab === "overview" && (
              <section className="workflow-drawer-header" aria-label="Workflow state summary">
                <div className="workflow-drawer-meta-grid">
                  <WorkflowInfo label="Owner" value={selected.agentName || selected.agentId} />
                  <WorkflowInfo label="Risk" value={selected.risk} />
                  <WorkflowInfo label="Autonomy" value={workflowAutonomy(selected)} />
                  <WorkflowInfo label="Needs human" value={String(selected.approvalGates.length)} />
                  <WorkflowInfo label="Updated" value={formatWorkflowUpdated(selected.updatedAt)} />
                </div>
                <div className="workflow-drawer-progress" aria-label={`${workflowProgress(selected)}% workflow readiness`}>
                  <span>{workflowProgress(selected)}% ready</span>
                  <span className="project-progress-track" aria-hidden="true"><span className="project-progress-fill" style={{ width: `${workflowProgress(selected)}%` }} /></span>
                </div>
              </section>
            )}
            <nav className="workflow-detail-tabs" aria-label="Workflow detail sections">
              {workflowDetailTabs.map((tab) => {
                const count = workflowTabCount(selected, tab);
                return <button key={tab} type="button" className={activeTab === tab ? "on" : ""} aria-current={activeTab === tab ? "page" : undefined} onClick={() => setActiveTab(tab)}>{workflowDetailLabels[tab]}{count > 0 && <span className="mc-tab-count">{count}</span>}</button>;
              })}
            </nav>
            {/* Funnel schedule UI remains in the detail drawer via WorkflowTabBody: selected.id === "website-funnel-check" renders workflow-funnel-settings and "Schedule recurring check" under Rules. */}
            <WorkflowTabBody workflow={selected} tab={activeTab} funnelTargetUrl={funnelTargetUrl} funnelSchedule={funnelSchedule} setFunnelTargetUrl={setFunnelTargetUrl} setFunnelSchedule={setFunnelSchedule} scheduleFunnelWorkflow={(workflow) => void scheduleFunnelWorkflow(workflow)} launching={launching} />
          </aside>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, sub, tone }: { label: string; value: number | string; sub: string; tone?: "good" }) {
  return (
    <div className={`workflow-metric ${tone ?? ""}`}>
      <span>{label}</span>
      <b>{value}</b>
      <small>{sub}</small>
    </div>
  );
}
