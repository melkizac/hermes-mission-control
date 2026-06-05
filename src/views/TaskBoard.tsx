import { useEffect, useMemo, useState } from "react";
import type { Agent, BoardStatus, BoardTask } from "../types";
import { ArtifactCard, EvidenceTimeline, ResultSummaryPanel } from "../components/MissionFoundation";
import { HttpHermesClient } from "../services/httpHermesClient";
import { useStore } from "../services/store";
import { parseMissionControlDeepLink } from "../services/deepLinks";
import { formatSingaporeTime } from "../utils/time";
import { SlideOverDrawer } from "../components/SlideOverDrawer";
import { Icon } from "../components/Icon";

const client = new HttpHermesClient();
const TASK_PAGE_SIZE = 5;
const initialLaneCounts = (): Record<BoardStatus, number> => ({ queued: TASK_PAGE_SIZE, running: TASK_PAGE_SIZE, blocked: TASK_PAGE_SIZE, done: TASK_PAGE_SIZE, error: TASK_PAGE_SIZE });
const lanes: { key: BoardStatus; label: string; helper: string }[] = [
  { key: "queued", label: "Queued", helper: "Ready for a worker" },
  { key: "running", label: "Running", helper: "Claimed or in progress" },
  { key: "blocked", label: "Blocked", helper: "Needs human or dependency" },
  { key: "done", label: "Done", helper: "Completed evidence" },
  { key: "error", label: "Error", helper: "Crashed or failed" },
];

type DetailTab = "overview" | "activity" | "execution";
type ViewMode = "cards" | "list";
type HumanActionKind = "feedback" | "approval" | "manual" | "agent";

export function TaskBoard() {
  const { agents, select, setView } = useStore();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<BoardStatus | "">("");
  const [assignee, setAssignee] = useState("");
  const [project, setProject] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [tasks, setTasks] = useState<BoardTask[]>([]);
  const [summary, setSummary] = useState({ total: 0, queued: 0, running: 0, blocked: 0, done: 0, error: 0, assignees: [] as string[], projects: [] as string[] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", body: "", assignee: "", priority: 50, tenant: "" });
  const [comment, setComment] = useState("");
  const [humanNote, setHumanNote] = useState("");
  const [agentTarget, setAgentTarget] = useState("");
  const [laneVisibleCounts, setLaneVisibleCounts] = useState<Record<BoardStatus, number>>(() => initialLaneCounts());
  const [listVisibleCount, setListVisibleCount] = useState(TASK_PAGE_SIZE);
  const deepLinkedTaskId = useMemo(() => parseMissionControlDeepLink(window.location).taskId ?? null, []);

  const load = async () => {
    try {
      setLoading(true);
      const data = await client.listBoard({ q, status, assignee, project });
      setTasks(data.tasks);
      setSummary({ ...data.summary, projects: data.summary.projects ?? data.projects ?? [] });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load task board");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 180);
    return () => window.clearTimeout(timer);
  }, [q, status, assignee, project]);

  useEffect(() => {
    setLaneVisibleCounts(initialLaneCounts());
    setListVisibleCount(TASK_PAGE_SIZE);
  }, [q, status, assignee, project, viewMode]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  useEffect(() => {
    if (!deepLinkedTaskId || loading) return;
    if (selectedId === deepLinkedTaskId) return;
    const found = tasks.find((task) => task.id === deepLinkedTaskId);
    if (found) {
      setSelectedId(found.id);
      setDetailTab("overview");
      void client.getTaskResult(deepLinkedTaskId).then((result) => {
        if (!result.ok || !result.task) return;
        setTasks((current) => current.map((item) => item.id === deepLinkedTaskId ? { ...item, ...result.task, mission_result: result.mission_result ?? result.task?.mission_result ?? null } : item));
      }).catch(() => undefined);
    } else {
      setNotice(`Deep-linked task ${deepLinkedTaskId} is not visible in the current board filters.`);
    }
  }, [deepLinkedTaskId, loading, selectedId, tasks]);

  const selected = useMemo(() => tasks.find((task) => task.id === selectedId), [tasks, selectedId]);
  const availableAgents = useMemo(() => agents.filter((agent) => agent.id), [agents]);

  const openTask = (task: BoardTask) => {
    setSelectedId(task.id);
    setDetailTab("overview");
    setHumanNote("");
    setAgentTarget("");
    void client.getTaskResult(task.id).then((result) => {
      if (!result.ok || !result.task) return;
      setTasks((current) => current.map((item) => item.id === task.id ? { ...item, ...result.task, mission_result: result.mission_result ?? result.task?.mission_result ?? null } : item));
    }).catch(() => undefined);
  };

  const create = async () => {
    if (!draft.title.trim()) return setError("Title required");
    try {
      const result = await client.createBoardTask({ ...draft, status: "queued" });
      if (!result.ok) throw new Error(result.error || "Create failed");
      setNotice(`Created issue: ${result.task?.title}`);
      setDraft({ title: "", body: "", assignee: "", priority: 50, tenant: "" });
      setShowCreate(false);
      setSelectedId(result.task?.id ?? null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  };

  const move = async (task: BoardTask, next: BoardStatus) => {
    try {
      const result = await client.updateBoardTask(task.id, { status: next });
      if (!result.ok) throw new Error(result.error || "Update failed");
      setNotice(`${task.title} moved to ${next}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  };

  const saveAssignee = async (task: BoardTask, nextAssignee: string) => {
    try {
      const result = await client.updateBoardTask(task.id, { assignee: nextAssignee });
      if (!result.ok) throw new Error(result.error || "Update failed");
      setNotice(`Updated assignee for ${task.title}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  };

  const addComment = async () => {
    if (!selected || !comment.trim()) return;
    try {
      const result = await client.addBoardComment(selected.id, comment);
      if (!result.ok) throw new Error(result.error || "Comment failed");
      setComment("");
      setNotice("Comment added");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Comment failed");
    }
  };


  const addTaskComment = async (task: BoardTask, body: string) => {
    const result = await client.addBoardComment(task.id, body);
    if (!result.ok) throw new Error(result.error || "Comment failed");
  };

  const handleHumanAction = async (task: BoardTask, kind: HumanActionKind, note = "") => {
    const trimmed = note.trim();
    try {
      if (kind === "feedback") {
        if (!trimmed) return setError("Enter your feedback or instruction first.");
        await addTaskComment(task, `Melverick feedback / instruction:\n${trimmed}`);
        if (task.status === "blocked") await client.updateBoardTask(task.id, { status: "queued" });
        setNotice("Feedback saved and task returned to the queue");
      } else if (kind === "approval") {
        await addTaskComment(task, `Melverick approved this task.${trimmed ? `\nNote: ${trimmed}` : ""}`);
        await client.updateBoardTask(task.id, { status: "done", result: trimmed || "Approved by Melverick" });
        setNotice("Approval recorded and task marked done");
      } else if (kind === "manual") {
        await addTaskComment(task, `Melverick completed the requested manual step.${trimmed ? `\nEvidence / note: ${trimmed}` : ""}`);
        await client.updateBoardTask(task.id, { status: "done", result: trimmed || "Manual step completed by Melverick" });
        setNotice("Manual completion recorded and task marked done");
      }
      setHumanNote("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Task action failed");
    }
  };

  const assignToAgentAndOpenChat = async (task: BoardTask) => {
    const target = agentTarget || availableAgents[0]?.id || "";
    if (!target) return setError("No agent is available to assign this task.");
    const agent = availableAgents.find((item) => item.id === target);
    try {
      const label = agent?.name || target;
      await client.updateBoardTask(task.id, { assignee: target, status: "queued" });
      await addTaskComment(task, `Assigned to agent ${label}. Opened agent chat for follow-up. Task: ${task.title}`);
      setNotice(`Assigned to ${label}; opening agent chat`);
      await load();
      select(target);
      setView("agents");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Agent assignment failed");
    }
  };

  const remove = async (task: BoardTask) => {
    if (!window.confirm(`Delete ${task.title}?`)) return;
    try {
      await client.deleteBoardTask(task.id);
      setSelectedId(null);
      setNotice("Issue deleted");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const grouped = useMemo(() => lanes.reduce((acc, lane) => ({ ...acc, [lane.key]: tasks.filter((task) => task.status === lane.key) }), {} as Record<BoardStatus, BoardTask[]>), [tasks]);
  const visibleListTasks = useMemo(() => tasks.slice(0, listVisibleCount), [tasks, listVisibleCount]);
  const showMoreLane = (lane: BoardStatus) => setLaneVisibleCounts((current) => ({ ...current, [lane]: current[lane] + TASK_PAGE_SIZE }));

  return (
    <div className="task-page task-board-first scroll">
      <header className="task-hero task-hero-compact">
        <div className="task-hero-copy">
          <span className="stub-tag">ACTION TRACKER</span>
          <div className="task-title-row">
            <h1>Task Board</h1>
            <div className="task-title-actions" aria-label="Task board actions">
              <button
                className={"task-icon-action primary" + (showCreate ? " on" : "")}
                aria-label={showCreate ? "Close add action form" : "Add action"}
                title={showCreate ? "Close add action form" : "Add action"}
                onClick={() => setShowCreate((value) => !value)}
              >
                <Icon name="plus" size={18} />
              </button>
              <button className="task-icon-action dark" aria-label="Refresh task board" title="Refresh task board" onClick={() => void load()}>
                <Icon name="refresh" size={18} />
              </button>
            </div>
          </div>
          <p>Board-first operating view. Click a card to inspect details in a temporary drawer without shrinking the Kanban lanes.</p>
        </div>
      </header>

      <section className="task-metrics task-metrics-compact">
        <Metric label="Total" value={summary.total} sub="tracked issues" />
        <Metric label="Open" value={summary.queued + summary.running} sub="queued + running" />
        <Metric label="Blocked" value={summary.blocked} sub="needs attention" tone={summary.blocked ? "bad" : "good"} />
        <Metric label="Done" value={summary.done} sub="completed" tone="good" />
      </section>

      {showCreate && (
        <section className="task-create task-create-collapsed">
          <div className="task-create-main">
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Add an issue or action item…" />
            <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} placeholder="Context, acceptance criteria, source evidence…" />
          </div>
          <div className="task-create-side">
            <input value={draft.assignee} onChange={(e) => setDraft({ ...draft, assignee: e.target.value })} placeholder="Assignee/profile" />
            <input value={draft.tenant} onChange={(e) => setDraft({ ...draft, tenant: e.target.value })} placeholder="Project/tenant" />
            <select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })}>
              <option value={20}>Medium</option><option value={50}>High</option><option value={80}>Critical</option><option value={0}>Low</option>
            </select>
            <button className="btn primary" onClick={() => void create()}>Add Action</button>
          </div>
        </section>
      )}

      <section className="task-filters task-filters-board-first">
        <div className="filter-search-with-view task-search-with-view">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ID, title, body, owner, project, skill…" />
          <div className="view-switch filter-view-switch" aria-label="Task board view mode">
            <button className={viewMode === "cards" ? "on" : ""} onClick={() => setViewMode("cards")}>Cards</button>
            <button className={viewMode === "list" ? "on" : ""} onClick={() => setViewMode("list")}>List</button>
          </div>
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as BoardStatus | "")}><option value="">All status</option>{lanes.map((lane) => <option key={lane.key} value={lane.key}>{lane.label}</option>)}</select>
        <select value={assignee} onChange={(e) => setAssignee(e.target.value)}><option value="">All owners</option>{summary.assignees.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        <select value={project} onChange={(e) => setProject(e.target.value)}><option value="">All projects</option>{summary.projects.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        <span>{loading ? "Loading…" : `${tasks.length} issues shown`}</span>
      </section>

      {notice && <div className="task-notice">{notice}</div>}
      {error && <div className="task-error">{error}</div>}

      {viewMode === "cards" ? (
        <section className="task-kanban task-kanban-full">
          {lanes.map((lane) => {
            const laneTasks = grouped[lane.key] ?? [];
            const visibleTasks = laneTasks.slice(0, laneVisibleCounts[lane.key]);
            const remaining = Math.max(0, laneTasks.length - visibleTasks.length);
            return (
              <div className="task-lane" key={lane.key}>
                <div className="task-lane-head"><div><b>{lane.label}</b><small>{lane.helper}</small></div><span>{laneTasks.length}</span></div>
                {visibleTasks.map((task) => <TaskCard key={task.id} task={task} selected={selected?.id === task.id} onSelect={() => openTask(task)} onMove={move} onDelete={remove} />)}
                {laneTasks.length === 0 && <div className="empty task-empty">No cards</div>}
                {remaining > 0 && <button className="task-view-more" onClick={() => showMoreLane(lane.key)}>View More <span>{Math.min(TASK_PAGE_SIZE, remaining)} more</span></button>}
              </div>
            );
          })}
        </section>
      ) : (
        <section className="ops-list task-list-view">
          <div className="ops-list-head"><span>Issue list</span><small>{loading ? "Loading…" : `${visibleListTasks.length} of ${tasks.length} shown`}</small></div>
          {visibleListTasks.map((task) => <TaskListRow key={task.id} task={task} active={selected?.id === task.id} onSelect={() => openTask(task)} />)}
          {!loading && tasks.length === 0 && <div className="empty big">No issues matched this filter.</div>}
          {tasks.length > visibleListTasks.length && <button className="task-view-more task-list-view-more" onClick={() => setListVisibleCount((count) => count + TASK_PAGE_SIZE)}>View More <span>{Math.min(TASK_PAGE_SIZE, tasks.length - visibleListTasks.length)} more</span></button>}
        </section>
      )}

      {selected && (
        <TaskDetailDrawer
          task={selected}
          tab={detailTab}
          setTab={setDetailTab}
          comment={comment}
          setComment={setComment}
          onClose={() => setSelectedId(null)}
          onMove={move}
          onDelete={remove}
          onSaveAssignee={saveAssignee}
          onAddComment={addComment}
          humanNote={humanNote}
          setHumanNote={setHumanNote}
          onHumanAction={handleHumanAction}
          agents={availableAgents}
          agentTarget={agentTarget}
          setAgentTarget={setAgentTarget}
          onAssignToAgent={assignToAgentAndOpenChat}
        />
      )}
    </div>
  );
}


function TaskListRow({ task, active, onSelect }: { task: BoardTask; active: boolean; onSelect: () => void }) {
  return (
    <button className={`ops-row task-list-row ${active ? "on" : ""}`} onClick={onSelect}>
      <div className="ops-row-main">
        <div className="ops-row-top">
          <b>{task.title}</b>
          <span className={`tag ${task.status === "blocked" || task.status === "error" ? "warn" : task.status === "done" ? "good" : "muted"}`}>{task.status}</span>
        </div>
        <p>{task.body || "No description yet."}</p>
        <small className="mono">{task.id}</small>
      </div>
      <div className="ops-row-meta">
        <span>{task.assignee || "unassigned"}</span>
        <small>{formatSingaporeTime(task.updated_at)}</small>
        <em>{task.priority_label} · {task.tenant || task.workspace_kind || "no project"}</em>
      </div>
    </button>
  );
}

function TaskDetailDrawer({ task, tab, setTab, comment, setComment, onClose, onMove, onDelete, onSaveAssignee, onAddComment, humanNote, setHumanNote, onHumanAction, agents, agentTarget, setAgentTarget, onAssignToAgent }: {
  task: BoardTask;
  tab: DetailTab;
  setTab: (tab: DetailTab) => void;
  comment: string;
  setComment: (value: string) => void;
  onClose: () => void;
  onMove: (task: BoardTask, status: BoardStatus) => void;
  onDelete: (task: BoardTask) => void;
  onSaveAssignee: (task: BoardTask, assignee: string) => void;
  onAddComment: () => void;
  humanNote: string;
  setHumanNote: (value: string) => void;
  onHumanAction: (task: BoardTask, kind: HumanActionKind, note?: string) => void;
  agents: Agent[];
  agentTarget: string;
  setAgentTarget: (value: string) => void;
  onAssignToAgent: (task: BoardTask) => void;
}) {
  const intent = classifyHumanTask(task);
  return (
    <SlideOverDrawer
      title={task.title}
      subtitle={<span className="mono">{task.id}</span>}
      eyebrow={task.status}
      statusClassName={`tag ${task.status === "blocked" || task.status === "error" ? "warn" : "good"}`}
      onClose={onClose}
      closeLabel="Close task details"
      ariaLabel="Task details"
      dataDeepLinkTarget="task"
      // rendered attribute: data-deeplink-target="task"
      tabs={["overview", "activity", "execution"] as const}
      activeTab={tab}
      onTabChange={setTab}
      className="task-detail task-detail-drawer"
    >

        {tab === "overview" && (
          <>
            <div className="task-kv">
              <Info label="Owner" value={task.assignee} />
              <Info label="Priority" value={`${task.priority_label} · ${task.priority}`} />
              <Info label="Updated" value={formatSingaporeTime(task.updated_at)} />
              <Info label="Source" value={task.created_by} />
              <Info label="Project" value={task.tenant || "—"} />
              <Info label="Workspace" value={task.workspace_path || task.workspace_kind} />
            </div>
            <div className="task-drawer-actions">
              <select value={task.status} onChange={(e) => void onMove(task, e.target.value as BoardStatus)}>{lanes.map((lane) => <option value={lane.key} key={lane.key}>{lane.label}</option>)}</select>
              <button className="ghost tiny danger" onClick={() => void onDelete(task)}>Delete</button>
            </div>
            <label className="task-inline-edit"><span>Assign owner/profile</span><input defaultValue={task.assignee === "unassigned" ? "" : task.assignee} onBlur={(e) => e.target.value !== task.assignee && void onSaveAssignee(task, e.target.value)} /></label>
            <TaskMissionResultView task={task} />
            <StructuredResult task={task} />
            <HumanActionPanel task={task} intent={intent} note={humanNote} setNote={setHumanNote} onHumanAction={onHumanAction} agents={agents} agentTarget={agentTarget} setAgentTarget={setAgentTarget} onAssignToAgent={onAssignToAgent} />
            <section className="task-section"><h3>Description</h3><pre>{task.body || "No description yet."}</pre></section>
            {task.result && <section className="task-section"><h3>Raw result</h3><pre>{task.result}</pre></section>}
          </>
        )}

        {tab === "activity" && (
          <>
            <section className="task-section"><h3>Comments</h3>{task.comments.length === 0 && <div className="empty">No comments yet.</div>}{task.comments.map((c) => <div className="task-comment" key={c.id ?? c.created_at}><b>{c.author}</b><small>{formatSingaporeTime(c.created_at)}</small><p>{c.body}</p></div>)}<textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add an operator note…" /><button className="ghost tiny" onClick={() => void onAddComment()}>Add comment</button></section>
            <section className="task-section"><h3>Events</h3>{task.events.length === 0 && <div className="empty">No events recorded.</div>}{task.events.map((event) => <div className="task-event" key={event.id ?? event.created_at}><b>{event.kind}</b><small>{formatSingaporeTime(event.created_at)}</small></div>)}</section>
          </>
        )}

        {tab === "execution" && (
          <>
            <section className="task-section"><h3>Skills / Links</h3><div className="task-chip-cloud">{(task.skills.length ? task.skills : ["No skills attached"]).map((skill) => <span key={skill}>{skill}</span>)}{task.session_id && <em>session: {task.session_id}</em>}{task.parents.map((id) => <em key={id}>parent: {id}</em>)}{task.children.map((id) => <em key={id}>child: {id}</em>)}</div></section>
            <section className="task-section"><h3>Run trace</h3>{task.runs.length === 0 && <div className="empty">No worker runs yet.</div>}{task.runs.map((run) => <div className="task-run" key={run.id}><b>{run.profile || "worker"} · {run.status}</b><small>{formatSingaporeTime(run.started_at)} {run.outcome ? `· ${run.outcome}` : ""}</small><p>{run.summary || run.error || "No summary recorded."}</p></div>)}</section>
          </>
        )}
    </SlideOverDrawer>
  );
}

function Metric({ label, value, sub, tone }: { label: string; value: number | string; sub: string; tone?: "good" | "bad" }) {
  return <div className={`task-metric ${tone ?? ""}`}><span>{label}</span><b>{value}</b><small>{sub}</small></div>;
}

function TaskCard({ task, selected, onSelect, onMove, onDelete }: { task: BoardTask; selected: boolean; onSelect: () => void; onMove: (task: BoardTask, status: BoardStatus) => void; onDelete: (task: BoardTask) => void }) {
  return (
    <article className={`task-card ${selected ? "on" : ""}`}>
      <button className="task-card-main" onClick={onSelect}>
        <div className="task-card-top"><span className={`priority ${task.priority_label}`}>{task.priority_label}</span><small>{formatSingaporeTime(task.updated_at)}</small></div>
        <small className="mono">{task.id}</small>
        <h2>{task.title}</h2><p>{task.body || "No detail yet."}</p>
        <div className="task-card-meta"><span>{task.assignee}</span><span>{task.created_by}</span>{task.tenant && <span>{task.tenant}</span>}</div>
      </button>
      <footer><select value={task.status} onChange={(e) => void onMove(task, e.target.value as BoardStatus)}>{lanes.map((lane) => <option value={lane.key} key={lane.key}>{lane.label}</option>)}</select><button className="ghost tiny danger" onClick={() => void onDelete(task)}>Delete</button></footer>
    </article>
  );
}


function TaskMissionResultView({ task }: { task: BoardTask }) {
  const result = task.mission_result;
  const artifacts = result?.artifacts ?? task.result_details?.artifacts ?? [];
  const evidence = result?.evidence ?? task.result_details?.evidence ?? [];
  const approvalGates = result?.approvalGates ?? task.result_details?.approval_gates ?? [];
  const nextActions = result?.nextActions ?? task.result_details?.next_actions ?? [];
  if (!result && artifacts.length === 0 && evidence.length === 0 && approvalGates.length === 0 && nextActions.length === 0) return null;
  return (
    <section className="task-section task-mission-result-view">
      <div className="task-result-heading"><span className="stub-tag">Proof of work</span><h3>Artifact / evidence result view</h3></div>
      {result && <ResultSummaryPanel result={result} />}
      {artifacts.length > 0 && <div className="task-result-block"><h4>Artifacts</h4><div className="mc-artifact-grid">{artifacts.map((artifact) => <ArtifactCard key={artifact.id} artifact={artifact} />)}</div></div>}
      {evidence.length > 0 && <div className="task-result-block"><h4>Evidence</h4><EvidenceTimeline evidence={evidence} /></div>}
      {approvalGates.length > 0 && <div className="task-result-block"><h4>Approval gates</h4>{approvalGates.map((gate) => <div className="task-approval-gate" key={gate.id}><b>{gate.title}</b><span>{gate.status} · {gate.risk}</span><p>{gate.reason}</p></div>)}</div>}
      {nextActions.length > 0 && <div className="task-result-block"><h4>Next actions</h4><ul>{nextActions.map((action) => <li key={action}>{action}</li>)}</ul></div>}
    </section>
  );
}

function StructuredResult({ task }: { task: BoardTask }) {
  const details = task.result_details;
  if (!details) return null;
  const blockers = details.blockers ?? [];
  const verification = Object.entries(details.verification ?? {});
  return (
    <section className={`task-section structured-result ${blockers.length ? "has-blockers" : ""}`}>
      <h3>{blockers.length ? "Blockers" : "Structured result"}</h3>
      {details.summary && <p>{details.summary}</p>}
      {blockers.length > 0 && <ul>{blockers.map((item) => <li key={item}>{item}</li>)}</ul>}
      {details.access_needed && <p><b>Access needed:</b> {details.access_needed}</p>}
      {verification.length > 0 && (
        <div className="task-chip-cloud">
          {verification.map(([key, value]) => <em key={key}>{key}: {value}</em>)}
        </div>
      )}
      {details.artifact && <p className="mono">artifact: {details.artifact}</p>}
    </section>
  );
}

function classifyHumanTask(task: BoardTask): HumanActionKind {
  const text = `${task.title} ${task.body} ${task.comments.map((c) => c.body).join(" ")}`.toLowerCase();
  if (/approve|approval|review and approve|sign[- ]?off|greenlight|go ahead/.test(text)) return "approval";
  if (/manual|completed manually|perform|do this|done by melverick|send this yourself|call|upload|submit|login|connect|verify/.test(text)) return "manual";
  if (/feedback|instruction|input|clarify|confirm|decide|choose|provide|direction|preference/.test(text)) return "feedback";
  return task.status === "blocked" ? "feedback" : "agent";
}

function HumanActionPanel({ task, intent, note, setNote, onHumanAction, agents, agentTarget, setAgentTarget, onAssignToAgent }: {
  task: BoardTask;
  intent: HumanActionKind;
  note: string;
  setNote: (value: string) => void;
  onHumanAction: (task: BoardTask, kind: HumanActionKind, note?: string) => void;
  agents: Agent[];
  agentTarget: string;
  setAgentTarget: (value: string) => void;
  onAssignToAgent: (task: BoardTask) => void;
}) {
  const copy = {
    feedback: { label: "Needs your feedback / instruction", helper: "Type the decision, constraints, or clarification agents need. This records a comment and re-queues blocked work.", cta: "Save feedback & unblock" },
    approval: { label: "Waiting for approval", helper: "Use this when the agent only needs a yes/go-ahead. Optional note is recorded as approval context.", cta: "Approve" },
    manual: { label: "Manual step assigned to you", helper: "Use this after you have performed the real-world/manual action. Optional note can include evidence or outcome.", cta: "I completed this" },
    agent: { label: "Can be assigned to an agent", helper: "If this should no longer sit with you, assign it to an agent and jump straight into that agent chat.", cta: "Assign to agent" },
  }[intent];

  return (
    <section className={`task-section human-action-panel intent-${intent}`}>
      <div className="human-action-head">
        <div>
          <span className="stub-tag">HUMAN HANDOFF</span>
          <h3>{copy.label}</h3>
          <p>{copy.helper}</p>
        </div>
        <span className={`tag ${intent === "approval" || intent === "manual" ? "warn" : "muted"}`}>{intent}</span>
      </div>
      {(intent === "feedback" || intent === "approval" || intent === "manual") && (
        <>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={intent === "feedback" ? "Enter feedback/instructions for the agent…" : "Optional note / evidence…"} />
          <div className="human-action-buttons">
            <button className={intent === "approval" ? "btn primary" : "ghost tiny"} onClick={() => void onHumanAction(task, intent, note)}>{copy.cta}</button>
            {intent !== "feedback" && <button className="ghost tiny" onClick={() => { setNote(""); void onHumanAction(task, "feedback", "Need changes / more information before approval or completion."); }}>Need changes</button>}
          </div>
        </>
      )}
      <div className="agent-handoff-row">
        <select value={agentTarget} onChange={(e) => setAgentTarget(e.target.value)} aria-label="Assign task to agent">
          <option value="">Choose agent…</option>
          {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
        </select>
        <button className="ghost tiny" onClick={() => void onAssignToAgent(task)}>Assign to agent & open chat</button>
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="task-info"><span>{label}</span><b>{value}</b></div>;
}
