import { useEffect, useMemo, useState } from "react";
import type { CreateResearchRunRequest, ResearchRun, ResearchRunsResponse } from "../types";
import { HttpHermesClient } from "../services/httpHermesClient";
import { Icon } from "../components/Icon";

const client = new HttpHermesClient();

const laneTemplates = [
  { id: "market-scan", title: "Market scan", agentId: "melkizac", agentName: "Melkizac", focus: "Compare competitor positioning, ICP claims, pricing pages, and market language." },
  { id: "linkedin-signal", title: "LinkedIn signal scan", agentId: "content-ops", agentName: "Content Ops", focus: "Find operator-led LinkedIn themes and map them to Nexius POV." },
  { id: "browser-funnel-check", title: "Browser funnel check", agentId: "devops-builder", agentName: "DevOps Builder", focus: "Inspect websites, lead forms, and funnel proof points without submitting forms.", requiresApproval: true },
  { id: "internal-evidence", title: "Internal evidence review", agentId: "melkizac", agentName: "Melkizac", focus: "Connect Mission Control task/evidence history to research recommendations." },
];

const sourceTemplates = [
  { id: "competitor-sites", label: "Competitor and agency websites", kind: "web", ownerLaneId: "market-scan", notes: "Positioning, claims, service pages, pricing, and case-study language." },
  { id: "linkedin-posts", label: "LinkedIn operator posts", kind: "social", ownerLaneId: "linkedin-signal", notes: "High-signal posts and comments from operators, trainers, founders, and AI workflow builders." },
  { id: "client-funnels", label: "Client websites and lead forms", kind: "browser", ownerLaneId: "browser-funnel-check", notes: "Public funnel pages and lead-capture forms; submit/post/send actions require approval." },
  { id: "mission-control-evidence", label: "Mission Control task/evidence history", kind: "internal", ownerLaneId: "internal-evidence", notes: "Prior tasks, approvals, browser evidence, and result artifacts already tracked in Mission Control." },
];

function toggle<T extends { id: string }>(items: T[], item: T) {
  return items.some((x) => x.id === item.id) ? items.filter((x) => x.id !== item.id) : [...items, item];
}

function tone(status: string) {
  if (status === "completed" || status === "ready") return "good";
  if (status === "running" || status === "drafting") return "info";
  if (status === "blocked" || status === "error") return "warn";
  return "muted";
}

function pct(value: number) {
  return `${Math.max(0, Math.min(100, Math.round(value || 0)))}%`;
}

export function ResearchRuns() {
  const [payload, setPayload] = useState<ResearchRunsResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("Nexius wide research sprint");
  const [objective, setObjective] = useState("Compare market, LinkedIn, website funnel, and internal evidence signals before creating an operator-ready recommendation.");
  const [selectedLanes, setSelectedLanes] = useState(laneTemplates.slice(0, 3));
  const [selectedSources, setSelectedSources] = useState(sourceTemplates.slice(0, 3));
  const [creating, setCreating] = useState(false);
  const [createdNotice, setCreatedNotice] = useState<string | null>(null);

  async function load() {
    try {
      setError(null);
      const next = await client.listResearchRuns();
      setPayload(next);
      setSelectedId((current) => (current && next.runs.some((run) => run.id === current) ? current : null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load research runs");
    }
  }

  async function createRun() {
    if (!title.trim() || !objective.trim() || !selectedLanes.length) {
      setError("Title, objective, and at least one research lane are required.");
      return;
    }
    const input: CreateResearchRunRequest = {
      title: title.trim(),
      objective: objective.trim(),
      projectId: "research-runs",
      lanes: selectedLanes,
      sources: selectedSources,
    };
    try {
      setCreating(true);
      setError(null);
      setCreatedNotice(null);
      const response = await client.createResearchRun(input);
      setCreatedNotice(`Created tracked research run with ${response.trackedTaskIds.length} Task Board tasks.`);
      setPayload((current) => current ? { ...current, runs: [response.run, ...current.runs], summary: { ...current.summary, total: current.summary.total + 1, active_lanes: current.summary.active_lanes + response.run.lanes.length, source_coverage: current.summary.source_coverage + response.run.sourceCoverage.length, evidence_items: current.summary.evidence_items + response.run.evidence.length } } : current);
      setSelectedId(response.run.id);
      setDetailOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create research run");
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!detailOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDetailOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailOpen]);

  const runs = payload?.runs ?? [];
  const selected: ResearchRun | undefined = useMemo(
    () => runs.find((run) => run.id === selectedId),
    [runs, selectedId],
  );
  const summary = payload?.summary;

  return (
    <div className="research-page scroll">
      <header className="skills-hero research-hero">
        <div>
          <span className="stub-tag">PARALLEL RESEARCH</span>
          <h1>Research command center</h1>
          <p>Track wide research runs as parallel agent lanes with source coverage, confidence, blockers, synthesis progress, and final recommendation evidence before operators act on findings.</p>
        </div>
        <button className="task-icon-action dark" aria-label="Refresh research runs" title="Refresh research runs" onClick={() => void load()}>
          <Icon name="refresh" size={18} />
        </button>
      </header>

      <section className="skills-metrics research-metrics" aria-label="Research run metrics">
        <article className="skills-metric"><span>Runs</span><b>{summary?.total ?? 0}</b><small>Wide research missions</small></article>
        <article className="skills-metric info"><span>Active lanes</span><b>{summary?.active_lanes ?? 0}</b><small>Parallel agent workstreams</small></article>
        <article className="skills-metric warn"><span>Blocked lanes</span><b>{summary?.blocked_lanes ?? 0}</b><small>Need approval or input</small></article>
        <article className="skills-metric good"><span>Source coverage</span><b>{summary?.source_coverage ?? 0}</b><small>Reviewed / tracked sources</small></article>
        <article className="skills-metric"><span>Evidence</span><b>{summary?.evidence_items ?? 0}</b><small>Citations, screenshots, reports</small></article>
      </section>

      {error && <div className="skills-error">{error}</div>}
      {createdNotice && <div className="skills-success">{createdNotice}</div>}

      <section className="research-create-panel" data-testid="research-create-form" aria-label="Create wide research run">
        <div className="section-title"><h2>Create wide research run</h2><span>Bridge to Task Board + evidence results</span></div>
        <div className="research-create-grid">
          <label>Run title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Research run title" /></label>
          <label>Objective<textarea value={objective} onChange={(event) => setObjective(event.target.value)} placeholder="What should the parallel lanes discover and synthesize?" /></label>
        </div>
        <div className="research-selector-grid">
          <div>
            <h3>Choose lanes / agents</h3>
            <div className="research-choice-list">
              {laneTemplates.map((lane) => {
                const on = selectedLanes.some((item) => item.id === lane.id);
                return <button type="button" data-testid="research-lane-checkbox" key={lane.id} className={"research-choice" + (on ? " on" : "")} onClick={() => setSelectedLanes((items) => toggle(items, lane))}><b>{lane.title}</b><span>{lane.agentName}</span><small>{lane.focus}</small>{lane.requiresApproval && <em>Approval-gated browser actions</em>}</button>;
              })}
            </div>
          </div>
          <div>
            <h3>Choose source groups</h3>
            <div className="research-choice-list">
              {sourceTemplates.map((source) => {
                const on = selectedSources.some((item) => item.id === source.id);
                return <button type="button" data-testid="research-source-checkbox" key={source.id} className={"research-choice" + (on ? " on" : "")} onClick={() => setSelectedSources((items) => toggle(items, source))}><b>{source.label}</b><span>{source.kind}</span><small>{source.notes}</small></button>;
              })}
            </div>
          </div>
        </div>
        <div className="research-create-actions"><span>{selectedLanes.length} lanes · {selectedSources.length} source groups · tracked tasks/results will be created automatically</span><button className="btn primary" disabled={creating || !selectedLanes.length} onClick={() => void createRun()}>{creating ? "Creating…" : "Create tracked research run"}</button></div>
      </section>

      <div className="research-grid">
        <section className="research-run-list" aria-label="Research runs">
          <div className="section-title"><h2>Active research runs</h2><span>{payload?.updatedAt ?? "—"}</span></div>
          {runs.map((run) => (
            <button
              key={run.id}
              data-testid="research-run-card"
              className={"research-run-card" + (selected?.id === run.id ? " on" : "")}
              onClick={() => { setSelectedId(run.id); setDetailOpen(true); }}
            >
              <div><b>{run.title}</b><span className={`tag ${tone(run.status)}`}>{run.status}</span></div>
              <p>{run.summary}</p>
              <small>{run.lanes.length} lanes · {run.sourceCoverage.length} sources · synthesis {run.synthesis.progress}%</small>
            </button>
          ))}
          {!runs.length && <div className="mc-empty"><h3>No research runs yet</h3><p>Launch a wide research task to see lanes, sources, and synthesis here.</p></div>}
        </section>

      </div>

      {selected && detailOpen && (
        <div className="research-detail-layer" role="presentation">
          <button className="research-detail-scrim" aria-label="Close research run details" onClick={() => setDetailOpen(false)} />
          <aside className="research-detail-drawer" data-testid="research-detail-drawer" aria-label="Selected research run">
            <div className="research-detail-head">
              <div>
                <span className="stub-tag">{selected.owner}</span>
                <h2>{selected.title}</h2>
                <p>{selected.summary}</p>
              </div>
              <button className="btn ghost" type="button" onClick={() => setDetailOpen(false)} aria-label="Close research run details">Close</button>
            </div>
            <div className="research-detail-actions">
              <span className={`tag ${tone(selected.status)}`}>{selected.status}</span>
              {selected.taskId && <a className="research-task-link" href={`/app?view=board&task=${encodeURIComponent(selected.taskId)}`}>Open parent task</a>}
            </div>

            <section className="research-lanes">
              <div className="section-title"><h3>Parallel research lanes</h3><span>{selected.lanes.length} lanes</span></div>
              <div className="research-lane-grid">
                {selected.lanes.map((lane) => (
                  <article className="research-lane-card" data-testid="research-lane-card" key={lane.id}>
                    <div className="row between"><b>{lane.title}</b><span className={`tag ${tone(lane.status)}`}>{lane.status}</span></div>
                    <p>{lane.focus}</p>
                    <div className="research-progress" aria-label={`${lane.title} progress ${lane.progress}%`}><i style={{ width: pct(lane.progress) }} /></div>
                    <dl className="mini-kv"><div><dt>Agent</dt><dd>{lane.agentName}</dd></div><div><dt>Current step</dt><dd>{lane.currentStep}</dd></div><div><dt>Sources</dt><dd>{lane.sourcesReviewed}</dd></div><div><dt>Evidence</dt><dd>{lane.evidenceCount}</dd></div><div><dt>Confidence</dt><dd>{lane.confidence}</dd></div></dl>
                    {lane.taskId && <a className="research-task-link" href={`/app?view=board&task=${encodeURIComponent(lane.taskId)}`}>Open tracked task/result</a>}
                    {lane.blocker && <div className="research-blocker">{lane.blocker}</div>}
                  </article>
                ))}
              </div>
            </section>

            <section className="source-coverage">
              <div className="section-title"><h3>Source coverage</h3><span>{selected.sourceCoverage.length} sources</span></div>
              <div className="source-coverage-grid">
                {selected.sourceCoverage.map((source) => (
                  <article className="source-card" key={source.id}>
                    <div className="row between"><b>{source.label}</b><span className={`tag ${tone(source.status)}`}>{source.status}</span></div>
                    <p>{source.notes}</p>
                    <small>{source.kind} · confidence {source.confidence}</small>
                  </article>
                ))}
              </div>
            </section>

            <section className="synthesis-panel">
              <div>
                <span className="stub-tag">Synthesis progress</span>
                <h3>Synthesis progress</h3>
                <p>{selected.synthesis.recommendation}</p>
              </div>
              <div className="synthesis-meter"><b>{selected.synthesis.progress}%</b><div className="research-progress"><i style={{ width: pct(selected.synthesis.progress) }} /></div><span>{selected.synthesis.status} · lead {selected.synthesis.leadAgent}</span></div>
              {!!selected.synthesis.openQuestions.length && <ul>{selected.synthesis.openQuestions.map((q) => <li key={q}>{q}</li>)}</ul>}
            </section>

            <section className="research-evidence">
              <div className="section-title"><h3>Evidence and final recommendation</h3><span>Final synthesis / recommendation evidence</span></div>
              <article className="artifact-card final"><b>{selected.finalArtifact.title}</b><p>{selected.finalArtifact.summary}</p></article>
              <div className="research-evidence-list">
                {selected.evidence.map((item) => <article key={item.id}><b>{item.title}</b><p>{item.summary}</p><small>{item.kind} · {item.source}</small></article>)}
              </div>
              <div className="research-next-actions"><b>Next actions</b><ul>{selected.nextActions.map((action) => <li key={action}>{action}</li>)}</ul></div>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
