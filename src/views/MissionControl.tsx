import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { useStore } from "../services/store";
import type { BoardResponse, BoardTask, Message, ProjectRecord, ProjectsResponse } from "../types";

const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

type ChatPermissionMode = "ask-critical" | "full-policy" | "draft-only";
type ChatModelMode = "auto" | "gpt-55-medium" | "fast" | "deep";

type ChatAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
};

const permissionModeOptions: Array<{ value: ChatPermissionMode; label: string; promptLabel: string }> = [
  { value: "full-policy", label: "Full access", promptLabel: "Full access within policy" },
  { value: "ask-critical", label: "Ask permission", promptLabel: "Ask before critical actions" },
  { value: "draft-only", label: "Draft only", promptLabel: "Draft only" },
];

const modelModeOptions: Array<{ value: ChatModelMode; label: string; promptLabel: string }> = [
  { value: "auto", label: "AUTO", promptLabel: "AUTO — Melkizac decides" },
  { value: "gpt-55-medium", label: "5.5 Medium", promptLabel: "5.5 Medium" },
  { value: "fast", label: "Fast", promptLabel: "Fast" },
  { value: "deep", label: "Deep", promptLabel: "Deep reasoning" },
];

async function request<T>(path: string): Promise<T> {
  const url = `${window.location.protocol}//${window.location.host}${path}`;
  const res = await fetch(url, { credentials: "include", headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${path}: ${res.statusText}`);
  return res.json() as Promise<T>;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)}MB`;
}

function projectLabel(project: ProjectRecord) {
  return project.name || project.id;
}

function taskMatchesProject(task: BoardTask, project: ProjectRecord) {
  const haystack = [task.tenant, task.workspace_path, task.title, task.body, task.assignee].filter(Boolean).join(" ").toLowerCase();
  return [project.id, project.name, project.path].filter(Boolean).some((value) => haystack.includes(String(value).toLowerCase()));
}

function missionRows(project: ProjectRecord | null, tasks: BoardTask[]) {
  if (!project) return [];
  const sourceTasks = tasks.filter((task) => taskMatchesProject(task, project));
  const projectGoals = project.goals ?? [];
  return [
    ...projectGoals.map((goal) => {
      const title = goal.title || goal.name || goal.id || "Untitled mission";
      return {
        id: goal.id || title,
        title,
        status: goal.status || goal.readiness || "goal",
      };
    }),
    ...sourceTasks.map((task) => ({
      id: task.id,
      title: task.mission_result?.workItem?.title || task.title,
      status: task.status,
    })),
  ].filter((row, index, rows) => rows.findIndex((candidate) => candidate.id === row.id || candidate.title === row.title) === index).slice(0, 8);
}

function isRenderableChatMessage(message: Message) {
  return (message.role === "user" || message.role === "agent") && Boolean(message.text?.trim() || message.attachments?.length);
}

function chatMessageLabel(message: Message) {
  if (message.role === "user") return "You";
  return "Melkizac";
}

function chatMessageTime(message: Message) {
  return message.at || (message.ts ? new Date(message.ts * 1000).toLocaleString() : "");
}

function chatSessionLabel(message: Message) {
  if (message.sessionId) return `Session ${message.sessionId}`;
  if (message.source === "web-ui") return "Web UI · Chat";
  return message.source || "Mission Control";
}

function visibleChatText(message: Message) {
  const raw = message.text || "";
  const marker = "[Mission Control Chat Context]";
  const index = raw.indexOf(marker);
  return (index >= 0 ? raw.slice(0, index) : raw).trim();
}

export function MissionControl() {
  const { agents, sendToAgent } = useStore();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [tasks, setTasks] = useState<BoardTask[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedMissionId, setSelectedMissionId] = useState("");
  const [permissionMode, setPermissionMode] = useState<ChatPermissionMode>("full-policy");
  const [modelMode, setModelMode] = useState<ChatModelMode>("gpt-55-medium");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [hasStartedMainChat, setHasStartedMainChat] = useState(false);
  const latestMessageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    async function loadContext() {
      try {
        const [projectData, boardData] = await Promise.all([
          request<ProjectsResponse>("/api/projects"),
          request<BoardResponse>("/api/task-board"),
        ]);
        if (!alive) return;
        setProjects(projectData.projects ?? []);
        setTasks(boardData.tasks ?? []);
      } catch {
        if (alive) {
          setProjects([]);
          setTasks([]);
        }
      }
    }
    void loadContext();
    return () => { alive = false; };
  }, []);

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const rows = useMemo(() => missionRows(selectedProject, tasks), [selectedProject, tasks]);
  const selectedMission = rows.find((mission) => mission.id === selectedMissionId) ?? null;
  const selectedPermission = permissionModeOptions.find((option) => option.value === permissionMode) ?? permissionModeOptions[0];
  const selectedModel = modelModeOptions.find((option) => option.value === modelMode) ?? modelModeOptions[0];
  const melkizac = agents.find((agent) => agent.id === "default") ?? agents[0];
  const mainChatMessages = useMemo(
    () => (melkizac?.messages ?? []).filter(isRenderableChatMessage).slice(-80),
    [melkizac?.messages],
  );

  useEffect(() => {
    if (!hasStartedMainChat) return;
    const frame = window.requestAnimationFrame(() => {
      latestMessageRef.current?.scrollIntoView({ block: "end", behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hasStartedMainChat, mainChatMessages.length, sending]);

  function handleAttachmentFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const next: ChatAttachment[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setError(`${file.name} is larger than Max 50MB.`);
        continue;
      }
      next.push({ id: `${file.name}-${file.size}-${file.lastModified}`, name: file.name, size: file.size, type: file.type || "file" });
    }
    if (next.length) setAttachments((current) => [...current, ...next]);
  }

  function composeInstructionContext(instruction: string) {
    const context = [
      selectedProject ? `Project: ${projectLabel(selectedProject)} (${selectedProject.id})` : "Project: No Project selected",
      selectedMission ? `Mission: ${selectedMission.title} (${selectedMission.id})` : null,
      `Permission: ${selectedPermission.promptLabel}`,
      `Model: ${selectedModel.promptLabel}`,
      attachments.length ? `Attachments: ${attachments.map((file) => `${file.name} (${formatBytes(file.size)})`).join(", ")}` : null,
    ].filter(Boolean);
    return `${instruction}\n\n[Mission Control Chat Context]\n${context.join("\n")}`;
  }

  async function submit() {
    const instruction = draft.trim();
    if (!instruction || sending) return;
    setHasStartedMainChat(true);
    setSending(true);
    setError(null);
    try {
      await sendToAgent("default", composeInstructionContext(instruction));
      setDraft("");
      setAttachments([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mission Control could not send this instruction.");
    } finally {
      setSending(false);
    }
  }

  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  return !hasStartedMainChat ? (
    <div className="clean-chat-page">
      <section className="clean-chat-shell" aria-label="Clean Chat command center">
        <h1>{selectedProject ? `What should we work on in ${projectLabel(selectedProject)}?` : "What should Melkizac work on?"}</h1>

        <form className="clean-chat-composer" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder="Do anything"
            rows={2}
          />

          {attachments.length > 0 && (
            <div className="clean-chat-attachments" aria-label="Attached files">
              {attachments.map((file) => (
                <button type="button" key={file.id} onClick={() => setAttachments((current) => current.filter((item) => item.id !== file.id))}>
                  {file.name} <span>{formatBytes(file.size)}</span> ×
                </button>
              ))}
            </div>
          )}

          <div className="clean-chat-toolbar">
            <div className="clean-chat-left-controls">
              <label className="clean-chat-plus" title="Add document or image. Max 50MB">
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.json"
                  onChange={(event) => {
                    handleAttachmentFiles(event.target.files);
                    event.currentTarget.value = "";
                  }}
                />
                <span>＋</span>
                <small>Add document or image · Max 50MB</small>
              </label>

              <label className="clean-select clean-permission-select">
                <span>⌾</span>
                <select value={permissionMode} onChange={(event) => setPermissionMode(event.target.value as ChatPermissionMode)} aria-label="Permission mode">
                  {permissionModeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            </div>

            <div className="clean-chat-right-controls">
              <label className="clean-select">
                <select value={modelMode} onChange={(event) => setModelMode(event.target.value as ChatModelMode)} aria-label="AI model selector">
                  {modelModeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <button className="clean-chat-mic" type="button" aria-label="Voice input">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M12 14.5a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5.5a3 3 0 0 0 3 3Z" />
                  <path d="M18 10.75v.75a6 6 0 0 1-12 0v-.75" />
                  <path d="M12 17.5V21" />
                  <path d="M8.5 21h7" />
                </svg>
              </button>
              <button className="clean-chat-send" type="submit" disabled={sending || !draft.trim()} aria-label="Send message">↑</button>
            </div>
          </div>
        </form>

        <div className="clean-project-strip">
          <span>▱</span>
          <select
            value={selectedProjectId}
            onChange={(event) => { setSelectedProjectId(event.target.value); setSelectedMissionId(""); }}
            aria-label="Project selector"
          >
            <option value="">No Project selected</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{projectLabel(project)}</option>)}
          </select>
        </div>

        {error && <div className="clean-chat-error">{error}</div>}

        {selectedProject && (
          <div className="clean-mission-list" aria-label="Missions created in selected project">
            {rows.map((mission) => (
              <button
                type="button"
                className={selectedMissionId === mission.id ? "selected" : ""}
                key={mission.id}
                onClick={() => setSelectedMissionId(mission.id)}
              >
                <span>⌁</span>
                <em>{mission.title}</em>
              </button>
            ))}
            {rows.length === 0 && (
              <div className="clean-mission-empty">
                <span>⌘</span>
                <em>No missions in this project yet</em>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  ) : (
    <div className="clean-chat-page main-chat-surface">
      <section className="main-chat-shell" aria-label="Melkizac chat conversation">
        <header className="main-chat-header">
          <div className="main-chat-header-identity">
            <span className="main-chat-avatar">ME</span>
            <div>
              <h1>Melkizac — All Groups Agent</h1>
              <p>{selectedProject ? projectLabel(selectedProject) : "Main Chat"}</p>
            </div>
            <span className="main-chat-status"><i /> {melkizac?.statusLabel || "Active"} · {melkizac?.activityState || "active"}</span>
          </div>
          <button className="main-chat-details" type="button" aria-label="Open Melkizac details">Details</button>
        </header>

        <main className="main-chat-history" aria-label="Melkizac conversation history">
          {mainChatMessages.length === 0 ? (
            <div className="main-chat-empty-state">
              <span className="main-chat-avatar">ME</span>
              <strong>Starting the Melkizac conversation…</strong>
              <p>Your message will appear here while Melkizac responds.</p>
            </div>
          ) : (
            mainChatMessages.map((message) => {
              const isUser = message.role === "user";
              return (
                <article className={`main-chat-row ${isUser ? "user" : "agent"}`} key={`${message.id}-${message.role}`}>
                  {!isUser && <span className="main-chat-avatar">ME</span>}
                  <div className="main-chat-message-stack">
                    <div className="main-chat-meta">
                      <strong>{chatMessageLabel(message)}</strong>
                      <span>{chatSessionLabel(message)}</span>
                      <time>{chatMessageTime(message)}</time>
                    </div>
                    {message.replyTo && <div className="main-chat-reply-context">Replying to {message.replyTo.author}: {message.replyTo.text}</div>}
                    <div className="main-chat-bubble">
                      <p>{visibleChatText(message)}</p>
                      {message.attachments?.length ? (
                        <div className="main-chat-message-attachments">
                          {message.attachments.map((attachment) => (
                            <span key={attachment.id || attachment.filename}>{attachment.filename}</span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {isUser && <span className="main-chat-user-avatar">M</span>}
                </article>
              );
            })
          )}
          <div ref={latestMessageRef} className="main-chat-latest-sentinel" aria-hidden="true" />
        </main>

        <form className="main-chat-composer" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder="Send a task or message to Melkizac..."
            rows={2}
          />

          {attachments.length > 0 && (
            <div className="clean-chat-attachments" aria-label="Attached files">
              {attachments.map((file) => (
                <button type="button" key={file.id} onClick={() => setAttachments((current) => current.filter((item) => item.id !== file.id))}>
                  {file.name} <span>{formatBytes(file.size)}</span> ×
                </button>
              ))}
            </div>
          )}

          <div className="main-chat-composer-toolbar">
            <div className="main-chat-left-controls">
              <label className="clean-chat-plus" title="Add document or image. Max 50MB">
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.json"
                  onChange={(event) => {
                    handleAttachmentFiles(event.target.files);
                    event.currentTarget.value = "";
                  }}
                />
                <span>＋</span>
                <small>Add document or image · Max 50MB</small>
              </label>

              <label className="clean-select clean-permission-select">
                <span>⌾</span>
                <select value={permissionMode} onChange={(event) => setPermissionMode(event.target.value as ChatPermissionMode)} aria-label="Permission mode">
                  {permissionModeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>

              <label className="clean-select main-chat-project-select">
                <span>▱</span>
                <select
                  value={selectedProjectId}
                  onChange={(event) => { setSelectedProjectId(event.target.value); setSelectedMissionId(""); }}
                  aria-label="Project selector"
                >
                  <option value="">No Project selected</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{projectLabel(project)}</option>)}
                </select>
              </label>
            </div>

            <div className="main-chat-right-controls">
              <label className="clean-select">
                <select value={modelMode} onChange={(event) => setModelMode(event.target.value as ChatModelMode)} aria-label="AI model selector">
                  {modelModeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <button className="clean-chat-mic" type="button" aria-label="Voice input">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M12 14.5a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5.5a3 3 0 0 0 3 3Z" />
                  <path d="M18 10.75v.75a6 6 0 0 1-12 0v-.75" />
                  <path d="M12 17.5V21" />
                  <path d="M8.5 21h7" />
                </svg>
              </button>
              <button className="clean-chat-send" type="submit" disabled={sending || !draft.trim()} aria-label="Send message">↑</button>
            </div>
          </div>
          {error && <div className="clean-chat-error">{error}</div>}
        </form>
      </section>
    </div>
  );
}
