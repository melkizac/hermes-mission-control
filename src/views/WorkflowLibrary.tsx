import { useEffect, useState } from "react";
import type { PackagedWorkflow, WorkflowLibraryResponse } from "../types";
import { HttpHermesClient } from "../services/httpHermesClient";
import { ArtifactCard, EvidenceTimeline, RiskBadges } from "../components/MissionFoundation";
import { Icon } from "../components/Icon";

const client = new HttpHermesClient();

function compact(value: number | undefined | null) {
  return Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value ?? 0);
}

export function WorkflowLibrary() {
  const [data, setData] = useState<WorkflowLibraryResponse | null>(null);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState<PackagedWorkflow | null>(null);
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
          <h1>Workflow library</h1>
          <p>
            Launch repeatable SME operating loops with linked skills, built-in evidence requirements, artifacts, and approval gates.
          </p>
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
        <div className="workflow-filter-note">Evidence-ready workflows launch as Task Board items, not hidden chats.</div>
      </section>

      {error && <div className="skills-error">{error}</div>}
      {launchNote && <div className="workflow-launch-note">{launchNote}</div>}

      <div className="workflow-layout">
        <section className="workflow-grid">
          {workflows.map((workflow) => (
            <article className={`workflow-card ${selected?.id === workflow.id ? "on" : ""}`} data-testid="workflow-card" key={workflow.id}>
              <button className="workflow-card-main" onClick={() => setSelected(workflow)}>
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
          <aside className="workflow-detail-drawer" data-testid="workflow-detail-drawer" aria-label="Selected workflow details">
            <div className="workflow-detail-head">
              <div>
                <span>Evidence-ready template</span>
                <h2>{selected.name}</h2>
                <p>{selected.idealFor}</p>
              </div>
              <button className="mc-drawer-close" type="button" aria-label="Close workflow details" title="Close workflow details" onClick={() => setSelected(null)}>×</button>
            </div>
            <div className="workflow-detail-section">
              <b>Linked skills</b>
              <div className="workflow-chips strong">{selected.skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
            </div>
            {selected.id === "website-funnel-check" && (
              <div className="workflow-detail-section workflow-funnel-settings">
                <b>No-submit funnel schedule</b>
                <label className="workflow-funnel-target">
                  <span>targetUrl for no-submit funnel check</span>
                  <input value={funnelTargetUrl} onChange={(event) => setFunnelTargetUrl(event.target.value)} placeholder="https://example.com/contact" />
                  <span>schedule cron for recurring check</span>
                  <input value={funnelSchedule} onChange={(event) => setFunnelSchedule(event.target.value)} placeholder="0 9 * * 1" />
                  <small>NO_SUBMIT is enforced; Mission Control blocks before external form submit.</small>
                  <button className="ghost tiny" type="button" disabled={launching === `${selected.id}:schedule`} onClick={() => void scheduleFunnelWorkflow(selected)}>{launching === `${selected.id}:schedule` ? "Scheduling…" : "Schedule recurring check"}</button>
                </label>
              </div>
            )}
            <div className="workflow-detail-section">
              <b>Steps</b>
              <ol className="workflow-steps">
                {selected.steps.map((step) => (
                  <li key={step.id}>
                    <span>{step.title}</span>
                    <small>{step.summary}</small>
                  </li>
                ))}
              </ol>
            </div>
            {selected.taskMaterialization?.enabled && (
              <div className="workflow-detail-section workflow-materialization">
                <b>Task Board materialization</b>
                <p>Daily planner output becomes Task Board cards under <span className="mono">{selected.taskMaterialization.taskBoardTenant}</span>.</p>
                <div className="workflow-chips strong">
                  <span>Assignee: {selected.taskMaterialization.assignee}</span>
                  <span>{selected.taskMaterialization.statuses.join(" → ")}</span>
                  <span>{selected.taskMaterialization.sourceOfTruth}</span>
                </div>
              </div>
            )}
            {(selected.routines?.length ?? 0) > 0 && (
              <div className="workflow-detail-section workflow-routines-linked">
                <b>Linked routines</b>
                <ol className="workflow-steps">
                  {selected.routines?.map((routine) => (
                    <li key={routine.id ?? routine.name}>
                      <span>{routine.label ?? routine.name}</span>
                      <small>{routine.schedule ?? "manual"} · {routine.enabled ? "enabled" : "paused"} · latest {routine.last_status ?? routine.status ?? "not-run"}</small>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            <div className="workflow-detail-section">
              <b>Artifacts</b>
              {selected.artifacts.map((artifact) => <ArtifactCard key={artifact.id} artifact={artifact} />)}
            </div>
            <div className="workflow-detail-section">
              <b>Evidence</b>
              <EvidenceTimeline evidence={selected.evidence} />
            </div>
            <div className="workflow-detail-section">
              <b>Approval gates</b>
              <ul className="workflow-approval-list">
                {selected.approvalGates.map((gate) => <li key={gate.id}>{gate.title} — {gate.reason}</li>)}
              </ul>
            </div>
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
