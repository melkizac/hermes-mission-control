import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import type { Agent, AgentHandoff, BoardStatus, BoardTask, EvidenceGateState, GuardPolicy, HmcWorkflowEvidence, HmcWorkflowPhase, MissionArtifact, ProjectRecord, RunTreePayload, RunTreeRunNode, RunTreeTaskNode } from "../types";
import { ArtifactCard, EvidenceTimeline, ResultSummaryPanel } from "../components/MissionFoundation";
import { HttpHermesClient } from "../services/httpHermesClient";
import { useStore } from "../services/store";
import { parseMissionControlDeepLink } from "../services/deepLinks";
import { formatSingaporeTime } from "../utils/time";
import { SlideOverDrawer } from "../components/SlideOverDrawer";
import { Icon } from "../components/Icon";
import { useRealtimeRefresh } from "../hooks/useRealtimeRefresh";
import { InfoTooltip } from "../components/InfoTooltip";

const client = new HttpHermesClient();
const TASK_PAGE_SIZE = 5;
type BoardSourceOption = { id: string; slug: string; label: string; isDefault?: boolean };
type BoardLaneKey = "todo" | "scheduled" | "running" | "blocked" | "done";
const initialLaneCounts = (): Record<BoardLaneKey, number> => ({ todo: TASK_PAGE_SIZE, scheduled: TASK_PAGE_SIZE, running: TASK_PAGE_SIZE, blocked: TASK_PAGE_SIZE, done: TASK_PAGE_SIZE });
const statusOptions: { key: BoardStatus; label: string; helper: string }[] = [
  { key: "todo", label: "To-do", helper: "Backlog and accepted work not started yet" },
  { key: "scheduled", label: "Scheduled", helper: "Planned for a future run" },
  { key: "running", label: "In progress", helper: "Actively executing now" },
  { key: "blocked", label: "Blocked", helper: "Needs human or dependency" },
  { key: "error", label: "Error", helper: "Failed or crashed run needing recovery" },
  { key: "review", label: "Review", helper: "Output/work waiting for inspection" },
  { key: "done", label: "Done", helper: "Completed and verified" },
];
const laneGroups: { title: string; className: string; lanes: { key: BoardLaneKey; label: string; helper: string; statuses: BoardStatus[] }[] }[] = [
  { title: "Not Started", className: "todo", lanes: [
    { key: "todo", label: "To-do", helper: "Backlog or triage work", statuses: ["triage", "todo"] },
    { key: "scheduled", label: "Scheduled", helper: "Future run, reminder, or ready-to-start work", statuses: ["scheduled", "ready"] },
  ] },
  { title: "In Progress", className: "active", lanes: [
    { key: "running", label: "In progress", helper: "Executing now", statuses: ["running"] },
  ] },
  { title: "Attention & Outcomes", className: "outcome", lanes: [
    { key: "blocked", label: "Blocked", helper: "Needs dependency, review, or recovery", statuses: ["blocked", "error", "review"] },
    { key: "done", label: "Done", helper: "Completed evidence", statuses: ["done"] },
  ] },
];
const pendingTag = (status: BoardStatus) => statusOptions.find((item) => item.key === status)?.label ?? status;


type DetailTab = "overview" | "sources" | "tasks" | "outputs" | "run-tree" | "handoffs" | "release" | "evidence" | "settings";
type ViewMode = "cards" | "list";
type HumanActionKind = "feedback" | "approval" | "manual" | "agent";

type DrawerRecord = Record<string, unknown>;
type SourceAction = "add" | "remove" | "reprocess";
type ProjectSourceStatus = "queued" | "processing" | "ready" | "warning" | "error" | "removed";
type ProjectSourceType = "file" | "url" | "video" | "audio" | "note" | "unknown";

type ProjectSourceView = {
  id: string;
  title: string;
  uri: string;
  type: ProjectSourceType;
  status: ProjectSourceStatus;
  statusLabel: string;
  citationHealth: string;
  citationTone: "good" | "warn" | "bad" | "muted";
  extractedPreview: string;
  extractedPreviewUrl: string;
  meta: string[];
  record: DrawerRecord;
};

type SourceActionPayload = Partial<ProjectSourceView> & { uri?: string; type?: string; title?: string };

type ProjectDrawerData = {
  projectId: string;
  displayProjectId: string;
  workflowType: string;
  objective: string;
  currentStage: string;
  nextAction: string;
  progress: number;
  progressKnown: boolean;
  needsHuman: boolean;
  reasonLabel: string;
  sources: ProjectSourceView[];
  outputs: DrawerRecord[];
  evidence: DrawerRecord[];
  settings: DrawerRecord;
  guardPolicy: GuardPolicy | null;
  stages: Array<{ id: string; label: string; status: string; owner: string; evidence?: string }>;
};

type TaskDrawerInsight = {
  projectName: string;
  sourceJob: string;
  summary: string;
  nextAction: string;
  reasonLabel: string;
};

export function TaskBoard() {
  const { agents, select, setView } = useStore();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<BoardStatus | "">("");
  const [assignee, setAssignee] = useState("");
  const [project, setProject] = useState("");
  // Default to the canonical Hermes Admin Console board so the visible Task Board
  // counts match `hermes kanban list`. Operators can still choose All Boards for
  // cross-profile/named-board reconciliation work.
  const [board, setBoard] = useState("default");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [tasks, setTasks] = useState<BoardTask[]>([]);
  const [summary, setSummary] = useState({ total: 0, triage: 0, todo: 0, scheduled: 0, ready: 0, running: 0, blocked: 0, error: 0, review: 0, done: 0, assignees: [] as string[], projects: [] as string[], boards: [] as string[] });
  const [boardOptions, setBoardOptions] = useState<BoardSourceOption[]>([]);
  const [boardWarnings, setBoardWarnings] = useState<string[]>([]);
  const [projectOptions, setProjectOptions] = useState<ProjectRecord[]>([]);
  const [boardScopedProjects, setBoardScopedProjects] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showSpecIntake, setShowSpecIntake] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", body: "", assignee: "", priority: 50, tenant: "" });
  const [specDraft, setSpecDraft] = useState({ title: "", intent: "", projectId: "mission-control", assignee: "project-task", acceptance: "", assumptions: "", priority: 50 });
  const [comment, setComment] = useState("");
  const [humanNote, setHumanNote] = useState("");
  const [agentTarget, setAgentTarget] = useState("");
  const [laneVisibleCounts, setLaneVisibleCounts] = useState<Record<BoardLaneKey, number>>(() => initialLaneCounts());
  const [listVisibleCount, setListVisibleCount] = useState(TASK_PAGE_SIZE);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const projectOptionsLoadedRef = useRef(false);
  const deepLinkedTaskId = useMemo(() => parseMissionControlDeepLink(window.location).taskId ?? null, []);

  const load = useCallback(async () => {
    const [boardResult, projectsResult] = await Promise.allSettled([
      client.listBoard({ q, status, assignee, project, board }),
      projectOptionsLoadedRef.current ? Promise.resolve(null) : client.listProjects(),
    ]);
    if (projectsResult.status === "fulfilled" && projectsResult.value) {
      setProjectOptions(projectsResult.value.projects ?? []);
      projectOptionsLoadedRef.current = true;
    }
    if (boardResult.status === "rejected") throw boardResult.reason;
    const data = boardResult.value;
    setBoardOptions((data.boards ?? []).map((item) => ({
      id: item.id || item.slug,
      slug: item.slug || item.id,
      label: item.label || item.slug || item.id,
      isDefault: item.is_default,
    })));
    setBoardWarnings((data.board_errors ?? data.warnings ?? []).map((warning) => `${warning.board || "Task source"}: ${warning.reason || warning.status}`));
    setTasks((current) => data.tasks.map((next) => {
      const previous = current.find((item) => item.id === next.id);
      if (!previous) return next;
      return {
        ...previous,
        ...next,
        mission_result: next.mission_result ?? previous.mission_result,
        run_tree: next.run_tree ?? previous.run_tree,
        agent_handoffs: next.agent_handoffs?.length ? next.agent_handoffs : previous.agent_handoffs,
      };
    }));
    const nextSummary = { ...data.summary };
    setSummary({
      total: nextSummary.total ?? 0,
      triage: nextSummary.triage ?? 0,
      todo: nextSummary.todo ?? 0,
      scheduled: nextSummary.scheduled ?? 0,
      ready: nextSummary.ready ?? 0,
      running: nextSummary.running ?? 0,
      blocked: nextSummary.blocked ?? 0,
      error: nextSummary.error ?? 0,
      review: nextSummary.review ?? 0,
      done: nextSummary.done ?? 0,
      assignees: nextSummary.assignees ?? [],
      projects: nextSummary.projects ?? data.projects ?? [],
      boards: nextSummary.boards ?? [],
    });
    setError(null);
  }, [q, status, assignee, project, board]);

  const refreshState = useRealtimeRefresh(load, [q, status, assignee, project, board], { pollMs: 12_000, staleAfterMs: 36_000 });
  const loading = refreshState.initialLoading;
  const refreshStatusLabel = refreshState.statusLabel;

  useEffect(() => {
    setLaneVisibleCounts(initialLaneCounts());
    setListVisibleCount(TASK_PAGE_SIZE);
  }, [q, status, assignee, project, board, viewMode]);

  useEffect(() => {
    let cancelled = false;
    if (!board) {
      setBoardScopedProjects([]);
      return () => { cancelled = true; };
    }
    void client.listBoard({ board }).then((data) => {
      if (cancelled) return;
      setBoardScopedProjects(data.projects ?? data.summary?.projects ?? []);
    }).catch(() => {
      if (!cancelled) setBoardScopedProjects([]);
    });
    return () => { cancelled = true; };
  }, [board]);

  useEffect(() => {
    if (!board || !project) return;
    if (!boardScopedProjects.length || boardScopedProjects.includes(project)) return;
    setProject("");
  }, [board, boardScopedProjects, project]);

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
        setTasks((current) => current.map((item) => item.id === deepLinkedTaskId ? { ...item, ...result.task, mission_result: result.mission_result ?? result.task?.mission_result ?? null, run_tree: result.run_tree ?? result.task?.run_tree ?? null, agent_handoffs: result.agent_handoffs ?? result.task?.agent_handoffs ?? [] } : item));
      }).catch(() => undefined);
    } else {
      setNotice(`Deep-linked task ${deepLinkedTaskId} is not visible in the current board filters.`);
    }
  }, [deepLinkedTaskId, loading, selectedId, tasks]);

  const selected = useMemo(() => tasks.find((task) => task.id === selectedId), [tasks, selectedId]);
  const availableAgents = useMemo(() => agents.filter((agent) => agent.id), [agents]);
  const projectNameById = useMemo(() => new Map(projectOptions.map((item) => [item.id, item.name || item.id])), [projectOptions]);
  const projectFilterOptions = useMemo(() => {
    const sourceIds = board
      ? boardScopedProjects
      : projectOptions.length
        ? projectOptions.map((item) => item.id)
        : summary.projects;
    return Array.from(new Set(sourceIds.filter(Boolean))).map((id) => ({ value: id, label: projectNameById.get(id) || id }));
  }, [board, boardScopedProjects, projectNameById, projectOptions, summary.projects]);
  const openTask = (task: BoardTask) => {
    setSelectedId(task.id);
    setDetailTab("overview");
    setHumanNote("");
    setAgentTarget("");
    void client.getTaskResult(task.id).then((result) => {
      if (!result.ok || !result.task) return;
      setTasks((current) => current.map((item) => item.id === task.id ? { ...item, ...result.task, mission_result: result.mission_result ?? result.task?.mission_result ?? null, run_tree: result.run_tree ?? result.task?.run_tree ?? null, agent_handoffs: result.agent_handoffs ?? result.task?.agent_handoffs ?? [] } : item));
    }).catch(() => undefined);
  };

  const create = async () => {
    if (!draft.title.trim()) return setError("Title required");
    try {
      const result = await client.createBoardTask({ ...draft, status: "todo" });
      if (!result.ok) throw new Error(result.error || "Create failed");
      setNotice(`Created issue: ${result.task?.title}`);
      setDraft({ title: "", body: "", assignee: "", priority: 50, tenant: "" });
      setShowCreate(false);
      setSelectedId(result.task?.id ?? null);
      await refreshState.refresh("manual");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  };

  const createSpecIntake = async () => {
    if (!specDraft.title.trim()) return setError("Spec title required");
    if (!specDraft.intent.trim()) return setError("Intent / business ask required");
    try {
      const result = await client.createSpecKitIntake(specDraft);
      if (!result.ok) throw new Error(result.error || "Spec intake failed");
      setNotice(`Created Spec Kit intake: ${result.task?.title || specDraft.title} · ${result.intake?.artifactCount ?? 0} artifacts · ${result.intake?.childTaskIds.length ?? 0} child tasks`);
      setSpecDraft({ title: "", intent: "", projectId: specDraft.projectId || "mission-control", assignee: specDraft.assignee || "project-task", acceptance: "", assumptions: "", priority: 50 });
      setShowSpecIntake(false);
      setSelectedId(result.task?.id ?? null);
      await refreshState.refresh("manual");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Spec intake failed");
    }
  };

  const move = async (task: BoardTask, next: BoardStatus) => {
    if (task.status === next) return;
    try {
      setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: next } : item));
      const result = await client.updateBoardTask(task.id, { status: next });
      if (!result.ok) throw new Error(result.error || "Update failed");
      setNotice(`${task.title} moved to ${pendingTag(next)}`);
      await refreshState.refresh("manual");
    } catch (err) {
      await refreshState.refresh("manual");
      setError(err instanceof Error ? err.message : "Update failed");
    }
  };

  const dropTaskIntoLane = (event: DragEvent<HTMLElement>, next: BoardStatus) => {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain") || draggingTaskId;
    setDraggingTaskId(null);
    if (!id) return;
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    void move(task, next);
  };

  const saveAssignee = async (task: BoardTask, nextAssignee: string) => {
    try {
      const result = await client.updateBoardTask(task.id, { assignee: nextAssignee });
      if (!result.ok) throw new Error(result.error || "Update failed");
      setNotice(`Updated assignee for ${task.title}`);
      await refreshState.refresh("manual");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  };

  const handleSourceAction = async (task: BoardTask, action: SourceAction, source: SourceActionPayload) => {
    const title = source.title || source.uri || source.id || "new source";
    try {
      const payload = {
        action,
        source_id: source.id,
        title: source.title,
        uri: source.uri,
        type: source.type,
        requested_at: new Date().toISOString(),
      };
      await addTaskComment(task, `Project source action requested: ${action} ${title}
${JSON.stringify(payload, null, 2)}`);
      setNotice(`Source ${action} requested for ${title}`);
      if (task.status === "blocked") await client.updateBoardTask(task.id, { status: "review" });
      await refreshState.refresh("manual");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Source action failed");
    }
  };

  const addComment = async () => {
    if (!selected || !comment.trim()) return;
    try {
      const result = await client.addBoardComment(selected.id, comment);
      if (!result.ok) throw new Error(result.error || "Comment failed");
      setComment("");
      setNotice("Comment added");
      await refreshState.refresh("manual");
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
        if (task.status === "blocked") await client.updateBoardTask(task.id, { status: "review" });
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
      await refreshState.refresh("manual");
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
      const result = await client.updateBoardTask(task.id, { assignee: target, status: "ready" });
      if (!result.ok) throw new Error(result.error || "Update failed");
      const handoff = await client.createAgentHandoff({
        from_agent: task.assignee || "mission-control",
        to_agent: target,
        task_id: task.id,
        objective: task.title,
        context: task.body || `Task ${task.id} assigned from Mission Control Task Board.`,
        requested_output: "Own the next execution step, keep proof/evidence attached to this task, and return blockers to the Task Board if human input is required.",
        risk: task.priority_label || "medium",
        status: "requested",
        evidence: [{ kind: "task", task_id: task.id, summary: task.title }],
      });
      if (!handoff.ok) throw new Error(handoff.error || "Handoff failed");
      await addTaskComment(task, `Agent handoff created: ${handoff.handoff?.id || target}\nFrom: ${task.assignee || "mission-control"}\nTo: ${label}\nRequested output: Own the next execution step and attach proof/evidence to this task.`);
      setNotice(`Assigned to ${label}; opening agent chat`);
      await refreshState.refresh("manual");
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
      await refreshState.refresh("manual");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const grouped = useMemo(() => laneGroups.flatMap((group) => group.lanes).reduce((acc, lane) => ({ ...acc, [lane.key]: tasks.filter((task) => lane.statuses.includes(task.status)) }), {} as Record<BoardLaneKey, BoardTask[]>), [tasks]);
  const visibleListTasks = useMemo(() => tasks.slice(0, listVisibleCount), [tasks, listVisibleCount]);
  const showMoreLane = (lane: BoardLaneKey) => setLaneVisibleCounts((current) => ({ ...current, [lane]: current[lane] + TASK_PAGE_SIZE }));

  return (
    <div className="task-page task-board-first scroll">
      <header className="task-hero task-hero-compact">
        <div className="task-hero-copy">
          <span className="stub-tag">ACTION TRACKER</span>
          <div className="task-title-row">
            <div className="task-title-main">
              <h1>Task Board</h1>
              <InfoTooltip label="About Task Board">Project-first operating view. Mission Control aggregates live Hermes Kanban task sources and maps tenant to Project.</InfoTooltip>
            </div>
            <div className="task-title-actions" aria-label="Task board actions">
              <span className="runtime-refresh-status realtime-status">{refreshStatusLabel}</span>
              <button
                className={"task-icon-action" + (showSpecIntake ? " on" : "")}
                aria-label={showSpecIntake ? "Close Spec Kit intake" : "Open Spec Kit intake"}
                title={showSpecIntake ? "Close Spec Kit intake" : "Spec Kit intake"}
                onClick={() => setShowSpecIntake((value) => !value)}
              >
                <Icon name="skills" size={18} />
              </button>
              <button
                className={"task-icon-action primary" + (showCreate ? " on" : "")}
                aria-label={showCreate ? "Close add action form" : "Add action"}
                title={showCreate ? "Close add action form" : "Add action"}
                onClick={() => setShowCreate((value) => !value)}
              >
                <Icon name="plus" size={18} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <section className="task-metrics task-metrics-compact">
        <Metric label="Total" value={summary.total} sub="tracked tasks · live sources" />
        <Metric label="Not Started" value={summary.triage + summary.todo + summary.ready + summary.scheduled} sub="to-do + scheduled" />
        <Metric label="In Progress" value={summary.running} sub="currently executing" />
        <Metric label="Attention / Outcomes" value={summary.blocked + summary.error + summary.review + summary.done} sub="blocked + done" tone={summary.blocked || summary.error ? "bad" : undefined} />
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

      {showSpecIntake && (
        <section className="task-create task-create-collapsed spec-kit-intake-panel" aria-label="Spec Kit structured requirements intake">
          <div className="task-create-main">
            <div className="project-section-head"><b>Spec Kit intake</b><span>Structured artifacts before execution</span></div>
            <input value={specDraft.title} onChange={(e) => setSpecDraft({ ...specDraft, title: e.target.value })} placeholder="Feature / requirement title…" />
            <textarea value={specDraft.intent} onChange={(e) => setSpecDraft({ ...specDraft, intent: e.target.value })} placeholder="Intent / business ask. What outcome should Mission Control compile before workers execute?" />
            <textarea value={specDraft.acceptance} onChange={(e) => setSpecDraft({ ...specDraft, acceptance: e.target.value })} placeholder="Acceptance criteria, one per line…" />
            <textarea value={specDraft.assumptions} onChange={(e) => setSpecDraft({ ...specDraft, assumptions: e.target.value })} placeholder="Assumptions or [NEEDS CLARIFICATION] items, one per line…" />
          </div>
          <div className="task-create-side">
            <input value={specDraft.projectId} onChange={(e) => setSpecDraft({ ...specDraft, projectId: e.target.value })} placeholder="Project/tenant" />
            <input value={specDraft.assignee} onChange={(e) => setSpecDraft({ ...specDraft, assignee: e.target.value })} placeholder="Owner/profile" />
            <select value={specDraft.priority} onChange={(e) => setSpecDraft({ ...specDraft, priority: Number(e.target.value) })}>
              <option value={20}>Medium</option><option value={50}>High</option><option value={80}>Critical</option><option value={0}>Low</option>
            </select>
            <p className="muted">Creates one blocked parent intake plus child cards for clarify → spec → plan → task breakdown. Workers stay blocked until artifacts are reviewed.</p>
            <button className="btn primary" onClick={() => void createSpecIntake()}>Create Spec Intake</button>
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
        <select value={status} onChange={(e) => setStatus(e.target.value as BoardStatus | "")} aria-label="Status selector"><option value="">All status</option>{statusOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select>
        <select value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Owner selector"><option value="">All owners</option>{summary.assignees.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        <select className="task-board-filter" value={board} onChange={(e) => setBoard(e.target.value)} aria-label="Board selector">
          <option value="">All Boards</option>
          {boardOptions.map((item) => <option key={item.id || item.slug} value={item.slug || item.id}>{item.label}{item.isDefault ? " · default" : ""}</option>)}
        </select>
        <select value={project} onChange={(e) => setProject(e.target.value)} aria-label="Project selector">
          <option value="">All Projects</option>
          {projectFilterOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        {boardWarnings.length > 0 && <div className="task-board-source-warnings">{boardWarnings.slice(0, 2).map((warning) => <span key={warning}>{warning}</span>)}</div>}
      </section>

      {notice && <div className="task-notice">{notice}</div>}
      {(error || refreshState.error) && <div className="task-error">{error || refreshState.error}</div>}

      {viewMode === "cards" ? (
        <section className="task-kanban task-kanban-full" aria-label="Task board grouped by Not Started, In Progress, and Attention & Outcomes">
          {laneGroups.map((group) => (
            <div className={`task-lane-group task-lane-group-${group.className}`} key={group.title}>
              <div className="task-lane-group-head"><span>{group.title}</span></div>
              <div className="task-lane-group-columns">
                {group.lanes.map((lane) => {
                  const laneTasks = grouped[lane.key] ?? [];
                  const visibleTasks = laneTasks.slice(0, laneVisibleCounts[lane.key]);
                  const remaining = Math.max(0, laneTasks.length - visibleTasks.length);
                  return (
                    <div
                      className={`task-lane ${draggingTaskId ? "task-lane-drop-ready" : ""}`}
                      key={lane.key}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => dropTaskIntoLane(event, lane.key)}
                    >
                      <div className="task-lane-head"><div><b>{lane.label}</b><small>{lane.helper}</small></div><span>{laneTasks.length}</span></div>
                      {visibleTasks.map((task) => <TaskCard key={task.id} task={task} selected={selected?.id === task.id} dragging={draggingTaskId === task.id} onSelect={() => openTask(task)} onDragStart={(event) => { setDraggingTaskId(task.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", task.id); }} onDragEnd={() => setDraggingTaskId(null)} onDelete={remove} />)}
                      {laneTasks.length === 0 && <div className="empty task-empty">Drop cards here</div>}
                      {remaining > 0 && <button className="task-view-more" onClick={() => showMoreLane(lane.key)}>View More <span>{Math.min(TASK_PAGE_SIZE, remaining)} more</span></button>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
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
          onSourceAction={handleSourceAction}
        />
      )}
    </div>
  );
}


function TaskListRow({ task, active, onSelect }: { task: BoardTask; active: boolean; onSelect: () => void }) {
  const copy = getTaskDisplayCopy(task);
  return (
    <button className={`ops-row task-list-row ${active ? "on" : ""}`} onClick={onSelect}>
      <div className="ops-row-main">
        <div className="ops-row-top">
          <b>{copy.title}</b>
          <span className={`tag ${task.status === "blocked" || task.status === "error" ? "warn" : task.status === "done" ? "good" : "muted"}`}>{pendingTag(task.status)}</span>
        </div>
        <p>{copy.description}</p>
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

function TaskDetailDrawer({ task, tab, setTab, comment, setComment, onClose, onMove, onDelete, onSaveAssignee, onAddComment, humanNote, setHumanNote, onHumanAction, agents, agentTarget, setAgentTarget, onAssignToAgent, onSourceAction }: {
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
  onSourceAction: (task: BoardTask, action: SourceAction, source: SourceActionPayload) => void;
}) {
  const intent = classifyHumanTask(task);
  const displayCopy = getTaskDisplayCopy(task);
  const projectData = getProjectDrawerData(task);
  return (
    <SlideOverDrawer
      title={displayCopy.title}
      subtitle={<span className="mono">{task.id} · {projectData.displayProjectId}</span>}
      eyebrow={pendingTag(task.status)}
      statusClassName={`tag ${task.status === "blocked" ? "warn" : "good"}`}
      onClose={onClose}
      closeLabel="Close project task cockpit"
      ariaLabel="Project-aware task cockpit"
      dataDeepLinkTarget="task"
      // rendered attribute: data-deeplink-target="task"
      tabs={["overview", "sources", "tasks", "outputs", "run-tree", "handoffs", "release", "evidence", "settings"] as const}
      activeTab={tab}
      onTabChange={setTab}
      className="task-detail task-detail-drawer project-task-drawer"
      width="wide"
    >
      {tab === "overview" && (
        <>
          <section className="task-project-summary" aria-label="Project workflow overview">
            <div className="project-cockpit-heading">
              <span className="stub-tag">TASK SUMMARY</span>
              {projectData.progressKnown && (
                <div className="project-progress-inline" aria-label={`${projectData.progress}% complete`}>
                  <span className="project-progress-inline-label">{projectData.progress}% complete</span>
                  <span className="project-progress-track" aria-hidden="true">
                    <span className="project-progress-fill" style={{ width: `${projectData.progress}%` }} />
                  </span>
                </div>
              )}
            </div>
            <h3>{projectData.objective}</h3>
            <p>{projectData.nextAction}</p>
            <div className="task-briefing-grid" aria-label="Task briefing">
              <div><span>Why this is here</span><b>{projectData.needsHuman ? "Needs operator attention" : projectData.reasonLabel}</b></div>
              <div><span>Next action</span><b>{projectData.nextAction}</b></div>
            </div>
          </section>
          {projectData.needsHuman ? <div className="project-needs-you"><b>Needs you</b><span>A genuine human decision, Approval Gate, access fix, or manual outcome is required before agents can continue.</span></div> : <div className="project-agent-resolvable"><b>Agent repair suggested</b><span>This is an operational task or routine failure. Assign it to the right agent if it should be fixed without a manual decision.</span></div>}
          <GuardPolicyPanel policy={projectData.guardPolicy} compact />
          <ReleaseLaneOverview task={task} compact />
          <div className="task-kv project-task-kv">
            <Info label="Owner" value={task.assignee || "unassigned"} />
            <Info label="Status" value={projectData.currentStage} />
            <Info label="Updated" value={formatSingaporeTime(task.updated_at)} />
            <Info label="Project" value={projectData.displayProjectId} />
            <Info label="Priority" value={`${task.priority_label.charAt(0).toUpperCase()}${task.priority_label.slice(1)} · score ${task.priority}`} />
            <Info label="Workspace" value={formatWorkspaceLabel(task)} />
          </div>
          <div className="task-drawer-actions">
            <select value={task.status} onChange={(e) => void onMove(task, e.target.value as BoardStatus)}>{statusOptions.map((option) => <option value={option.key} key={option.key}>{option.label}</option>)}</select>
            <button className="ghost tiny danger" onClick={() => void onDelete(task)}>Delete</button>
          </div>
          <label className="task-inline-edit"><span>Owner / profile</span><input defaultValue={task.assignee === "unassigned" ? "" : task.assignee} onBlur={(e) => e.target.value !== task.assignee && void onSaveAssignee(task, e.target.value)} /></label>
          {projectData.needsHuman ? <HumanActionPanel task={task} intent={intent} note={humanNote} setNote={setHumanNote} onHumanAction={onHumanAction} agents={agents} agentTarget={agentTarget} setAgentTarget={setAgentTarget} onAssignToAgent={onAssignToAgent} /> : <AgentAssignmentPanel agents={agents} agentTarget={agentTarget} setAgentTarget={setAgentTarget} onAssignToAgent={() => onAssignToAgent(task)} />}
          <WorkflowStageList stages={projectData.stages} />
        </>
      )}

      {tab === "sources" && <SourcesTab task={task} sources={projectData.sources} onSourceAction={(action, source) => onSourceAction(task, action, source)} />}
      {tab === "tasks" && <WorkflowTasksTab task={task} comment={comment} setComment={setComment} onAddComment={onAddComment} />}
      {tab === "outputs" && <OutputsTab outputs={projectData.outputs} />}
      {tab === "run-tree" && <RunTreePanel runTree={task.run_tree ?? null} handoffs={task.agent_handoffs ?? []} />}
      {tab === "handoffs" && <section className="task-section"><TaskHandoffTimeline handoffs={task.agent_handoffs ?? []} /></section>}
      {tab === "release" && <ReleaseLaneTab task={task} />}
      {tab === "evidence" && <TaskEvidenceProofView task={task} />}
      {tab === "settings" && <SettingsTab settings={projectData.settings} task={task} />}
    </SlideOverDrawer>
  );
}

function asRecord(value: unknown): DrawerRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as DrawerRecord : {};
}

function asRecordArray(value: unknown): DrawerRecord[] {
  return Array.isArray(value) ? value.filter((item): item is DrawerRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
}

function stringifyValue(value: unknown) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try { return JSON.stringify(value); } catch { return String(value); }
}

function getGuardPolicy(task: BoardTask): GuardPolicy | null {
  const details = asRecord(task.result_details);
  const settings = asRecord(details.settings);
  const requirements = asRecord(details.requirements);
  const candidates = [task.guard_policy, task.guardPolicy, details.guard_policy, details.guardPolicy, settings.guard_policy, settings.guardPolicy, requirements.guard_policy, requirements.guardPolicy];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) return candidate as GuardPolicy;
  }
  return null;
}

function guardList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => stringifyValue(item)).filter(Boolean);
  if (typeof value === "string" && value.trim()) return value.split(/[,\n]+/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function guardField(policy: GuardPolicy | null, snake: keyof GuardPolicy, camel: keyof GuardPolicy, fallback = "—") {
  if (!policy) return fallback;
  return stringifyValue(policy[snake] ?? policy[camel]) || fallback;
}

function getNestedRecord(record: DrawerRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value && typeof value === "object" && !Array.isArray(value)) return value as DrawerRecord;
  }
  return {};
}

function getString(record: DrawerRecord, keys: string[], fallback = "—") {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
  }
  return fallback;
}

function getNumber(record: DrawerRecord, keys: string[], fallback: number) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return fallback;
}

function getSourceType(source: DrawerRecord): ProjectSourceType {
  const raw = getString(source, ["type", "kind", "mime", "content_type", "contentType"], "unknown").toLowerCase();
  const uri = getString(source, ["uri", "url", "path", "filename", "name"], "").toLowerCase();
  if (/video|youtube|vimeo|\.mp4|\.mov|\.mkv|\.webm/.test(`${raw} ${uri}`)) return "video";
  if (/audio|podcast|\.mp3|\.wav|\.m4a|\.aac|\.flac/.test(`${raw} ${uri}`)) return "audio";
  if (/url|link|http|https|web|article/.test(`${raw} ${uri}`)) return "url";
  if (/file|pdf|doc|ppt|txt|markdown|csv|xlsx|\.pdf|\.docx|\.pptx|\.txt|\.md/.test(`${raw} ${uri}`)) return "file";
  if (/note|text|brief/.test(raw)) return "note";
  return "unknown";
}

function normalizeSourceStatus(source: DrawerRecord): Pick<ProjectSourceView, "status" | "statusLabel"> {
  const processing = getNestedRecord(source, ["processing", "processing_status", "processingStatus"]);
  const raw = getString(processing, ["status", "state"], getString(source, ["processing_status", "processingStatus", "status", "state"], "queued")).toLowerCase().replace(/[ _-]+/g, "_");
  if (["done", "ready", "processed", "complete", "completed", "indexed"].includes(raw)) return { status: "ready", statusLabel: "Ready" };
  if (["running", "processing", "extracting", "transcribing", "indexing", "queued_for_processing"].includes(raw)) return { status: "processing", statusLabel: raw.replace(/_/g, " ") };
  if (["failed", "error", "blocked", "unsupported"].includes(raw)) return { status: "error", statusLabel: raw.replace(/_/g, " ") };
  if (["warning", "partial", "stale", "needs_reprocess"].includes(raw)) return { status: "warning", statusLabel: raw.replace(/_/g, " ") };
  if (["removed", "deleted", "detached"].includes(raw)) return { status: "removed", statusLabel: raw.replace(/_/g, " ") };
  return { status: "queued", statusLabel: raw === "queued" ? "Queued" : raw.replace(/_/g, " ") };
}

function normalizeCitationHealth(source: DrawerRecord): Pick<ProjectSourceView, "citationHealth" | "citationTone"> {
  const citation = getNestedRecord(source, ["citation", "citations", "citation_health", "citationHealth"]);
  const raw = getString(citation, ["health", "coverage", "status"], getString(source, ["citation_health", "citationHealth", "citation_status", "citationStatus"], "citation pending"));
  const lower = raw.toLowerCase();
  if (/good|healthy|covered|complete|high|ready/.test(lower)) return { citationHealth: raw, citationTone: "good" };
  if (/missing|failed|broken|none|low/.test(lower)) return { citationHealth: raw, citationTone: "bad" };
  if (/partial|stale|warning|pending|medium/.test(lower)) return { citationHealth: raw, citationTone: "warn" };
  return { citationHealth: raw, citationTone: "muted" };
}

function normalizeProjectSource(source: DrawerRecord, index: number): ProjectSourceView {
  const processing = getNestedRecord(source, ["processing"]);
  const extraction = getNestedRecord(source, ["extraction", "extracted_text", "extractedText"]);
  const status = normalizeSourceStatus(source);
  const citation = normalizeCitationHealth(source);
  const type = getSourceType(source);
  const title = getString(source, ["title", "name", "filename", "label"], `Source ${index + 1}`);
  const uri = getString(source, ["uri", "url", "path", "href", "source"], "");
  const previewUrl = getString(extraction, ["preview_url", "previewUrl", "url", "href"], getString(source, ["extracted_text_url", "extractedTextUrl", "preview_url", "previewUrl", "text_url", "textUrl"], ""));
  const extractedPreview = getString(extraction, ["preview", "text_preview", "textPreview", "summary"], getString(source, ["extracted_text_preview", "extractedTextPreview", "text_preview", "textPreview", "preview"], ""));
  const pages = getString(processing, ["pages", "duration", "chunks"], getString(source, ["pages", "duration", "chunks"], ""));
  return {
    id: getString(source, ["source_id", "sourceId", "id", "uri", "url", "path"], `source_${index + 1}`),
    title,
    uri,
    type,
    ...status,
    ...citation,
    extractedPreview,
    extractedPreviewUrl: previewUrl,
    meta: [type, uri, pages, getString(source, ["updated_at", "updatedAt", "created_at", "createdAt"], "")].filter(Boolean),
    record: source,
  };
}

function recordEntries(record: DrawerRecord) {
  return Object.entries(record).filter(([, value]) => value !== undefined && value !== null && value !== "");
}

type ReleaseFieldKey = "branch" | "commit" | "build" | "tests" | "review" | "deployTarget" | "healthCheck" | "browserProof" | "rollback" | "docsImpact";
type ReleasePhaseStatus = "pending" | "running" | "passed" | "blocked" | "failed" | "skipped" | string;

type ReleasePhaseRow = {
  id: HmcWorkflowPhase;
  label: string;
  command: string;
  status: ReleasePhaseStatus;
  taskIds: string[];
  latest?: HmcWorkflowEvidence;
  summary: string;
  missing: ReleaseFieldKey[];
};

type ReleaseLaneModel = {
  projectId: string;
  evidence: HmcWorkflowEvidence[];
  phases: ReleasePhaseRow[];
  fields: Array<{ key: ReleaseFieldKey; label: string; value: string; satisfied: boolean }>;
};

const releasePhaseDefinitions: Array<{ id: HmcWorkflowPhase; label: string; command: string; required: ReleaseFieldKey[] }> = [
  { id: "hmc-plan", label: "Plan", command: "/hmc-plan", required: ["docsImpact", "rollback"] },
  { id: "hmc-build", label: "Build", command: "/hmc-build", required: ["branch", "commit", "build", "tests", "docsImpact"] },
  { id: "hmc-review", label: "Review", command: "/hmc-review", required: ["review"] },
  { id: "hmc-qa", label: "QA", command: "/hmc-qa", required: ["build", "tests", "healthCheck", "browserProof"] },
  { id: "hmc-ship", label: "Ship", command: "/hmc-ship", required: ["branch", "commit", "deployTarget", "rollback", "docsImpact"] },
  { id: "hmc-canary", label: "Canary", command: "/hmc-canary", required: ["healthCheck", "browserProof", "rollback"] },
  { id: "hmc-retro", label: "Retro", command: "/hmc-retro", required: ["docsImpact", "rollback"] },
];

const releaseFieldDefinitions: Array<{ key: ReleaseFieldKey; label: string }> = [
  { key: "branch", label: "Branch" },
  { key: "commit", label: "Commit" },
  { key: "build", label: "Build" },
  { key: "tests", label: "Tests" },
  { key: "review", label: "Review" },
  { key: "deployTarget", label: "Deploy target" },
  { key: "healthCheck", label: "Health check" },
  { key: "browserProof", label: "Browser proof" },
  { key: "rollback", label: "Rollback note" },
  { key: "docsImpact", label: "Docs impact" },
];

function normalizeHmcPhase(value: unknown): HmcWorkflowPhase | "" {
  const raw = String(value || "").trim().toLowerCase().replace(/^\//, "").replace(/_/g, "-");
  const match = releasePhaseDefinitions.find((phase) => phase.id === raw || phase.id.replace("hmc-", "") === raw || phase.command.replace(/^\//, "") === raw);
  return match?.id ?? "";
}

function isWorkflowEvidenceRecord(value: unknown): value is HmcWorkflowEvidence {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as DrawerRecord;
  return record.schema === "hmc.workflow_evidence.v1" || Boolean(normalizeHmcPhase(record.phase));
}

function collectWorkflowEvidence(value: unknown): HmcWorkflowEvidence[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(collectWorkflowEvidence);
  if (typeof value !== "object") return [];
  const record = value as DrawerRecord;
  const direct = isWorkflowEvidenceRecord(record) ? [record as HmcWorkflowEvidence] : [];
  return direct.concat(
    collectWorkflowEvidence(record.workflow_evidence),
    collectWorkflowEvidence(record.workflowEvidence),
    collectWorkflowEvidence(record.hmc_workflow_evidence),
    collectWorkflowEvidence(record.evidence),
  );
}

function parseWorkflowEvidenceFromText(text: string): HmcWorkflowEvidence[] {
  if (!text.includes("hmc.workflow_evidence.v1")) return [];
  const candidates: string[] = [];
  const fencePattern = /```(?:json)?\s*([\s\S]*?)```/gi;
  let fence: RegExpExecArray | null;
  while ((fence = fencePattern.exec(text))) candidates.push(fence[1]);
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) candidates.push(text.slice(first, last + 1));
  return candidates.flatMap((candidate) => {
    try { return collectWorkflowEvidence(JSON.parse(candidate)); } catch { return []; }
  });
}

function getWorkflowEvidenceRecords(task: BoardTask): HmcWorkflowEvidence[] {
  const details = asRecord(task.result_details);
  const records = [
    ...collectWorkflowEvidence(details.workflow_evidence),
    ...collectWorkflowEvidence(details.workflowEvidence),
    ...collectWorkflowEvidence(details.hmc_workflow_evidence),
    ...collectWorkflowEvidence(task.mission_result?.evidence),
    ...(task.comments ?? []).flatMap((comment) => parseWorkflowEvidenceFromText(comment.body)),
  ];
  const seen = new Set<string>();
  return records
    .filter((record) => normalizeHmcPhase(record.phase))
    .filter((record) => {
      const key = `${record.task_id || record.taskId || task.id}:${record.phase}:${record.created_at || record.createdAt || ""}:${record.summary}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => String(a.created_at || a.createdAt || "").localeCompare(String(b.created_at || b.createdAt || "")));
}

function evidenceHasCommand(evidence: HmcWorkflowEvidence | undefined, pattern: RegExp) {
  return Boolean(evidence?.commands?.some((command) => pattern.test(`${command.command} ${command.summary || ""}`) && !/failed|blocked/i.test(command.status)));
}

function evidenceHasCheck(evidence: HmcWorkflowEvidence | undefined, pattern: RegExp) {
  return Boolean(evidence?.checks?.some((check) => pattern.test(`${check.type} ${check.summary}`) && !/failed|blocked/i.test(check.status)));
}

function releaseFieldValue(key: ReleaseFieldKey, evidence: HmcWorkflowEvidence[]): string {
  const latest = [...evidence].reverse();
  for (const item of latest) {
    const record = item as unknown as DrawerRecord;
    if (key === "branch" && item.branch) return item.branch;
    if (key === "commit" && item.commit) return item.commit;
    if (key === "build" && (item.build || evidenceHasCommand(item, /build|npm run build|vite/i))) return item.build ? formatRecordValue(item.build) : "Build command passed";
    if (key === "tests" && (item.tests || evidenceHasCommand(item, /test|pytest|vitest|playwright|npm run build/i) || evidenceHasCheck(item, /test|qa|build/i))) return item.tests ? formatRecordValue(item.tests) : "Verification command attached";
    if (key === "review" && (item.review || item.approval?.status === "approved" || item.phase === "hmc-review")) return item.review ? formatRecordValue(item.review) : item.summary;
    if (key === "deployTarget" && (item.deploy_target || item.deployTarget)) return item.deploy_target || item.deployTarget || "";
    if (key === "healthCheck" && (item.health_check || item.healthCheck || evidenceHasCheck(item, /health|api|endpoint/i))) return item.health_check || item.healthCheck || "Health/API check attached";
    if (key === "browserProof" && (item.browser_proof || item.browserProof || evidenceHasCheck(item, /browser|dom|screenshot|console/i))) return item.browser_proof || item.browserProof || "Browser proof attached";
    if (key === "rollback" && (item.rollback || item.rollback_note || item.rollbackNote)) return item.rollback || item.rollback_note || item.rollbackNote || "";
    if (key === "docsImpact" && (item.docs_impact || item.docsImpact)) return item.docs_impact || item.docsImpact || "";
    const fallback = getString(record, [key], "");
    if (fallback) return fallback;
  }
  return "";
}

function buildReleaseLaneModel(task: BoardTask): ReleaseLaneModel {
  const evidence = getWorkflowEvidenceRecords(task);
  const projectId = task.tenant?.replace(/^project:/, "") || task.workflow_template_id || task.id;
  const fields = releaseFieldDefinitions.map((field) => {
    const value = releaseFieldValue(field.key, evidence);
    return { ...field, value, satisfied: Boolean(value) };
  });
  const byPhase = new Map<HmcWorkflowPhase, HmcWorkflowEvidence[]>();
  evidence.forEach((item) => {
    const phase = normalizeHmcPhase(item.phase);
    if (!phase) return;
    byPhase.set(phase, [...(byPhase.get(phase) ?? []), item]);
  });
  const phases = releasePhaseDefinitions.map((phase) => {
    const phaseEvidence = byPhase.get(phase.id) ?? [];
    const latest = phaseEvidence[phaseEvidence.length - 1];
    const status = latest?.status || (normalizeHmcPhase(task.current_step_key) === phase.id ? task.status : "pending");
    const missing = phase.required.filter((key) => !releaseFieldValue(key, phaseEvidence.length ? phaseEvidence : evidence));
    return {
      ...phase,
      status,
      taskIds: Array.from(new Set(phaseEvidence.map((item) => item.task_id || item.taskId || task.id).filter(Boolean) as string[])),
      latest,
      summary: latest?.summary || "No structured evidence attached yet.",
      missing,
    };
  });
  return { projectId, evidence, phases, fields };
}

function ReleaseLaneOverview({ task, compact = false }: { task: BoardTask; compact?: boolean }) {
  const model = buildReleaseLaneModel(task);
  const satisfied = model.fields.filter((field) => field.satisfied).length;
  const hasHmcContext = model.evidence.length > 0 || task.tenant === "hmc-governed-software-factory" || task.workflow_template_id === "hmc_software_factory";
  if (!hasHmcContext && compact) return null;
  return (
    <section className={`task-section release-lane-overview ${compact ? "compact" : ""}`} aria-label="HMC release lane evidence overview">
      <div className="release-lane-head"><div><span className="stub-tag">Release lane</span><h3>HMC software-factory evidence</h3></div><span>{satisfied}/{model.fields.length} fields</span></div>
      <div className="release-phase-strip">
        {model.phases.map((phase) => <span className={`release-phase-pill ${phase.status}`} key={phase.id}><b>{phase.label}</b><small>{phase.status}</small></span>)}
      </div>
    </section>
  );
}

function ReleaseLaneTab({ task }: { task: BoardTask }) {
  const model = buildReleaseLaneModel(task);
  return (
    <section className="task-section project-drawer-tab release-lane-tab" aria-label="HMC release lane and evidence model">
      <ReleaseLaneOverview task={task} />
      <div className="release-field-grid">
        {model.fields.map((field) => <div className={`release-field-card ${field.satisfied ? "satisfied" : "missing"}`} key={field.key}><span>{field.satisfied ? "✓" : "!"}</span><b>{field.label}</b><p>{field.value || "Missing from latest structured evidence."}</p></div>)}
      </div>
      <div className="release-phase-list">
        {model.phases.map((phase) => <article className={`release-phase-card ${phase.status}`} key={phase.id}>
          <div className="release-phase-card-head"><div><span className="stub-tag">{phase.command}</span><h4>{phase.label}</h4></div><span className={`tag ${phase.status === "passed" ? "good" : phase.status === "failed" || phase.status === "blocked" ? "warn" : "muted"}`}>{phase.status}</span></div>
          <p>{phase.summary}</p>
          <div className="chip-row compact">{phase.taskIds.length > 0 ? phase.taskIds.map((id) => <span key={id}>{id}</span>) : <span>No linked task evidence</span>}{phase.missing.length > 0 && <em>missing: {phase.missing.map((key) => releaseFieldDefinitions.find((field) => field.key === key)?.label || key).join(", ")}</em>}</div>
        </article>)}
      </div>
      {model.evidence.length === 0 && <div className="empty big">No HMC workflow evidence has been attached yet. Workers should append a structured JSON block with schema hmc.workflow_evidence.v1 in comments or result metadata; this drawer will map it into Plan → Build → Review → QA → Ship → Canary → Retro.</div>}
      {model.evidence.length > 0 && <section className="source-raw-context"><h4>Raw structured evidence</h4><pre>{JSON.stringify(model.evidence, null, 2)}</pre></section>}
    </section>
  );
}

function taskStageStatus(status: BoardStatus) {
  if (status === "done") return "done";
  if (status === "running") return "running";
  if (status === "blocked") return status;
  if (status === "review") return "queued";
  if (status === "ready" || status === "todo" || status === "scheduled") return "ready";
  return "not_started";
}

function taskHasPendingApprovalGate(task: BoardTask) {
  const gates = task.mission_result?.approvalGates ?? task.result_details?.approval_gates ?? [];
  return gates.some((gate) => gate.status === "pending" || gate.status === "changes-requested");
}

function taskResultNeedsHuman(task: BoardTask) {
  const details = asRecord(task.result_details);
  const summary = asRecord(details.summary);
  return Boolean(
    summary.needs_human ||
    summary.needsHuman ||
    details.needs_human ||
    details.needsHuman ||
    details.access_needed ||
    taskHasPendingApprovalGate(task) ||
    (Array.isArray(details.blockers) && details.blockers.length > 0)
  );
}

function shouldSurfaceNeedsYou(task: BoardTask) {
  const intent = classifyHumanTask(task);
  return taskResultNeedsHuman(task) || taskHasPendingApprovalGate(task) || (task.status === "blocked" && intent !== "agent");
}

function matchLine(text: string, label: string) {
  const pattern = new RegExp(`${label}\\s*:\\s*([^\\n]+)`, "i");
  return text.match(pattern)?.[1]?.trim() || "";
}

type TaskDisplayCopy = {
  title: string;
  description: string;
  reasonLabel?: string;
  sourceJob?: string;
  evidencePath?: string;
  runTime?: string;
};

function taskText(task: BoardTask) {
  return `${task.title || ""}\n${task.body || ""}`;
}

function cleanupInlineText(value: string, fallback = "No description yet.") {
  const cleaned = value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[(IMPORTANT|SYSTEM)[\s\S]*?\]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || fallback;
}

function truncateSentence(value: string, limit = 150) {
  const cleaned = cleanupInlineText(value, "");
  if (cleaned.length <= limit) return cleaned;
  const slice = cleaned.slice(0, limit - 1);
  return `${slice.replace(/[\s,.;:]+\S*$/, "")}…`;
}

function humanizeIdentifier(value: string) {
  return value
    .replace(/\s*\([0-9a-f]{8,}\)\s*$/i, "")
    .replace(/^cron[:/]/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bLinkedin\b/g, "LinkedIn")
    .replace(/\bHmc\b/g, "HMC")
    .replace(/\bQa\b/g, "QA")
    .trim();
}

function classifyAttentionReason(raw: string) {
  const lower = raw.toLowerCase();
  if (lower.includes("approval")) return "approval or review marker found";
  if (lower.includes("blocked") || lower.includes("error")) return "blocked or error output";
  if (lower.includes("human")) return "human attention requested";
  return raw ? raw.replace(/[-_]+/g, " ") : "operator attention requested";
}

function parseCronAttention(task: BoardTask) {
  const text = taskText(task);
  if (!/^Attention needed:/i.test(task.title) && !text.includes("routed to the Task Board")) return null;
  const sourceJobRaw = matchLine(text, "Source job") || matchLine(text, "Cron Job") || task.workflow_template_id || task.title.replace(/^Attention needed:\s*/i, "");
  const sourceJob = sourceJobRaw.replace(/\s*\([0-9a-f]{8,}\)\s*$/i, "").trim();
  const humanJob = humanizeIdentifier(sourceJob || "scheduled routine");
  const reason = classifyAttentionReason(matchLine(text, "Why"));
  const evidencePath = matchLine(text, "Cron output");
  const runTime = text.match(/\*\*Run Time:\*\*\s*([^\n]+)/i)?.[1]?.trim() || matchLine(text, "Run Time");
  return { sourceJob, humanJob, reason, evidencePath, runTime };
}

function getTaskDisplayCopy(task: BoardTask): TaskDisplayCopy {
  const attention = parseCronAttention(task);
  if (attention) {
    const isKanbanNotifier = /kanban.*attention/i.test(attention.sourceJob);
    const isGoalBottleneck = /goal.*bottleneck/i.test(attention.sourceJob);
    const title = isKanbanNotifier
      ? "Review Task Board items needing attention"
      : isGoalBottleneck
        ? "Review human bottlenecks blocking agent goals"
        : `Review ${attention.humanJob} output`;
    const description = [
      `A scheduled routine produced ${attention.reason}.`,
      attention.runTime ? `Run: ${attention.runTime}.` : "",
      attention.evidencePath ? "Raw log is saved in Sources." : "Open the drawer for context and next action.",
    ].filter(Boolean).join(" ");
    return { title, description, reasonLabel: attention.reason, sourceJob: attention.sourceJob, evidencePath: attention.evidencePath, runTime: attention.runTime };
  }

  const title = cleanupInlineText(task.title, "Untitled task");
  const explicitSummary = getString(asRecord(task.result_details), ["operator_summary", "summary_text", "human_summary"], "");
  const firstLine = firstMeaningfulLine(task.body || "");
  const description = truncateSentence(explicitSummary || firstLine || task.result || "Open the drawer for task context, owner, next action, and evidence.", 170);
  return { title, description };
}

function deriveTaskDrawerInsight(task: BoardTask, projectId: string): TaskDrawerInsight {
  const text = `${task.title}\n${task.body || ""}`;
  const displayCopy = getTaskDisplayCopy(task);
  const sourceJobRaw = matchLine(text, "Source job") || matchLine(text, "Cron Job") || task.workflow_template_id || displayCopy.sourceJob || "";
  const sourceJob = sourceJobRaw.replace(/\s*\([0-9a-f]{8,}\)\s*$/i, "").trim();
  const lower = text.toLowerCase();
  const rawProject = projectId || task.tenant || "";
  const projectName = rawProject.startsWith("cron:") && sourceJob
    ? formatRoutineProjectName(sourceJob)
    : formatProjectLabel(rawProject, text);
  const failed = task.status === "error" || /\bFAILED\b|failed|traceback|error/i.test(text);
  const missingSkill = lower.includes("skill") && /(not loaded|not found|missing|unavailable|was not loaded)/.test(lower);
  const summaryFromDetails = getString(asRecord(task.result_details), ["operator_summary", "summary_text", "human_summary"], "");
  let summary = summaryFromDetails;
  if (!summary) {
    if (displayCopy.sourceJob) summary = displayCopy.description;
    else if (failed && sourceJob) summary = `${sourceJob} failed during its scheduled run.`;
    else if (failed) summary = "This task records a failed run that needs triage before it can continue.";
    else summary = displayCopy.description || (task.body ? firstMeaningfulLine(task.body) : displayCopy.title);
  }
  let nextAction = getString(asRecord(asRecord(task.result_details).summary), ["next_action", "nextAction"], "");
  if (!nextAction) {
    if (displayCopy.sourceJob) nextAction = "Open the Sources tab for the raw run output, then decide whether Melverick must act or assign the repair to the responsible agent with evidence from a rerun.";
    else if (missingSkill) nextAction = "Ask the responsible agent to verify the required skill is installed, loadable, and attached to the routine profile, then rerun the job.";
    else if (failed && sourceJob) nextAction = "Assign this to the responsible operations agent to inspect the routine failure, fix the cause, and attach evidence from the rerun.";
    else if (task.status === "blocked") nextAction = "Resolve the blocker or add the missing decision/evidence so agents can continue.";
    else if (task.status === "review") nextAction = "Review the attached output and evidence, then move the card to Done or request changes.";
    else nextAction = "Inspect the task context and assign it only if ownership should move to another agent.";
  }
  const reasonLabel = displayCopy.reasonLabel ? displayCopy.reasonLabel.charAt(0).toUpperCase() + displayCopy.reasonLabel.slice(1) : missingSkill ? "Skill loading issue" : failed ? "Routine failure" : task.status === "blocked" ? "Blocked workflow" : task.status === "review" ? "Review required" : "Operational task";
  return { projectName, sourceJob, summary, nextAction, reasonLabel };
}

function firstMeaningfulLine(value: string) {
  return value.split(/\n+/).map((line) => line.trim()).find((line) => line && !/^[-*#]+$/.test(line)) || value.slice(0, 180);
}

function formatRoutineProjectName(sourceJob: string) {
  const lower = sourceJob.toLowerCase();
  if (lower.includes("linkedin")) return "LinkedIn Growth";
  if (lower.includes("lead")) return "Nexius Lead Ops";
  if (lower.includes("mission-control")) return "Mission Control";
  return `Routine · ${sourceJob.replace(/[-_]+/g, " ")}`;
}

function formatProjectLabel(projectId: string, context = "") {
  const lower = `${projectId} ${context}`.toLowerCase();
  if (lower.includes("linkedin")) return "LinkedIn Growth";
  if (projectId.startsWith("cron:")) return "Routines / Scheduled Jobs";
  if (projectId === "scratch") return "General / Scratch";
  if (!projectId) return "Unassigned project";
  return projectId.replace(/^project:/, "").replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatWorkspaceLabel(task: BoardTask) {
  if (task.workspace_path) return task.workspace_path;
  if (task.workspace_kind && task.workspace_kind !== "scratch") return task.workspace_kind;
  if (task.tenant?.startsWith("cron:")) return "Routine runtime";
  return task.workspace_kind || "—";
}

function hasExplicitProgress(summary: DrawerRecord) {
  return ["progress_percent", "progress", "progressPercent"].some((key) => summary[key] !== undefined && summary[key] !== null && summary[key] !== "");
}

function getProjectDrawerData(task: BoardTask): ProjectDrawerData {
  const details = asRecord(task.result_details);
  const summary = asRecord(details.summary);
  const requirements = asRecord(details.requirements);
  const settings = Object.keys(requirements).length ? requirements : asRecord(details.settings);
  const artifacts = task.mission_result?.artifacts.map((artifact) => artifact as unknown as DrawerRecord) ?? [];
  const rawOutputs = asRecordArray(details.outputs);
  const rawEvidence = asRecordArray(details.evidence);
  const projectId = (task.tenant || task.mission_result?.workItem.projectId || task.workflow_template_id || task.id).replace(/^project:/, "");
  const workflowType = getString(details, ["workflow_type", "workflowType"], task.workflow_template_id || (task.tenant?.startsWith("project:") ? "project_workflow" : "kanban_task"));
  const fallbackProgress = task.status === "done" ? 100 : task.status === "running" ? 55 : task.status === "blocked" ? 35 : task.status === "review" ? 70 : task.status === "ready" ? 45 : 15;
  const sources = asRecordArray(details.sources).map(normalizeProjectSource);
  const outputs = rawOutputs.length ? rawOutputs : artifacts;
  const insight = deriveTaskDrawerInsight(task, projectId);
  const explicitProgress = hasExplicitProgress(summary);
  const progress = Math.max(0, Math.min(100, getNumber(summary, ["progress_percent", "progress", "progressPercent"], fallbackProgress)));
  const stages = asRecordArray(details.stages).map((stage, index) => ({
    id: getString(stage, ["id", "stage", "key"], `stage_${index + 1}`),
    label: getString(stage, ["label", "title", "stage"], `Stage ${index + 1}`),
    status: getString(stage, ["status"], "not_started"),
    owner: getString(stage, ["owner", "agent", "tool"], "agent"),
    evidence: getString(stage, ["evidence", "evidence_ref", "evidenceRef"], ""),
  }));
  const derivedStages = stages.length ? stages : [
    { id: "intent_understood", label: "Intent understood", status: "done", owner: "melkizac" },
    { id: "project_linked", label: task.tenant ? "Project linked" : "Project missing", status: task.tenant ? "done" : "blocked", owner: "mission-control" },
    { id: "current_task", label: task.title, status: taskStageStatus(task.status), owner: task.assignee || "unassigned", evidence: task.result ? "result attached" : undefined },
    { id: "verification", label: "QA / verification", status: task.status === "done" ? "done" : "pending", owner: "operator" },
  ];
  return {
    projectId,
    displayProjectId: insight.projectName,
    workflowType,
    objective: insight.summary,
    currentStage: pendingTag(task.status),
    nextAction: insight.nextAction,
    progress,
    progressKnown: explicitProgress || ["running", "review", "done"].includes(task.status),
    needsHuman: shouldSurfaceNeedsYou(task),
    reasonLabel: insight.reasonLabel,
    sources,
    outputs,
    evidence: rawEvidence,
    guardPolicy: getGuardPolicy(task),
    settings: Object.keys(settings).length ? settings : {
      workflow_type: workflowType,
      approval_policy: task.status === "review" || task.status === "blocked" ? "human review / intervention may be required" : "internal execution; approvals only for external or irreversible actions",
      citation_required: sources.length > 0 ? "track citation health per source" : "not specified",
      model_policy: task.model_override || "default Mission Control routing",
    },
    stages: derivedStages,
  };
}

function GuardPolicyPanel({ policy, compact = false }: { policy: GuardPolicy | null; compact?: boolean }) {
  if (!policy) return null;
  const allowed = guardList(policy.allowed_edit_paths ?? policy.allowedEditPaths);
  const evidence = guardList(policy.evidence_required ?? policy.evidenceRequired);
  const warning = guardField(policy, "destructive_command_warning_level", "destructiveCommandWarningLevel", "medium");
  const checkpoint = guardField(policy, "checkpoint_mode", "checkpointMode", "not specified");
  const rollback = guardField(policy, "rollback_artifact_path", "rollbackArtifactPath", "not specified");
  const freeze = Boolean(policy.freeze);
  return (
    <section className={`guard-policy-panel ${compact ? "compact" : ""}`} aria-label="Guard mode policy">
      <div className="guard-policy-head">
        <div><span className="stub-tag">GUARD MODE</span><h3>{guardField(policy, "mode", "mode", "advisory")} safety rails</h3></div>
        <span className={`guard-mode-badge ${freeze ? "frozen" : "advisory"}`}>{freeze ? "Frozen" : "Advisory"}</span>
      </div>
      <div className="guard-policy-grid">
        <div><span>Destructive command warning</span><b>{warning}</b></div>
        <div><span>Checkpoint mode</span><b>{checkpoint}</b></div>
        <div><span>Safe start</span><b>{policy.safe_start_required || policy.safeStartRequired ? "required" : "standard"}</b></div>
        <div><span>Rollback artifact</span><b>{rollback}</b></div>
      </div>
      {allowed.length > 0 && <div className="guard-path-list"><span>Allowed edit paths</span>{allowed.map((item) => <code key={item}>{item}</code>)}</div>}
      {(policy.dirty_repo_policy || policy.dirtyRepoPolicy) && <p className="guard-policy-note">{String(policy.dirty_repo_policy || policy.dirtyRepoPolicy)}</p>}
      {evidence.length > 0 && <div className="guard-evidence-list">{evidence.map((item) => <span key={item}>{item}</span>)}</div>}
    </section>
  );
}

function WorkflowStageList({ stages }: { stages: ProjectDrawerData["stages"] }) {
  return (
    <section className="task-section workflow-stage-list">
      <h3>Workflow timeline</h3>
      <div className="workflow-stage-grid">
        {stages.map((stage) => <div className={`workflow-stage-item stage-${stage.status}`} key={stage.id}><span>{stage.status}</span><b>{stage.label}</b><small>{stage.owner}{stage.evidence ? ` · ${stage.evidence}` : ""}</small></div>)}
      </div>
    </section>
  );
}

function SourcesTab({ task, sources, onSourceAction }: { task: BoardTask; sources: ProjectSourceView[]; onSourceAction: (action: SourceAction, source: SourceActionPayload) => void }) {
  const [draftUri, setDraftUri] = useState("");
  const [draftType, setDraftType] = useState<ProjectSourceType>("url");
  const counts = sources.reduce((acc, source) => ({ ...acc, [source.status]: (acc[source.status] ?? 0) + 1 }), {} as Partial<Record<ProjectSourceStatus, number>>);
  const addDraft = () => {
    const uri = draftUri.trim();
    if (!uri) return;
    onSourceAction("add", { uri, title: uri, type: draftType });
    setDraftUri("");
  };
  return (
    <section className="task-section project-drawer-tab project-sources-tab">
      <div className="task-result-heading source-status-heading">
        <div><span className="stub-tag">Sources</span><h3>Project source materials</h3></div>
        <div className="source-status-model" aria-label="Source processing status summary">
          <span className="source-status-chip ready">{counts.ready ?? 0} ready</span>
          <span className="source-status-chip processing">{counts.processing ?? 0} processing</span>
          <span className="source-status-chip warning">{(counts.warning ?? 0) + (counts.error ?? 0)} attention</span>
        </div>
      </div>
      {task.body && <section className="source-raw-context"><h4>Raw source context</h4><pre>{task.body}</pre></section>}
      <div className="source-add-card" aria-label="Add a source to this project">
        <select value={draftType} onChange={(e) => setDraftType(e.target.value as ProjectSourceType)}>
          <option value="url">URL</option><option value="file">File</option><option value="video">Video</option><option value="audio">Audio</option><option value="note">Note</option>
        </select>
        <input value={draftUri} onChange={(e) => setDraftUri(e.target.value)} placeholder="Paste URL or describe file path to attach…" />
        <button className="ghost tiny" onClick={addDraft}>Add source</button>
      </div>
      {sources.length === 0 && <div className="empty big">No project sources are attached yet. Uploaded files, URLs, videos, audio, transcripts, and extracted text records will appear here with processing and citation health.</div>}
      <div className="project-source-list">
        {sources.map((source) => <SourceStatusCard key={source.id} source={source} onSourceAction={onSourceAction} />)}
      </div>
    </section>
  );
}

function SourceStatusCard({ source, onSourceAction }: { source: ProjectSourceView; onSourceAction: (action: SourceAction, source: SourceActionPayload) => void }) {
  const safePreviewUrl = /^https?:\/\//.test(source.extractedPreviewUrl) || source.extractedPreviewUrl.startsWith("/") ? source.extractedPreviewUrl : "";
  const visibleEntries = recordEntries(source.record).filter(([key]) => !["extracted_text", "extractedText", "extraction", "processing", "citation", "citations"].includes(key)).slice(0, 6);
  return (
    <article className={`project-source-card source-${source.status}`}>
      <div className="project-source-head">
        <div>
          <span className="stub-tag">{source.type}</span>
          <h4>{source.title}</h4>
          {source.uri && <p className="mono">{source.uri}</p>}
        </div>
        <span className={`source-status-pill ${source.status}`}>{source.statusLabel}</span>
      </div>
      <div className="source-health-row">
        <span className={`source-citation ${source.citationTone}`}>Citation: {source.citationHealth}</span>
        {source.meta.filter((item) => item !== source.type && item !== source.uri).map((item) => <span key={item}>{item}</span>)}
      </div>
      {(source.extractedPreview || safePreviewUrl) && (
        <div className="source-preview-box">
          <div className="source-preview-head"><b>Extracted text preview</b>{safePreviewUrl && <a href={safePreviewUrl} target="_blank" rel="noreferrer">Open preview</a>}</div>
          {source.extractedPreview && <p>{source.extractedPreview}</p>}
        </div>
      )}
      {visibleEntries.length > 0 && <dl>{visibleEntries.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{stringifyValue(value)}</dd></div>)}</dl>}
      <div className="source-action-row">
        <button className="ghost tiny" onClick={() => onSourceAction("reprocess", source)}>Reprocess</button>
        <button className="ghost tiny danger" onClick={() => window.confirm(`Remove source ${source.title}?`) && onSourceAction("remove", source)}>Remove</button>
      </div>
    </article>
  );
}

function normalizeOutputArtifact(output: DrawerRecord, index: number): MissionArtifact {
  const rawPath = getString(output, ["path", "uri", "url", "driveUrl", "drive_url"], "");
  const title = getString(output, ["title", "filename", "type"], rawPath || `Output ${index + 1}`);
  const mime = getString(output, ["mime", "content_type", "contentType"], "application/octet-stream");
  const format = getString(output, ["format", "type", "kind"], rawPath.split(".").pop() || "artifact").toLowerCase();
  const qaStatus = getString(output, ["qaStatus", "qa_status", "verification_status", "status", "approval_state"], "not-run");
  const version = getString(output, ["version", "revision"], "v1");
  const url = getString(output, ["url"], "") || (rawPath.startsWith("http") ? rawPath : undefined);
  return {
    id: getString(output, ["output_id", "artifact_id", "artifactId", "id", "uri", "path"], `output_${index}`),
    kind: format.includes("ppt") || format.includes("doc") || format.includes("pdf") || format.includes("markdown") ? "report" : rawPath.startsWith("http") ? "link" : "file",
    title,
    summary: getString(output, ["summary", "description"], "Research-to-deliverable output artifact."),
    filename: getString(output, ["filename"], rawPath.split("/").pop() || title),
    path: rawPath || null,
    url,
    downloadUrl: getString(output, ["downloadUrl", "download_url"], "") || undefined,
    previewUrl: getString(output, ["previewUrl", "preview_url"], "") || url,
    driveUrl: getString(output, ["driveUrl", "drive_url"], "") || (url?.includes("drive.google.com") ? url : undefined),
    mime,
    sizeBytes: Number(output.sizeBytes || output.size_bytes || output.size || 0) || undefined,
    preview: getString(output, ["preview"], ""),
    version,
    qaStatus,
    format,
    createdAt: getString(output, ["createdAt", "created_at", "updated_at"], new Date().toISOString()),
    createdBy: getString(output, ["createdBy", "created_by", "owner"], "mission-control"),
  };
}

function OutputsTab({ outputs }: { outputs: DrawerRecord[] }) {
  const artifacts = outputs.map((output, index) => normalizeOutputArtifact(output, index));
  return (
    <section className="task-section project-drawer-tab">
      <div className="task-result-heading"><span className="stub-tag">Outputs</span><h3>Deliverables and artifacts</h3></div>
      {artifacts.length === 0 && <div className="empty big">No outputs have been generated yet. PPTX, DOCX, PDF, Markdown, citation maps, QA status, and version actions will appear here.</div>}
      <div className="project-output-grid mc-artifact-grid">{artifacts.map((artifact) => <ArtifactCard key={artifact.id} artifact={artifact} />)}</div>
    </section>
  );
}

function WorkflowTasksTab({ task, comment, setComment, onAddComment }: { task: BoardTask; comment: string; setComment: (value: string) => void; onAddComment: () => void }) {
  return (
    <>
      <section className="task-section"><h3>Task graph</h3><div className="task-chip-cloud">{task.parents.map((id) => <em key={id}>parent: {id}</em>)}<span>current: {task.id}</span>{task.children.map((id) => <em key={id}>child: {id}</em>)}{task.parents.length === 0 && task.children.length === 0 && <span>No dependency links yet</span>}</div></section>
      <section className="task-section"><h3>Skills / Links</h3><div className="task-chip-cloud">{(task.skills.length ? task.skills : ["No skills attached"]).map((skill) => <span key={skill}>{skill}</span>)}{task.session_id && <em>session: {task.session_id}</em>}</div></section>
      <section className="task-section"><h3>Run trace</h3>{task.runs.length === 0 && <div className="empty">No worker runs yet.</div>}{task.runs.map((run) => <div className="task-run" key={run.id}><b>{run.profile || "worker"} · {run.status}</b><small>{formatSingaporeTime(run.started_at)} {run.outcome ? `· ${run.outcome}` : ""}</small><p>{run.summary || run.error || "No summary recorded."}</p></div>)}</section>
      <section className="task-section"><h3>Comments</h3>{task.comments.length === 0 && <div className="empty">No comments yet.</div>}{task.comments.map((c) => <div className="task-comment" key={c.id ?? c.created_at}><b>{c.author}</b><small>{formatSingaporeTime(c.created_at)}</small><p>{c.body}</p></div>)}<textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add an operator note…" /><button className="ghost tiny" onClick={() => void onAddComment()}>Add comment</button></section>
      <section className="task-section"><h3>Events</h3>{task.events.length === 0 && <div className="empty">No events recorded.</div>}{task.events.map((event) => <div className="task-event" key={event.id ?? event.created_at}><b>{event.kind}</b><small>{formatSingaporeTime(event.created_at)}</small></div>)}</section>
    </>
  );
}

function SettingsTab({ settings, task }: { settings: DrawerRecord; task: BoardTask }) {
  const entries = recordEntries(settings);
  return (
    <section className="task-section project-drawer-tab">
      <div className="task-result-heading"><span className="stub-tag">Settings</span><h3>Workflow controls</h3></div>
      <div className="settings-summary-card"><b>Approval policy</b><p>Agents may prepare internal drafts and evidence. External publishing, irreversible actions, sensitive-provider use, and destructive changes require Approval Gates.</p></div>
      <div className="task-kv project-task-kv"><Info label="Status" value={pendingTag(task.status)} /><Info label="Assignee" value={task.assignee || "unassigned"} /><Info label="Model" value={task.model_override || "default"} /><Info label="Tenant" value={task.tenant || "—"} /></div>
      {entries.length > 0 && <div className="settings-record-list">{entries.map(([key, value]) => <div key={key}><span>{key.replace(/_/g, " ")}</span><b>{formatRecordValue(value)}</b></div>)}</div>}
    </section>
  );
}

function formatRecordValue(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => formatRecordValue(item)).join(", ");
  if (value && typeof value === "object") {
    const entries = Object.entries(value as DrawerRecord).slice(0, 3).map(([key, item]) => `${key}: ${formatRecordValue(item)}`);
    return entries.join("; ") || "—";
  }
  if (value === undefined || value === null || value === "") return "—";
  return String(value);
}

function Metric({ label, value, sub, tone }: { label: string; value: number | string; sub: string; tone?: "good" | "bad" }) {
  return <div className={`task-metric ${tone ?? ""}`}><span>{label}</span><b>{value}</b><small>{sub}</small></div>;
}

function TaskCard({ task, selected, dragging, onSelect, onDragStart, onDragEnd, onDelete }: { task: BoardTask; selected: boolean; dragging: boolean; onSelect: () => void; onDragStart: (event: DragEvent<HTMLElement>) => void; onDragEnd: () => void; onDelete: (task: BoardTask) => void }) {
  const copy = getTaskDisplayCopy(task);
  return (
    <article className={`task-card task-card-reference task-card-priority-${task.priority_label} ${selected ? "on" : ""} ${dragging ? "dragging" : ""}`} draggable onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="task-card-reference-head">
        <span className={`priority ${task.priority_label}`}>{task.priority_label}</span>
      </div>
      <button className="task-card-main" onClick={onSelect}>
        <h2>{copy.title}</h2>
        <p>{copy.description}</p>
      </button>
      <footer className="task-card-date-footer">
        <span>{formatSingaporeTime(task.updated_at)}</span>
        <button className="task-delete-icon task-delete-floating" aria-label={`Delete ${copy.title}`} title="Delete task" onClick={() => void onDelete(task)}><Icon name="trash" size={15} /></button>
      </footer>
    </article>
  );
}


function TaskHandoffTimeline({ handoffs }: { handoffs: AgentHandoff[] }) {
  return <div className="task-handoff-timeline" aria-label="Task agent handoffs">
    <div className="task-result-heading"><span className="stub-tag">Agent handoffs</span><h3>Ownership requests for this task</h3></div>
    <p className="muted">These records persist from-agent, to-agent, objective, requested output, risk/status, and evidence whenever a task is handed to another agent.</p>
    {handoffs.map((handoff) => <article className={`handoff-card ${handoff.status} ${handoff.risk}`} key={handoff.id}>
      <span className="activity-dot" />
      <div>
        <div className="handoff-card-head"><b>{handoff.from_agent} → {handoff.to_agent}</b><span className={`tag ${handoff.status}`}>{handoff.status}</span></div>
        <h4>{handoff.objective}</h4>
        <p>{handoff.requested_output}</p>
        {handoff.context && <small>{handoff.context}</small>}
        <div className="chip-row compact"><span>{handoff.risk} risk</span><span>{formatSingaporeTime(handoff.updated_at || handoff.created_at)}</span><span>{Array.isArray(handoff.evidence) ? handoff.evidence.length : 0} evidence</span></div>
      </div>
    </article>)}
    {!handoffs.length && <div className="empty">No agent handoffs are attached to this task yet.</div>}
  </div>;
}

function RunTreePanel({ runTree, handoffs = [] }: { runTree?: RunTreePayload | null; handoffs?: AgentHandoff[] }) {
  const summary = runTree?.summary;
  return (
    <section className="task-section run-tree-panel" aria-label="Subagent run tree">
      <div className="task-result-heading"><span className="stub-tag">Subagent Run Tree</span><h3>Delegation and verification chain</h3></div>
      {!runTree?.root && <div className="empty">No delegated run tree is attached yet. When agents spawn subtasks or self-check runs, parent agent, subagent, model/toolset, output, and verification state will appear here.</div>}
      {summary && <div className={`run-tree-summary ${summary.completion_blocked ? "blocked" : ""}`}><span>{summary.total_tasks} tasks</span><span>{summary.total_runs} runs</span><span>{summary.status}</span>{summary.completion_blocked && <b>Completion blocked</b>}</div>}
      {(summary?.blocking_reasons || []).length > 0 && <div className="run-tree-blockers"><b>Failed verification blockers</b><ul>{(summary?.blocking_reasons || []).map((reason) => <li key={reason}>{reason}</li>)}</ul></div>}
      {runTree?.root && <RunTreeTask node={runTree.root} depth={0} />}
      <TaskHandoffTimeline handoffs={handoffs} />
    </section>
  );
}

function RunTreeTask({ node, depth }: { node: RunTreeTaskNode; depth: number }) {
  const verification = node.verification;
  return <div className={`run-tree-node ${verification?.blocked ? "blocked" : verification?.status || ""}`} style={{ marginLeft: depth ? 18 : 0 }}>
    <div className="run-tree-node-head"><div><b>{node.title || node.task_id}</b><small>{node.task_id} · {node.agent || "unassigned"} · {node.status}</small></div><span className={`tag ${verification?.blocked ? "warn" : "muted"}`}>{verification?.status || "pending"}</span></div>
    <div className="chip-row compact"><span>model {node.model || "default"}</span>{(node.toolsets || []).slice(0, 4).map((tool) => <span key={tool}>{tool}</span>)}{node.step_key && <span>step {node.step_key}</span>}</div>
    {verification?.blocked && <p className="muted">{verification.reason || "Verification is blocking completion."}</p>}
    {(node.runs || []).map((run) => <RunTreeRun key={run.id} run={run} />)}
    {(node.children || []).map((child) => <RunTreeTask key={child.id} node={child} depth={depth + 1} />)}
  </div>;
}

function RunTreeRun({ run }: { run: RunTreeRunNode }) {
  return <div className={`run-tree-run ${run.verification?.blocked ? "blocked" : ""}`}>
    <span className="activity-dot" />
    <div><b>{run.agent || "worker"} run {run.run_id}</b><small>{run.status}{run.outcome ? ` · ${run.outcome}` : ""} · {run.started_at || "—"}</small>{run.output && <p>{run.output}</p>}</div>
    <em>{run.verification?.status || "pending"}</em>
  </div>;
}


function TaskEvidenceProofView({ task }: { task: BoardTask }) {
  const result = task.mission_result;
  const artifacts = result?.artifacts ?? task.result_details?.artifacts ?? [];
  const evidence = result?.evidence ?? task.result_details?.evidence ?? [];
  const evidenceGate = result?.evidenceGate ?? task.result_details?.evidenceGate ?? task.result_details?.evidence_gate;
  const approvalGates = result?.approvalGates ?? task.result_details?.approval_gates ?? [];
  const nextActions = result?.nextActions ?? task.result_details?.next_actions ?? [];
  return (
    <>
    <section className="task-section task-mission-result-view" aria-label="Task evidence and proof">
      <div className="task-result-heading"><span className="stub-tag">Evidence & Proof</span><h3>Proof attached to this task</h3></div>
      {!result && !evidenceGate && artifacts.length === 0 && evidence.length === 0 && approvalGates.length === 0 && nextActions.length === 0 && !task.result && !task.result_details && (
        <div className="empty">No proof attached yet. Completion evidence should be captured here as screenshots, links, API responses, artifacts, verification output, or approval records.</div>
      )}
      {result && <ResultSummaryPanel result={result} />}
      {evidenceGate && <EvidenceGateChecklist gate={evidenceGate} />}
      {artifacts.length > 0 && <div className="task-result-block"><h4>Artifacts</h4><div className="mc-artifact-grid">{artifacts.map((artifact) => <ArtifactCard key={artifact.id} artifact={artifact} />)}</div></div>}
      {evidence.length > 0 && <div className="task-result-block"><h4>Evidence</h4><EvidenceTimeline evidence={evidence} /></div>}
      {approvalGates.length > 0 && <div className="task-result-block"><h4>Approval gates</h4>{approvalGates.map((gate) => <div className="task-approval-gate" key={gate.id}><b>{gate.title}</b><span>{gate.status} · {gate.risk}</span><p>{gate.reason}</p></div>)}</div>}
      {nextActions.length > 0 && <div className="task-result-block"><h4>Next actions</h4><ul>{nextActions.map((action) => <li key={action}>{action}</li>)}</ul></div>}
    </section>
    <StructuredResult task={task} />
    {task.result && <section className="task-section"><h3>Raw result</h3><pre>{task.result}</pre></section>}
    </>
  );
}

function EvidenceGateChecklist({ gate }: { gate: EvidenceGateState }) {
  const accepted = gate.acceptedTypes?.length ? gate.acceptedTypes.map(formatEvidenceGateType).join(", ") : "command output, build/test logs, API responses, screenshots, file artifacts, approval notes, or session links";
  return (
    <div className={`task-result-block evidence-gate-card ${gate.status}`}>
      <div className="evidence-gate-head">
        <div>
          <h4>Evidence gate</h4>
          <p>{gate.summary || (gate.required ? "Completion requires evidence before this task can be marked done." : "No completion evidence gate is required for this task.")}</p>
        </div>
        <span className={`tag ${gate.completionBlocked ? "warn" : gate.status === "passed" ? "good" : "muted"}`}>{gate.completionBlocked ? "blocked" : gate.status}</span>
      </div>
      {gate.missingTypes?.length > 0 && <p className="evidence-gate-missing"><b>Missing:</b> {gate.missingTypes.map(formatEvidenceGateType).join(", ")}</p>}
      {gate.checklist?.length > 0 && (
        <ul className="evidence-gate-checklist">
          {gate.checklist.map((item) => <li key={item.type} className={item.satisfied ? "satisfied" : "missing"}><span>{item.satisfied ? "✓" : "!"}</span><b>{item.label || formatEvidenceGateType(item.type)}</b></li>)}
        </ul>
      )}
      <small>Accepted proof: {accepted}.</small>
    </div>
  );
}

function formatEvidenceGateType(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function StructuredResult({ task }: { task: BoardTask }) {
  const details = task.result_details;
  if (!details) return null;
  const blockers = details.blockers ?? [];
  const verification = Object.entries(details.verification ?? {});
  return (
    <section className={`task-section structured-result ${blockers.length ? "has-blockers" : ""}`}>
      <h3>{blockers.length ? "Blockers" : "Structured result"}</h3>
      {details.summary && <p>{typeof details.summary === "string" ? details.summary : stringifyValue(details.summary)}</p>}
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

function AgentAssignmentPanel({ agents, agentTarget, setAgentTarget, onAssignToAgent }: { agents: Agent[]; agentTarget: string; setAgentTarget: (value: string) => void; onAssignToAgent: () => void }) {
  return (
    <section className="task-section agent-assignment-panel">
      <div className="human-action-head">
        <div>
          <span className="stub-tag">AGENT HANDOFF</span>
          <h3>Agent repair suggested</h3>
          <p>This card is an operational task, failed routine, or agent-resolvable issue. Assign it to the agent that should investigate, fix, rerun, and attach evidence.</p>
        </div>
        <span className="tag muted">auto</span>
      </div>
      <div className="agent-handoff-row">
        <select value={agentTarget} onChange={(e) => setAgentTarget(e.target.value)} aria-label="Assign task to agent">
          <option value="">Choose agent…</option>
          {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
        </select>
        <button className="ghost tiny" onClick={() => void onAssignToAgent()}>Assign to agent & open chat</button>
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="task-info"><span>{label}</span><b>{value}</b></div>;
}
