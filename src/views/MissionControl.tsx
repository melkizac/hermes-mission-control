import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { ChatIntentRoutingPreview } from "../components/ChatIntentRoutingPreview";
import { useStore } from "../services/store";
import { buildChatIntentPreview, routeChatIntent, serializeChatIntentDecision } from "../services/chatIntentRouter";
import type { ChatIntentDecision, ChatIntentPreview, ChatMissionContext, ChatRoutineContext, ChatWorkflowContext } from "../services/chatIntentRouter";
import type { AutomationsResponse, BoardResponse, BoardTask, Message, ProjectRecord, ProjectsResponse, WorkflowLibraryResponse } from "../types";

const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

type ChatPermissionMode = "ask-critical" | "full-policy" | "draft-only";
type ChatModelMode = "auto" | "gpt-55-medium" | "fast" | "deep";

type ChatAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
};

type VoiceStatus = "idle" | "listening" | "unsupported" | "error";

type BrowserSpeechRecognitionEvent = Event & {
  resultIndex: number;
  results: SpeechRecognitionResultList;
};

type BrowserSpeechRecognitionErrorEvent = Event & {
  error?: string;
  message?: string;
};

type BrowserSpeechRecognition = EventTarget & {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

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
  const { agents, approvals, sendToAgent } = useStore();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [recentTasks, setRecentTasks] = useState<BoardTask[]>([]);
  const [routines, setRoutines] = useState<ChatRoutineContext[]>([]);
  const [workflows, setWorkflows] = useState<ChatWorkflowContext[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [permissionMode, setPermissionMode] = useState<ChatPermissionMode>("full-policy");
  const [modelMode, setModelMode] = useState<ChatModelMode>("gpt-55-medium");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [hasStartedMainChat, setHasStartedMainChat] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("idle");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceMessage, setVoiceMessage] = useState("Click the mic and speak. I will transcribe your voice into the message box.");
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const voiceShouldListenRef = useRef(false);
  const [routingPreview, setRoutingPreview] = useState<{
    instruction: string;
    decision: ChatIntentDecision;
    preview: ChatIntentPreview;
  } | null>(null);
  const latestMessageRef = useRef<HTMLDivElement | null>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  function resizeComposerTextarea() {
    const textarea = composerTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const styles = window.getComputedStyle(textarea);
    const lineHeight = Number.parseFloat(styles.lineHeight) || 24;
    const paddingY = Number.parseFloat(styles.paddingTop || "0") + Number.parseFloat(styles.paddingBottom || "0");
    const borderY = Number.parseFloat(styles.borderTopWidth || "0") + Number.parseFloat(styles.borderBottomWidth || "0");
    const maxHeight = lineHeight * 10 + paddingY + borderY;
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight + 1 ? "auto" : "hidden";
  }

  useLayoutEffect(() => {
    resizeComposerTextarea();
  }, [draft, hasStartedMainChat]);

  useEffect(() => {
    const onResize = () => resizeComposerTextarea();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    let alive = true;
    async function loadContext() {
      const [projectResult, boardResult, automationResult, workflowResult] = await Promise.allSettled([
        request<ProjectsResponse>("/api/projects"),
        request<BoardResponse>("/api/tasks"),
        request<AutomationsResponse>("/api/automations"),
        request<WorkflowLibraryResponse>("/api/workflows"),
      ]);
      if (!alive) return;
      setProjects(projectResult.status === "fulfilled" ? projectResult.value.projects ?? [] : []);
      setRecentTasks(boardResult.status === "fulfilled" ? (boardResult.value.tasks ?? []).slice(0, 60) : []);
      setRoutines(
        automationResult.status === "fulfilled"
          ? (automationResult.value.automations ?? []).slice(0, 40).map((routine) => ({ id: routine.id, title: routine.name, status: routine.state || routine.status }))
          : [],
      );
      setWorkflows(
        workflowResult.status === "fulfilled"
          ? (workflowResult.value.workflows ?? []).slice(0, 40).map((workflow) => ({ id: workflow.id, title: workflow.name, status: workflow.category }))
          : [],
      );
    }
    void loadContext();
    return () => { alive = false; };
  }, []);

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const visibleMissions = useMemo<ChatMissionContext[]>(
    () => recentTasks
      .map((task) => task.mission_result?.workItem)
      .filter((workItem): workItem is NonNullable<BoardTask["mission_result"]>["workItem"] => Boolean(workItem?.id && workItem?.title))
      .slice(0, 30)
      .map((workItem) => ({ id: workItem.id, title: workItem.title, status: workItem.status })),
    [recentTasks],
  );
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

  useEffect(() => {
    return () => {
      voiceShouldListenRef.current = false;
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  function createSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-SG";
    return recognition;
  }

  function stopVoiceInput() {
    voiceShouldListenRef.current = false;
    recognitionRef.current?.stop();
    setVoiceStatus("idle");
    setVoiceMessage(voiceTranscript ? "Voice captured. Review or send when ready." : "Voice input stopped.");
  }

  function startVoiceInput() {
    setError(null);
    const recognition = createSpeechRecognition();
    if (!recognition) {
      setVoiceStatus("unsupported");
      setVoiceMessage("Voice input needs a browser with Web Speech support. Try Chrome or Edge, then allow microphone access.");
      return;
    }

    recognitionRef.current?.abort();
    recognitionRef.current = recognition;
    voiceShouldListenRef.current = true;
    setHasStartedMainChat(true);
    setVoiceTranscript("");
    setVoiceStatus("listening");
    setVoiceMessage("Listening… speak your instruction to Melkizac.");

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0]?.transcript ?? "";
        if (event.results[index].isFinal) finalText += transcript;
        else interimText += transcript;
      }
      const combined = `${finalText} ${interimText}`.trim();
      if (combined) setVoiceTranscript(combined);
      if (finalText.trim()) {
        const captured = finalText.trim();
        setDraft((current) => `${current}${current.trim() ? " " : ""}${captured}`.trimStart());
        setVoiceMessage("Captured. Keep speaking or tap the mic again to stop.");
      }
    };

    recognition.onerror = (event) => {
      voiceShouldListenRef.current = false;
      setVoiceStatus("error");
      const reason = event.error === "not-allowed"
        ? "Microphone permission was blocked. Allow mic access in the browser and try again."
        : event.error === "no-speech"
          ? "I did not detect speech. Tap the mic and try again."
          : "Voice input could not start. Check browser microphone access and try again.";
      setVoiceMessage(reason);
    };

    recognition.onend = () => {
      if (voiceShouldListenRef.current) {
        try {
          recognition.start();
        } catch {
          setVoiceStatus("idle");
        }
      } else {
        setVoiceStatus((current) => (current === "listening" ? "idle" : current));
      }
    };

    try {
      recognition.start();
    } catch {
      voiceShouldListenRef.current = false;
      setVoiceStatus("error");
      setVoiceMessage("Voice input is already active or unavailable in this browser session.");
    }
  }

  function toggleVoiceInput() {
    if (voiceStatus === "listening") stopVoiceInput();
    else startVoiceInput();
  }

  function renderVoiceActivation(mode: "compact" | "full" = "compact") {
    if (voiceStatus === "idle") return null;
    const isListening = voiceStatus === "listening";
    return (
      <div
        className={`voice-activation ${mode === "full" ? "full-window" : "compact"} ${isListening ? "listening" : "notice"}`}
        role="status"
        aria-live="polite"
        aria-label={voiceTranscript ? `Voice captured: ${voiceTranscript}` : voiceMessage}
      >
        <div className="voice-jarvis-orb" aria-hidden="true">
          <span className="voice-ring ring-one" />
          <span className="voice-ring ring-two" />
          <span className="voice-ring ring-three" />
          <span className="voice-core" />
          <span className="voice-ray ray-one" />
          <span className="voice-ray ray-two" />
          <span className="voice-ray ray-three" />
          <span className="voice-particle particle-one" />
          <span className="voice-particle particle-two" />
          <span className="voice-particle particle-three" />
        </div>
      </div>
    );
  }

  function renderMicButton() {
    const active = voiceStatus === "listening";
    return (
      <button
        className={`clean-chat-mic ${active ? "active" : ""}`}
        type="button"
        aria-label={active ? "Stop voice input" : "Start voice input"}
        aria-pressed={active}
        title={active ? "Stop voice input" : "Start voice input"}
        onClick={toggleVoiceInput}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 14.5a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5.5a3 3 0 0 0 3 3Z" />
          <path d="M18 10.75v.75a6 6 0 0 1-12 0v-.75" />
          <path d="M12 17.5V21" />
          <path d="M8.5 21h7" />
        </svg>
      </button>
    );
  }

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

  function routeInstruction(instruction: string): ChatIntentDecision {
    return routeChatIntent({
      instruction,
      selectedProject,
      selectedMission: null,
      visibleMissions,
      tasks: recentTasks,
      approvals,
      routines,
      workflows,
    });
  }

  function composeInstructionContext(instruction: string, intentDecision: ChatIntentDecision) {
    const context = [
      selectedProject ? `Project: ${projectLabel(selectedProject)} (${selectedProject.id})` : "Project: No Project selected",
      `Permission: ${selectedPermission.promptLabel}`,
      `Model: ${selectedModel.promptLabel}`,
      attachments.length ? `Attachments: ${attachments.map((file) => `${file.name} (${formatBytes(file.size)})`).join(", ")}` : null,
    ].filter(Boolean);
    return `${instruction}\n\n[Mission Control Chat Context]\n${context.join("\n")}\n\n[Mission Control Intent Routing]\n${serializeChatIntentDecision(intentDecision)}`;
  }

  async function submit() {
    const instruction = draft.trim();
    if (!instruction || sending) return;
    setHasStartedMainChat(true);
    setSending(true);
    setError(null);
    const intentDecision = routeInstruction(instruction);
    const preview = buildChatIntentPreview(intentDecision);
    setRoutingPreview({ instruction, decision: intentDecision, preview });
    if (!preview.canProceed) {
      setSending(false);
      setError(preview.suggestedQuestion ?? "Please clarify the target before I route this.");
      window.requestAnimationFrame(() => composerTextareaRef.current?.focus());
      return;
    }
    try {
      await sendToAgent("default", composeInstructionContext(instruction, intentDecision));
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
            ref={composerTextareaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder="Do anything"
            rows={2}
          />

          {renderVoiceActivation()}

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
              {renderMicButton()}
              <button className="clean-chat-send" type="submit" disabled={sending || !draft.trim()} aria-label="Send message">↑</button>
            </div>
          </div>
        </form>

        <div className="clean-project-strip">
          <span>▱</span>
          <select
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
            aria-label="Project selector"
          >
            <option value="">No Project selected</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{projectLabel(project)}</option>)}
          </select>
        </div>

        {error && <div className="clean-chat-error">{error}</div>}

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

        <main className={`main-chat-history ${voiceStatus !== "idle" ? "voice-mode" : ""}`} aria-label={voiceStatus !== "idle" ? "Voice input activation" : "Melkizac conversation history"}>
          {voiceStatus !== "idle" ? (
            renderVoiceActivation("full")
          ) : mainChatMessages.length === 0 ? (
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
          {routingPreview && (
            <ChatIntentRoutingPreview
              preview={routingPreview.preview}
              decision={routingPreview.decision}
              sending={sending}
              onEdit={() => composerTextareaRef.current?.focus()}
            />
          )}
          <textarea
            ref={composerTextareaRef}
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
                  onChange={(event) => setSelectedProjectId(event.target.value)}
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
              {renderMicButton()}
              <button className="clean-chat-send" type="submit" disabled={sending || !draft.trim()} aria-label="Send message">↑</button>
            </div>
          </div>
          {error && <div className="clean-chat-error">{error}</div>}
        </form>
      </section>
    </div>
  );
}
