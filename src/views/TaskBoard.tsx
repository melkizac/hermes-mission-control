import { useEffect, useMemo, useState } from "react";
import type { BoardStatus, BoardTask } from "../types";
import { HttpHermesClient } from "../services/httpHermesClient";
import { formatSingaporeTime } from "../utils/time";

const client = new HttpHermesClient();
const lanes: { key: BoardStatus; label: string; helper: string }[] = [
  { key: "queued", label: "Queued", helper: "Ready for a worker" },
  { key: "running", label: "Running", helper: "Claimed or in progress" },
  { key: "blocked", label: "Blocked", helper: "Needs human or dependency" },
  { key: "done", label: "Done", helper: "Completed evidence" },
  { key: "error", label: "Error", helper: "Crashed or failed" },
];

type DetailTab = "overview" | "activity" | "execution";
type ViewMode = "cards" | "list";

export function TaskBoard() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<BoardStatus | "">("");
  const [assignee, setAssignee] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [tasks, setTasks] = useState<BoardTask[]>([]);
  const [summary, setSummary] = useState({ total: 0, queued: 0, running: 0, blocked: 0, done: 0, error: 0, assignees: [] as string[] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", body: "", assignee: "", priority: 50, tenant: "" });
  const [comment, setComment] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const data = await client.listBoard({ q, status, assignee });
      setTasks(data.tasks);
      setSummary(data.summary);
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
  }, [q, status, assignee]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  const selected = useMemo(() => tasks.find((task) => task.id === selectedId), [tasks, selectedId]);

  const openTask = (task: BoardTask) => {
    setSelectedId(task.id);
    setDetailTab("overview");
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

  return (
    <div className="task-page task-board-first scroll">
      <header className="task-hero task-hero-compact">
        <div>
          <span className="stub-tag">ACTION TRACKER</span>
          <h1>Task Board / Issues</h1>
          <p>Board-first operating view. Click a card to inspect details in a temporary drawer without shrinking the Kanban lanes.</p>
        </div>
        <div className="task-hero-actions">
          <div className="view-switch" aria-label="Task board view mode">
            <button className={viewMode === "cards" ? "on" : ""} onClick={() => setViewMode("cards")}>Cards</button>
            <button className={viewMode === "list" ? "on" : ""} onClick={() => setViewMode("list")}>List</button>
          </div>
          <button className="btn primary" onClick={() => setShowCreate((value) => !value)}>{showCreate ? "Close Form" : "+ Add Action"}</button>
          <button className="btn dark" onClick={() => void load()}>Refresh</button>
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
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, body, owner, project, skill…" />
        <select value={status} onChange={(e) => setStatus(e.target.value as BoardStatus | "")}><option value="">All status</option>{lanes.map((lane) => <option key={lane.key} value={lane.key}>{lane.label}</option>)}</select>
        <select value={assignee} onChange={(e) => setAssignee(e.target.value)}><option value="">All owners</option>{summary.assignees.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        <span>{loading ? "Loading…" : `${tasks.length} issues shown`}</span>
      </section>

      {notice && <div className="task-notice">{notice}</div>}
      {error && <div className="task-error">{error}</div>}

      {viewMode === "cards" ? (
        <section className="task-kanban task-kanban-full">
          {lanes.map((lane) => (
            <div className="task-lane" key={lane.key}>
              <div className="task-lane-head"><div><b>{lane.label}</b><small>{lane.helper}</small></div><span>{grouped[lane.key]?.length ?? 0}</span></div>
              {(grouped[lane.key] ?? []).map((task) => <TaskCard key={task.id} task={task} selected={selected?.id === task.id} onSelect={() => openTask(task)} onMove={move} onDelete={remove} />)}
              {(grouped[lane.key] ?? []).length === 0 && <div className="empty task-empty">No cards</div>}
            </div>
          ))}
        </section>
      ) : (
        <section className="ops-list task-list-view">
          <div className="ops-list-head"><span>Issue list</span><small>{loading ? "Loading…" : `${tasks.length} shown`}</small></div>
          {tasks.map((task) => <TaskListRow key={task.id} task={task} active={selected?.id === task.id} onSelect={() => openTask(task)} />)}
          {!loading && tasks.length === 0 && <div className="empty big">No issues matched this filter.</div>}
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

function TaskDetailDrawer({ task, tab, setTab, comment, setComment, onClose, onMove, onDelete, onSaveAssignee, onAddComment }: {
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
}) {
  return (
    <div className="task-drawer-layer" role="dialog" aria-modal="true" aria-label="Task details">
      <button className="task-drawer-scrim" aria-label="Close task details" onClick={onClose} />
      <aside className="task-detail task-detail-drawer">
        <header className="task-detail-head task-drawer-head">
          <div><span className={`tag ${task.status === "blocked" || task.status === "error" ? "warn" : "good"}`}>{task.status}</span><h2>{task.title}</h2><p className="mono">{task.id}</p></div>
          <button className="task-drawer-close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <div className="task-drawer-tabs">
          {(["overview", "activity", "execution"] as DetailTab[]).map((item) => <button key={item} className={tab === item ? "on" : ""} onClick={() => setTab(item)}>{item}</button>)}
        </div>

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
            <section className="task-section"><h3>Description</h3><pre>{task.body || "No description yet."}</pre></section>
            {task.result && <section className="task-section"><h3>Result</h3><pre>{task.result}</pre></section>}
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
      </aside>
    </div>
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
        <h2>{task.title}</h2><p>{task.body || "No detail yet."}</p>
        <div className="task-card-meta"><span>{task.assignee}</span><span>{task.created_by}</span>{task.tenant && <span>{task.tenant}</span>}</div>
      </button>
      <footer><select value={task.status} onChange={(e) => void onMove(task, e.target.value as BoardStatus)}>{lanes.map((lane) => <option value={lane.key} key={lane.key}>{lane.label}</option>)}</select><button className="ghost tiny danger" onClick={() => void onDelete(task)}>Delete</button></footer>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="task-info"><span>{label}</span><b>{value}</b></div>;
}
