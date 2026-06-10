import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import voiceHudReference from "../assets/voice-hud-reference.jpg";
import { useStore } from "../services/store";
import { cachedJsonRequest } from "../services/queryCache";
import { buildChatIntentPreview, confidenceFromScore, routeChatIntent, serializeChatIntentDecision } from "../services/chatIntentRouter";
import type { ChatIntentDecision, ChatIntentPreview, ChatIntentNextAction, ChatIntentType, ChatMissionContext, ChatRoutineContext, ChatWorkflowContext } from "../services/chatIntentRouter";
import type { AutomationsResponse, BoardResponse, BoardTask, Message, ProjectRecord, ProjectsResponse, WorkflowLaunchResponse, WorkflowLibraryResponse } from "../types";

const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

type ChatPermissionMode = "ask-critical" | "full-policy" | "draft-only";
type ChatModelMode = "auto" | "gpt-55-medium" | "fast" | "deep";

type ChatIntentRoutingActionId =
  | "send_to_agent"
  | "create_task"
  | "create_project_task"
  | "create_project"
  | "start_research_deliverable"
  | "launch_workflow"
  | "recommend_routine"
  | "create_routine_draft"
  | "clarify";


type ChatAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
};

type MainChatPendingMessage = {
  text: string;
  attachments: ChatAttachment[];
};

type AgentOsIntentRoute = {
  intent_type?: string;
  research_deliverable_intent?: string | null;
  confidence?: number;
  rationale?: string;
  project_required?: boolean;
  suggested_project_id?: string | null;
  create_task?: boolean;
  create_project?: boolean;
  launch_workflow?: boolean;
  recommend_routine?: boolean;
  one_time_reply?: boolean;
  agent_id?: string;
  tools_required?: string[];
  skills_required?: string[];
  evidence_required?: boolean;
  approval_required?: boolean;
  prompt?: string;
  context?: Record<string, unknown>;
  workflow_candidate?: { id?: string; name?: string; agent_id?: string; approval_required?: boolean };
};

type AgentOsIntentRouteResponse = {
  ok?: boolean;
  route?: AgentOsIntentRoute;
  error?: string;
};

type AgentOsKanbanCreationResponse = {
  ok?: boolean;
  mode?: "project" | "task";
  project_id?: string;
  tenant?: string;
  workflow_type?: string | null;
  graph_template?: string | null;
  task_ids?: Record<string, string>;
  tasks?: BoardTask[];
  chat_card?: {
    kind?: string;
    title?: string;
    detected_intent?: string | null;
    outputs?: string[];
    status?: string;
    actions?: string[];
  };
  idempotent?: boolean;
  error?: string;
};

type ResearchWorkflowCard = {
  title: string;
  projectId?: string;
  workflowType?: string | null;
  graphTemplate?: string | null;
  taskIds: Record<string, string>;
  tasks: BoardTask[];
  outputs: string[];
  status: string;
  idempotent?: boolean;
};

type VoiceStatus = "idle" | "listening" | "sending" | "speaking" | "ready" | "unsupported" | "error";

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${window.location.protocol}//${window.location.host}${path}`;
  const headers = new Headers(init?.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers,
  });
  if (!res.ok) throw new Error(`${path}: ${res.statusText}`);
  return res.json() as Promise<T>;
}

function cachedRequest<T>(key: string, path: string, options: { staleAfterMs?: number } = {}) {
  return cachedJsonRequest(key, () => request<T>(path), { staleAfterMs: options.staleAfterMs ?? 45_000 });
}

function scheduleProgressiveHydration(callback: () => void) {
  let cancelled = false;
  let idleId: number | null = null;
  const frameId = window.requestAnimationFrame(() => {
    const run = () => {
      if (!cancelled) callback();
    };
    const requestIdle = window.requestIdleCallback as ((cb: IdleRequestCallback, opts?: IdleRequestOptions) => number) | undefined;
    if (requestIdle) idleId = requestIdle(run, { timeout: 1000 });
    else window.setTimeout(run, 80);
  });
  return () => {
    cancelled = true;
    window.cancelAnimationFrame(frameId);
    const cancelIdle = window.cancelIdleCallback as ((handle: number) => void) | undefined;
    if (idleId !== null && cancelIdle) cancelIdle(idleId);
  };
}

function shouldHydrateWorkflowContext(instruction: string) {
  return /\b(workflow|workflows|playbook|runbook|routine|automation|automate|launch)\b/i.test(instruction);
}

function shouldUseMissionControlRouter(instruction: string, hasAttachments: boolean) {
  const normalized = instruction.trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized) return false;
  const explicitOperationPhrases = [
    "create task",
    "add task",
    "track this",
    "make this a task",
    "turn this into a task",
    "turn this into a card",
    "convert this to a task",
    "start project",
    "create project",
    "project kickoff",
    "launch workflow",
    "start workflow",
    "run workflow",
    "research deliverable",
    "start research",
    "create deck",
    "generate deck",
    "create pptx",
    "generate pptx",
    "create report",
    "generate report",
    "create proposal",
    "generate proposal",
    "schedule routine",
    "create routine",
    "draft routine",
    "set up routine",
    "create automation",
    "set up automation",
  ];
  if (explicitOperationPhrases.some((phrase) => normalized.includes(phrase))) return true;
  const explicitOperationPattern = hasAttachments
    ? /\b(turn|convert|build|generate|create|start|launch|schedule|automate|track)\b.*\b(task|card|project|workflow|routine|automation|deck|slides|pptx|docx|proposal|report|deliverable)\b/
    : /\b(create|add|track|start|launch|run|schedule|automate)\b\s+(?:a |an |the |this |new )?\b(task|card|project|workflow|routine|automation|research deliverable)\b/;
  return explicitOperationPattern.test(normalized);
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)}MB`;
}

function projectLabel(project: ProjectRecord) {
  return project.name || project.id;
}

function slugFromInstruction(prefix: string, instruction: string) {
  const compact = instruction.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 56) || "chat-request";
  return `${prefix}-${compact}`.replace(/-+$/g, "");
}

function frontendIntentFromAgentOs(route: AgentOsIntentRoute): ChatIntentType {
  if (route.intent_type === "clarification") return "clarification";
  if (route.one_time_reply || route.intent_type === "one_time_reply") return "one_time_reply";
  if (route.recommend_routine || route.intent_type === "routine_recommendation") return "routine_recommendation";
  if (route.launch_workflow || route.intent_type === "workflow") return "workflow";
  if (route.create_project || route.intent_type === "project") return "project";
  if (route.create_task || route.intent_type === "kanban_task") return "kanban_task";
  return "create_one_time_task";
}

function frontendNextActionFromAgentOs(route: AgentOsIntentRoute): ChatIntentNextAction {
  if (route.intent_type === "clarification") return "ask_clarifying_question";
  if (route.create_project || route.launch_workflow || route.recommend_routine) return "show_mission_proposal";
  if (route.create_task) return "update_existing_work";
  return "proceed";
}

function singaporeDaypartGreeting() {
  const singaporeHour = Number(new Intl.DateTimeFormat("en-SG", {
    timeZone: "Asia/Singapore",
    hour: "numeric",
    hour12: false,
  }).format(new Date()));

  if (singaporeHour < 12) return "Good morning";
  if (singaporeHour < 18) return "Good afternoon";
  return "Good evening";
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
  const markers = ["[Mission Control Chat Context]", "[Mission Control Intent Routing]"];
  const firstInternalMarker = markers
    .map((marker) => raw.indexOf(marker))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  return (firstInternalMarker === undefined ? raw : raw.slice(0, firstInternalMarker)).trim();
}

function formatRunDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function MissionControl() {
  const { agents, approvals, sendToAgent, setView, stopProcessingForAgent, refreshAgent } = useStore();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [recentTasks, setRecentTasks] = useState<BoardTask[]>([]);
  const [routines, setRoutines] = useState<ChatRoutineContext[]>([]);
  const [workflows, setWorkflows] = useState<ChatWorkflowContext[]>([]);
  const [contextHydrating, setContextHydrating] = useState(false);
  const [workflowContextHydrating, setWorkflowContextHydrating] = useState(false);
  const [workflowContextLoaded, setWorkflowContextLoaded] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [permissionMode, setPermissionMode] = useState<ChatPermissionMode>("full-policy");
  const [modelMode, setModelMode] = useState<ChatModelMode>("gpt-55-medium");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [hasStartedMainChat, setHasStartedMainChat] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("idle");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceMessage, setVoiceMessage] = useState("Click the mic and speak. I will transcribe your voice into the message box.");
  const [voiceReplyMode, setVoiceReplyMode] = useState(false);
  const [voiceReplyBaselineId, setVoiceReplyBaselineId] = useState("");
  const [spokenMessageId, setSpokenMessageId] = useState("");
  const [speechPlaying, setSpeechPlaying] = useState(false);
  const [voiceReplyText, setVoiceReplyText] = useState("");
  const [voiceReplyNeedsTap, setVoiceReplyNeedsTap] = useState(false);
  const [voiceVisual, setVoiceVisual] = useState({ energy: 1, pitch: 1, rate: 1 });
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const voiceShouldListenRef = useRef(false);
  const voiceAnimationTimerRef = useRef<number | null>(null);
  const voiceSpeechStartTimerRef = useRef<number | null>(null);
  const pendingVoiceReplyRef = useRef<Message | null>(null);
  const speechPrimedRef = useRef(false);
  const draftRef = useRef("");
  const previousVoiceStatusRef = useRef<VoiceStatus>("idle");
  const [, setRoutingPreview] = useState<{
    instruction: string;
    decision: ChatIntentDecision;
    preview: ChatIntentPreview;
  } | null>(null);
  const [routingActionBusy, setRoutingActionBusy] = useState<ChatIntentRoutingActionId | null>(null);
  const [routingActionMessage, setRoutingActionMessage] = useState<string | null>(null);
  const [routingActionError, setRoutingActionError] = useState<string | null>(null);
  const [researchWorkflowCard, setResearchWorkflowCard] = useState<ResearchWorkflowCard | null>(null);
  const [pendingMainMessage, setPendingMainMessage] = useState<MainChatPendingMessage | null>(null);
  const [processingStartedAt, setProcessingStartedAt] = useState<number | null>(null);
  const [processingNow, setProcessingNow] = useState(() => Date.now());
  const latestMessageRef = useRef<HTMLDivElement | null>(null);
  const mainChatHistoryRef = useRef<HTMLElement | null>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const activeMainRequestRef = useRef<{ id: string; controller: AbortController } | null>(null);

  function resizeComposerTextarea() {
    const textarea = composerTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const styles = window.getComputedStyle(textarea);
    const lineHeight = Number.parseFloat(styles.lineHeight) || 24;
    const paddingY = Number.parseFloat(styles.paddingTop || "0") + Number.parseFloat(styles.paddingBottom || "0");
    const borderY = Number.parseFloat(styles.borderTopWidth || "0") + Number.parseFloat(styles.borderBottomWidth || "0");
    const minHeight = lineHeight * 2 + paddingY + borderY;
    const maxHeight = lineHeight * 10 + paddingY + borderY;
    const nextHeight = Math.max(minHeight, Math.min(textarea.scrollHeight, maxHeight));
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight + 1 ? "auto" : "hidden";
  }

  useLayoutEffect(() => {
    resizeComposerTextarea();
  }, [draft, hasStartedMainChat]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    const onResize = () => resizeComposerTextarea();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Do not lazy-load the full default agent transcript on fresh Chat mount.
  // It is a multi-second detail endpoint and made simple sends compete with a
  // history refresh. The clean hero can render from the lightweight roster; the
  // current exchange is appended optimistically and then completed via the
  // lightweight request-status poller.

  useEffect(() => {
    let alive = true;
    let contextTimer: number | null = null;
    const cancelHydration = scheduleProgressiveHydration(() => {
      contextTimer = window.setTimeout(() => {
        if (!alive) return;
        setContextHydrating(true);
        async function loadContext() {
          const [projectResult, boardResult, automationResult] = await Promise.allSettled([
            cachedRequest<ProjectsResponse>("main-chat:projects", "/api/projects", { staleAfterMs: 60_000 }),
            cachedRequest<BoardResponse>("main-chat:tasks", "/api/tasks", { staleAfterMs: 30_000 }),
            cachedRequest<AutomationsResponse>("main-chat:automations", "/api/automations", { staleAfterMs: 45_000 }),
          ]);
          if (!alive) return;
          setProjects(projectResult.status === "fulfilled" ? projectResult.value.projects ?? [] : []);
          setRecentTasks(boardResult.status === "fulfilled" ? (boardResult.value.tasks ?? []).slice(0, 60) : []);
          setRoutines(
            automationResult.status === "fulfilled"
              ? (automationResult.value.automations ?? []).slice(0, 40).map((routine) => ({ id: routine.id, title: routine.name, status: routine.state || routine.status }))
              : [],
          );
        }
        void loadContext().finally(() => {
          if (alive) setContextHydrating(false);
        });
      }, 9000);
    });
    return () => {
      alive = false;
      if (contextTimer !== null) window.clearTimeout(contextTimer);
      cancelHydration();
    };
  }, []);

  const ensureWorkflowContext = useCallback(async () => {
    if (workflowContextLoaded || workflowContextHydrating) return workflows;
    setWorkflowContextHydrating(true);
    try {
      const response = await cachedRequest<WorkflowLibraryResponse>("main-chat:workflows", "/api/workflows", { staleAfterMs: 120_000 });
      const next = (response.workflows ?? []).slice(0, 40).map((workflow) => ({ id: workflow.id, title: workflow.name, status: workflow.category }));
      setWorkflows(next);
      setWorkflowContextLoaded(true);
      return next;
    } catch {
      return workflows;
    } finally {
      setWorkflowContextHydrating(false);
    }
  }, [workflowContextHydrating, workflowContextLoaded, workflows]);

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const visibleMissions = useMemo<ChatMissionContext[]>(
    () => recentTasks
      .map((task) => task.mission_result?.workItem)
      .filter((workItem): workItem is NonNullable<BoardTask["mission_result"]>["workItem"] => Boolean(workItem?.id && workItem?.title))
      .slice(0, 30)
      .map((workItem) => ({ id: workItem.id, title: workItem.title, status: workItem.status })),
    [recentTasks],
  );
  const selectedModel = modelModeOptions.find((option) => option.value === modelMode) ?? modelModeOptions[0];
  const selectedPermission = permissionModeOptions.find((option) => option.value === permissionMode) ?? permissionModeOptions[0];
  const greeting = singaporeDaypartGreeting();
  const heroPrompt = selectedProject ? `What should we work on in “${projectLabel(selectedProject)}”?` : `${greeting}, Melverick!`;
  const melkizac = agents.find((agent) => agent.id === "default") ?? agents[0];
  const mainChatMessages = useMemo(
    () => (melkizac?.messages ?? []).filter(isRenderableChatMessage).slice(-80),
    [melkizac?.messages],
  );
  const pendingMainMessageAlreadyVisible = useMemo(
    () => Boolean(pendingMainMessage && mainChatMessages.some((message) => message.role === "user" && visibleChatText(message) === pendingMainMessage.text)),
    [mainChatMessages, pendingMainMessage],
  );
  const visiblePendingMainMessage = pendingMainMessageAlreadyVisible ? null : pendingMainMessage;
  const activeMainBackendRequestId = useMemo(() => {
    const activeIds = new Set(melkizac?.processingRequests ?? []);
    if (!activeIds.size) return null;
    const activeUserRequests = [...mainChatMessages]
      .reverse()
      .filter((message) => message.role === "user" && message.requestId && activeIds.has(message.requestId));
    for (const userMessage of activeUserRequests) {
      const completed = mainChatMessages.some((message) => message.requestId === userMessage.requestId && (message.role === "agent" || message.role === "system"));
      if (!completed) return userMessage.requestId ?? null;
    }
    return melkizac?.processingRequests?.[0] ?? null;
  }, [mainChatMessages, melkizac?.processingRequests]);
  const activeMainBackendRequestDetail = useMemo(
    () => (melkizac?.processingRequestDetails ?? []).find((item) => item.id === activeMainBackendRequestId),
    [activeMainBackendRequestId, melkizac?.processingRequestDetails],
  );
  const activeMainBackendUserMessage = useMemo(
    () => mainChatMessages.find((message) => message.role === "user" && message.requestId === activeMainBackendRequestId),
    [activeMainBackendRequestId, mainChatMessages],
  );
  const activeMainBackendStartedAt = activeMainBackendUserMessage?.ts
    ? activeMainBackendUserMessage.ts * 1000
    : activeMainBackendRequestDetail?.started_at
      ? activeMainBackendRequestDetail.started_at * 1000
      : null;
  const effectiveProcessingStartedAt = processingStartedAt ?? activeMainBackendStartedAt;
  const isMainChatProcessing = sending || Boolean(routingActionBusy) || Boolean(activeMainBackendRequestId);
  const shouldShowMainChatTranscript = hasStartedMainChat || Boolean(visiblePendingMainMessage) || Boolean(activeMainBackendRequestId);
  const processingElapsedLabel = effectiveProcessingStartedAt ? formatRunDuration(processingNow - effectiveProcessingStartedAt) : "0:00";

  function scrollToLatestMainChatMessage() {
    window.requestAnimationFrame(() => {
      latestMessageRef.current?.scrollIntoView({ block: "end", behavior: "auto" });
      const history = mainChatHistoryRef.current;
      if (history) history.scrollTop = history.scrollHeight;
    });
  }

  useEffect(() => {
    if (!shouldShowMainChatTranscript) return;
    scrollToLatestMainChatMessage();
  }, [shouldShowMainChatTranscript, mainChatMessages.length, sending, visiblePendingMainMessage]);

  useEffect(() => {
    if (!effectiveProcessingStartedAt) return;
    setProcessingNow(Date.now());
    const timer = window.setInterval(() => setProcessingNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [effectiveProcessingStartedAt]);

  useEffect(() => {
    if (!activeMainBackendRequestId || sending) return;
    // Keep the normal composer send path off the heavyweight /api/agents/<id>
    // detail endpoint. client.sendMessage() already reconciles the active turn
    // through /messages/status; this fallback detail refresh is only for an
    // orphaned backend request discovered outside the local send lifecycle.
    const poll = window.setInterval(() => void refreshAgent("default").catch(() => undefined), 3000);
    return () => window.clearInterval(poll);
  }, [activeMainBackendRequestId, refreshAgent, sending]);

  useEffect(() => {
    if (sending || routingActionBusy || !hasStartedMainChat) return;
    const localRequestId = activeMainRequestRef.current?.id;
    if (!localRequestId) return;
    const persistedUser = mainChatMessages.some((message) => message.role === "user" && message.requestId === localRequestId);
    const completed = mainChatMessages.some((message) => message.requestId === localRequestId && (message.role === "agent" || message.role === "system"));
    const stillActive = Boolean(melkizac?.processingRequests?.includes(localRequestId));
    if (persistedUser && !completed && !stillActive) {
      void refreshAgent("default").catch(() => undefined);
    }
  }, [hasStartedMainChat, mainChatMessages, melkizac?.processingRequests, refreshAgent, routingActionBusy, sending]);

  useEffect(() => {
    const wasInVoiceMode = previousVoiceStatusRef.current !== "idle";
    const isNowTextMode = voiceStatus === "idle";
    previousVoiceStatusRef.current = voiceStatus;
    if (!shouldShowMainChatTranscript || !wasInVoiceMode || !isNowTextMode) return;
    const frame = window.requestAnimationFrame(() => {
      scrollToLatestMainChatMessage();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [shouldShowMainChatTranscript, voiceStatus]);

  useEffect(() => {
    if (!voiceReplyMode) return;
    const latestAgentMessage = [...mainChatMessages].reverse().find((message) => message.role === "agent");
    if (!latestAgentMessage) return;
    const messageId = String(latestAgentMessage.id);
    if (messageId === voiceReplyBaselineId || messageId === spokenMessageId) return;
    // Voice replies are per voice-originated turn, not a sticky global default.
    // Once we attach speech to the next agent reply, clear the arm flag so later
    // text-chat replies remain text-only unless the user records another voice message.
    setVoiceReplyMode(false);
    speakAgentReply(latestAgentMessage);
  }, [mainChatMessages, spokenMessageId, voiceReplyBaselineId, voiceReplyMode]);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      voiceShouldListenRef.current = false;
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      if (voiceAnimationTimerRef.current) window.clearInterval(voiceAnimationTimerRef.current);
      if (voiceSpeechStartTimerRef.current) window.clearTimeout(voiceSpeechStartTimerRef.current);
      window.speechSynthesis?.cancel();
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

  function updateDraft(next: string | ((current: string) => string)) {
    setDraft((current) => {
      const resolved = typeof next === "function" ? next(current) : next;
      draftRef.current = resolved;
      return resolved;
    });
  }

  function startVoiceVisualPulse(rate = 1, pitch = 1) {
    if (voiceAnimationTimerRef.current) window.clearInterval(voiceAnimationTimerRef.current);
    let tick = 0;
    voiceAnimationTimerRef.current = window.setInterval(() => {
      tick += 1;
      const wave = Math.sin(tick * 0.9 * rate) * 0.35 + Math.sin(tick * 1.7 * pitch) * 0.18;
      setVoiceVisual({
        energy: Math.max(0.65, Math.min(1.9, 1.15 + wave)),
        pitch: Math.max(0.75, Math.min(1.45, pitch + wave * 0.18)),
        rate: Math.max(0.75, Math.min(1.6, rate + wave * 0.12)),
      });
    }, 120);
  }

  function stopVoiceVisualPulse() {
    if (voiceAnimationTimerRef.current) {
      window.clearInterval(voiceAnimationTimerRef.current);
      voiceAnimationTimerRef.current = null;
    }
    setVoiceVisual({ energy: 1, pitch: 1, rate: 1 });
  }

  function capturedVoiceInstruction() {
    return (draftRef.current.trim() || voiceTranscript.trim()).trim();
  }

  function selectJarvisLikeVoice() {
    if (!("speechSynthesis" in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    const preferredMatchers = [
      /google uk english male/i,
      /microsoft (ryan|george|thomas|mark|guy|david)/i,
      /daniel/i,
      /arthur/i,
      /alex/i,
      /male/i,
      /english.*(united kingdom|uk|gb)/i,
      /en-GB/i,
      /en-US/i,
    ];
    return preferredMatchers
      .map((matcher) => voices.find((voice) => matcher.test(`${voice.name} ${voice.lang}`)))
      .find(Boolean) ?? voices.find((voice) => voice.lang?.toLowerCase().startsWith("en")) ?? voices[0] ?? null;
  }

  function configureJarvisUtterance(utterance: SpeechSynthesisUtterance) {
    const voice = selectJarvisLikeVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang || "en-GB";
    } else {
      utterance.lang = "en-GB";
    }
    utterance.rate = 0.92;
    utterance.pitch = 0.78;
    utterance.volume = 1;
  }

  function primeSpeechForImmediateReplies() {
    if (speechPrimedRef.current || !("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return;
    speechPrimedRef.current = true;
    try {
      window.speechSynthesis.resume();
      const primer = new SpeechSynthesisUtterance(" ");
      configureJarvisUtterance(primer);
      primer.volume = 0;
      window.speechSynthesis.speak(primer);
      window.setTimeout(() => {
        if (!speechPlaying) window.speechSynthesis.cancel();
      }, 80);
    } catch {
      speechPrimedRef.current = false;
    }
  }

  function returnToTextChat() {
    voiceShouldListenRef.current = false;
    recognitionRef.current?.stop();
    if (voiceSpeechStartTimerRef.current) {
      window.clearTimeout(voiceSpeechStartTimerRef.current);
      voiceSpeechStartTimerRef.current = null;
    }
    window.speechSynthesis?.cancel();
    setSpeechPlaying(false);
    setVoiceReplyNeedsTap(false);
    setVoiceReplyMode(false);
    stopVoiceVisualPulse();
    setVoiceStatus("idle");
    setVoiceMessage("Voice screen closed. Text chat is ready.");
    window.requestAnimationFrame(() => composerTextareaRef.current?.focus());
  }

  function speakAgentReply(message: Message, userStarted = false) {
    const text = visibleChatText(message);
    setVoiceReplyText(text);
    pendingVoiceReplyRef.current = message;
    if (!text.trim()) return;
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      setVoiceReplyNeedsTap(false);
      setVoiceStatus("ready");
      setVoiceMessage("Melkizac replied. This browser cannot play spoken replies, so the text is shown below.");
      setSpokenMessageId(String(message.id));
      return;
    }
    if (voiceSpeechStartTimerRef.current) window.clearTimeout(voiceSpeechStartTimerRef.current);
    window.speechSynthesis.cancel();
    window.speechSynthesis.resume();
    const utterance = new SpeechSynthesisUtterance(text);
    configureJarvisUtterance(utterance);
    utterance.onstart = () => {
      if (voiceSpeechStartTimerRef.current) {
        window.clearTimeout(voiceSpeechStartTimerRef.current);
        voiceSpeechStartTimerRef.current = null;
      }
      setVoiceReplyNeedsTap(false);
      setSpeechPlaying(true);
      setVoiceStatus("speaking");
      setVoiceMessage("Melkizac is speaking in a Jarvis-style voice. Tap the animation to stop.");
      startVoiceVisualPulse(utterance.rate, utterance.pitch);
    };
    utterance.onboundary = (event) => {
      const charLength = "charLength" in event ? Number(event.charLength) || 1 : 1;
      const wordBoost = Math.min(0.75, charLength / 14);
      setVoiceVisual({
        energy: 1.15 + wordBoost,
        pitch: utterance.pitch + wordBoost * 0.18,
        rate: utterance.rate + wordBoost * 0.12,
      });
    };
    utterance.onend = () => {
      if (voiceSpeechStartTimerRef.current) {
        window.clearTimeout(voiceSpeechStartTimerRef.current);
        voiceSpeechStartTimerRef.current = null;
      }
      setSpeechPlaying(false);
      setVoiceReplyNeedsTap(false);
      stopVoiceVisualPulse();
      setVoiceStatus("ready");
      setVoiceMessage("Reply finished. Tap the animation to record another voice message.");
    };
    utterance.onerror = () => {
      if (voiceSpeechStartTimerRef.current) {
        window.clearTimeout(voiceSpeechStartTimerRef.current);
        voiceSpeechStartTimerRef.current = null;
      }
      setSpeechPlaying(false);
      stopVoiceVisualPulse();
      setVoiceStatus("ready");
      setVoiceReplyNeedsTap(true);
      setVoiceMessage("Melkizac replied. Tap the animation to play the voice reply.");
    };
    setSpokenMessageId(String(message.id));
    setSpeechPlaying(true);
    setVoiceStatus("speaking");
    setVoiceMessage(userStarted ? "Starting Jarvis-style voice reply…" : "Melkizac replied. Speaking now in a Jarvis-style voice…");
    setVoiceReplyNeedsTap(false);
    startVoiceVisualPulse(utterance.rate, utterance.pitch);
    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      setSpeechPlaying(false);
      stopVoiceVisualPulse();
      setVoiceStatus("ready");
      setVoiceReplyNeedsTap(true);
      setVoiceMessage("Melkizac replied. Tap the animation to play the voice reply.");
      return;
    }
    voiceSpeechStartTimerRef.current = window.setTimeout(() => {
      if (!window.speechSynthesis.speaking) {
        setSpeechPlaying(false);
        stopVoiceVisualPulse();
        setVoiceStatus("ready");
        setVoiceReplyNeedsTap(true);
        setVoiceMessage("Melkizac replied. Tap the animation to play the voice reply.");
      }
    }, 3000);
  }

  function playPendingVoiceReply() {
    const pending = pendingVoiceReplyRef.current;
    if (pending) speakAgentReply(pending, true);
  }

  function stopVoiceReply() {
    if (voiceSpeechStartTimerRef.current) {
      window.clearTimeout(voiceSpeechStartTimerRef.current);
      voiceSpeechStartTimerRef.current = null;
    }
    window.speechSynthesis?.cancel();
    setSpeechPlaying(false);
    setVoiceReplyNeedsTap(false);
    stopVoiceVisualPulse();
    setVoiceReplyMode(false);
    setVoiceStatus("ready");
  }

  function sendVoiceMessageFromAnimation() {
    primeSpeechForImmediateReplies();
    const instruction = capturedVoiceInstruction();
    voiceShouldListenRef.current = false;
    recognitionRef.current?.stop();
    if (!instruction) {
      setVoiceStatus("idle");
      setVoiceMessage("Voice input stopped. No transcript was captured.");
      return;
    }
    updateDraft(instruction);
    setVoiceReplyMode(true);
    setVoiceReplyText("");
    setVoiceReplyNeedsTap(false);
    pendingVoiceReplyRef.current = null;
    const latestAgentMessage = [...mainChatMessages].reverse().find((message) => message.role === "agent");
    setVoiceReplyBaselineId(latestAgentMessage ? String(latestAgentMessage.id) : "");
    setVoiceStatus("sending");
    setVoiceMessage("Sent to Melkizac. Keeping voice screen open for the reply.");
    void submitInstruction(instruction, { preserveDraft: false, keepVoiceScreen: true });
  }

  function stopVoiceInput() {
    voiceShouldListenRef.current = false;
    recognitionRef.current?.stop();
    setVoiceStatus("idle");
    setVoiceMessage("Voice input stopped.");
  }

  function startVoiceInput() {
    primeSpeechForImmediateReplies();
    setError(null);
    stopVoiceVisualPulse();
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
    setVoiceReplyText("");
    setVoiceReplyNeedsTap(false);
    pendingVoiceReplyRef.current = null;
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
        updateDraft((current) => `${current}${current.trim() ? " " : ""}${captured}`.trimStart());
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
    const voiceStyle = {
      "--voice-energy": String(voiceVisual.energy),
      "--voice-pitch": String(voiceVisual.pitch),
      "--voice-rate": String(voiceVisual.rate),
      "--voice-spin-slow": `${Math.max(2.8, 6 / voiceVisual.rate).toFixed(2)}s`,
      "--voice-spin-mid": `${Math.max(2, 4 / voiceVisual.rate).toFixed(2)}s`,
      "--voice-spin-fast": `${Math.max(1.4, 2.8 / voiceVisual.rate).toFixed(2)}s`,
      "--voice-ray-duration": `${Math.max(0.65, 1.2 / voiceVisual.rate).toFixed(2)}s`,
      "--voice-particle-duration": `${Math.max(1, 1.8 / voiceVisual.rate).toFixed(2)}s`,
    } as React.CSSProperties;
    const orb = (
      <div className="voice-jarvis-orb" aria-hidden="true">
        <img className="voice-orb-reference-image" src={voiceHudReference} alt="" />
        <span className="voice-reference-glow" />
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
    );
    if (mode === "full") {
      const handleVoiceScreenTap = () => {
        if (voiceStatus === "listening") sendVoiceMessageFromAnimation();
        else if (voiceStatus === "speaking") stopVoiceReply();
        else if (voiceReplyNeedsTap) playPendingVoiceReply();
        else if (voiceStatus === "ready") startVoiceInput();
      };
      const handleVoiceScreenKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleVoiceScreenTap();
        }
      };
      const label = voiceStatus === "listening"
        ? (voiceTranscript ? `Voice captured: ${voiceTranscript}. Tap to send this voice message to Melkizac.` : "Listening. Tap when finished to send this voice message to Melkizac.")
        : voiceStatus === "sending"
          ? "Voice message sent. Waiting for Melkizac reply."
          : voiceStatus === "speaking"
            ? `Melkizac is speaking: ${voiceReplyText}. The animation is responding to reply tone, pitch, and speed. Tap to stop voice reply.`
            : voiceReplyNeedsTap
              ? `Melkizac replied: ${voiceReplyText}. Tap to play the voice reply.`
              : voiceReplyText
                ? `Melkizac replied: ${voiceReplyText}. Tap to record another voice message.`
                : "Voice screen ready. Tap to record another voice message.";
      const voiceTitle = voiceStatus === "listening" ? "Tap to send voice message" : voiceStatus === "speaking" ? "Tap to stop voice reply" : voiceReplyNeedsTap ? "Tap to play voice reply" : "Voice screen";
      return (
        <div
          className={`voice-activation full-window ${voiceStatus} ${speechPlaying ? "voice-speaking" : ""} voice-deactivate-hitarea`}
          role="button"
          tabIndex={0}
          onClick={handleVoiceScreenTap}
          onKeyDown={handleVoiceScreenKeyDown}
          aria-label={label}
          title={voiceTitle}
          style={voiceStyle}
        >
          <button
            className="voice-return-to-text"
            type="button"
            aria-label="Return to text message UI"
            title="Back to text chat"
            onClick={(event) => {
              event.stopPropagation();
              returnToTextChat();
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M15 6l-6 6 6 6" />
              <path d="M20 12H9" />
            </svg>
          </button>
          {orb}
        </div>
      );
    }
    return (
      <div
        className={`voice-activation compact ${isListening ? "listening" : "notice"}`}
        role="status"
        aria-live="polite"
        aria-label={voiceTranscript ? `Voice captured: ${voiceTranscript}` : voiceMessage}
        style={voiceStyle}
      >
        {orb}
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

  function renderVoiceReplyControl() {
    if (!voiceReplyMode && !speechPlaying) return null;
    return (
      <button
        className={`voice-reply-control ${speechPlaying ? "speaking" : ""}`}
        type="button"
        onClick={stopVoiceReply}
        aria-label={speechPlaying ? "Stop spoken agent reply" : "Turn off spoken agent reply"}
        title={speechPlaying ? "Stop spoken reply" : "Voice reply is on"}
      >
        {speechPlaying ? "Stop voice" : "Voice reply on"}
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

  function routerTaskTitle(prefix: string, instruction: string) {
    const compact = instruction.replace(/\s+/g, " ").trim();
    return `${prefix}: ${compact.slice(0, 84)}${compact.length > 84 ? "…" : ""}`;
  }

  function agentOsRoutePayload(instruction: string, decision: ChatIntentDecision, forceProject = false): AgentOsIntentRoute {
    const isResearchDeliverable = decision.intentType === "research_to_deliverable";
    const isProject = forceProject || isResearchDeliverable || decision.intentType === "project";
    const isTask = !isProject && (decision.intentType === "kanban_task" || decision.intentType === "create_one_time_task" || decision.nextAction === "show_mission_proposal");
    return {
      intent_type: isProject ? "project" : isTask ? "kanban_task" : decision.intentType,
      research_deliverable_intent: decision.matchedContext.researchSubtype ?? null,
      confidence: decision.confidence === "high" ? 0.9 : decision.confidence === "medium" ? 0.75 : 0.45,
      rationale: decision.reason,
      project_required: Boolean(isResearchDeliverable || decision.matchedContext.projectId || selectedProject?.id),
      suggested_project_id: isResearchDeliverable ? (selectedProject?.id || decision.matchedContext.projectId || null) : isProject ? null : (selectedProject?.id || decision.matchedContext.projectId || null),
      create_task: isResearchDeliverable ? false : isTask,
      create_project: isProject,
      launch_workflow: decision.intentType === "workflow",
      recommend_routine: decision.intentType === "routine_recommendation" || decision.intentType === "modify_routine",
      one_time_reply: decision.intentType === "one_time_reply",
      agent_id: decision.intentType === "project" || decision.intentType === "kanban_task" ? "devops" : "melkizac",
      tools_required: decision.matchedContext.toolsRequired?.length ? decision.matchedContext.toolsRequired : ["kanban"],
      skills_required: decision.matchedContext.skillsRequired ?? [],
      evidence_required: decision.matchedContext.evidenceRequired ?? true,
      approval_required: decision.matchedContext.approvalRequired ?? false,
      prompt: instruction,
      context: {
        selected_project_id: selectedProject?.id ?? decision.matchedContext.projectId ?? null,
        selected_project_name: selectedProject ? projectLabel(selectedProject) : decision.matchedContext.projectName ?? null,
      },
    };
  }


  function researchOutputLabels(subtype: ChatIntentDecision["matchedContext"]["researchSubtype"]) {
    switch (subtype) {
      case "generate_deck": return ["PPTX deck", "Citation notes"];
      case "generate_report": return ["DOCX briefing", "Citation notes"];
      case "generate_proposal": return ["Proposal", "Citation notes"];
      case "generate_training_material": return ["Training materials", "Citation notes"];
      case "summarize_sources": return ["Research notes"];
      case "compare_sources": return ["Comparison notes"];
      case "ask_sources": return ["Source-grounded answer"];
      case "revise_artifact": return ["Revised artifact"];
      case "add_sources_to_project": return ["Updated source set"];
      case "check_project_status": return ["Project status summary"];
      case "learn_topic":
      default:
        return ["Research notes"];
    }
  }

  function decisionFromAgentOsRoute(route: AgentOsIntentRoute, instruction: string, workflowContext: ChatWorkflowContext[] = workflows): ChatIntentDecision {
    const workflowCandidate = route.workflow_candidate;
    const localDecision = routeChatIntent({
      instruction,
      selectedProject,
      selectedMission: null,
      visibleMissions,
      tasks: recentTasks,
      approvals,
      routines,
      workflows: workflowContext,
    });
    // Prefer the local UI router's subtype when it detects one: the backend
    // heuristic may classify words like "editable" as an edit/revision signal,
    // while the frontend preview needs the user's visible create/generate intent.
    const researchSubtype = (localDecision.matchedContext.researchSubtype || route.research_deliverable_intent) as ChatIntentDecision["matchedContext"]["researchSubtype"];
    const isResearchDeliverable = Boolean(researchSubtype);
    const suggestedProjectId = route.suggested_project_id || selectedProject?.id || localDecision.matchedContext.projectId || null;
    const suggestedProjectName = selectedProject && selectedProject.id === suggestedProjectId
      ? projectLabel(selectedProject)
      : localDecision.matchedContext.projectName ?? null;
    let confidence = confidenceFromScore(route.confidence);
    const routeNeedsProject = Boolean(route.project_required || isResearchDeliverable);
    if (routeNeedsProject && !suggestedProjectId && !suggestedProjectName) {
      confidence = confidence === "low" ? "low" : "medium";
    }
    return {
      intentType: isResearchDeliverable ? "research_to_deliverable" : frontendIntentFromAgentOs(route),
      matchedContext: {
        projectId: suggestedProjectId,
        projectName: suggestedProjectName,
        workflowId: workflowCandidate?.id || localDecision.matchedContext.workflowId || null,
        workflowTitle: workflowCandidate?.name || localDecision.matchedContext.workflowTitle || null,
        researchSubtype,
        requestedOutputs: localDecision.matchedContext.requestedOutputs?.length
          ? localDecision.matchedContext.requestedOutputs
          : isResearchDeliverable ? researchOutputLabels(researchSubtype) : undefined,
        sourceSummary: localDecision.matchedContext.sourceSummary || (attachments.length ? `${attachments.length} attached file${attachments.length === 1 ? "" : "s"}` : null),
        toolsRequired: route.tools_required ?? localDecision.matchedContext.toolsRequired ?? [],
        skillsRequired: route.skills_required ?? localDecision.matchedContext.skillsRequired ?? [],
        evidenceRequired: route.evidence_required ?? localDecision.matchedContext.evidenceRequired,
        approvalRequired: Boolean(route.approval_required || workflowCandidate?.approval_required || localDecision.matchedContext.approvalRequired),
      },
      confidence,
      nextAction: isResearchDeliverable
        ? (confidence === "high" ? "show_mission_proposal" : "ask_clarifying_question")
        : frontendNextActionFromAgentOs(route),
      reason: route.rationale || localDecision.reason || `Agent OS router selected ${route.intent_type || "chat"}.`,
    };
  }

  async function routeInstruction(instruction: string, signal?: AbortSignal): Promise<ChatIntentDecision> {
    const isSimpleGreeting = /^(hi|hello|hey|yo|sup|test)[!.\s]*$/i.test(instruction.trim());
    if (isSimpleGreeting && attachments.length === 0) {
      return {
        intentType: "one_time_reply",
        matchedContext: { approvalRequired: false },
        confidence: "high",
        nextAction: "proceed",
        reason: "Simple greeting; bypassing task/project router for fast chat response.",
      };
    }
    const shouldUseRouter = shouldUseMissionControlRouter(instruction, attachments.length > 0);
    if (!shouldUseRouter) {
      return {
        intentType: "one_time_reply",
        matchedContext: { approvalRequired: false },
        confidence: "high",
        nextAction: "proceed",
        reason: "Direct agent conversation; Melkizac owns intent and next-action selection.",
      };
    }
    const workflowContext = shouldHydrateWorkflowContext(instruction) ? await ensureWorkflowContext() : workflows;
    try {
      const response = await request<AgentOsIntentRouteResponse>("/api/intent/route", {
        method: "POST",
        signal,
        body: JSON.stringify({
          prompt: instruction,
          context: {
            selected_project_id: selectedProject?.id ?? null,
            project_id: selectedProject?.id ?? null,
            selected_project_name: selectedProject ? projectLabel(selectedProject) : null,
            attachment_count: attachments.length,
            attachments: attachments.map((file) => ({ name: file.name, size: file.size, type: file.type })),
            project_context_loaded: projects.length > 0,
            workflow_context_loaded: workflowContextLoaded,
          },
        }),
      });
      if (response.ok && response.route) return decisionFromAgentOsRoute(response.route, instruction, workflowContext);
      throw new Error(response.error || "Agent OS router returned no route.");
    } catch {
      return routeChatIntent({
        instruction,
        selectedProject,
        selectedMission: null,
        visibleMissions,
        tasks: recentTasks,
        approvals,
        routines,
        workflows: workflowContext,
      });
    }
  }

  async function runResearchDeliverableWorkflow(current: { instruction: string; decision: ChatIntentDecision; preview: ChatIntentPreview }, signal?: AbortSignal) {
    const route = agentOsRoutePayload(current.instruction, current.decision, true);
    route.intent_type = "project";
    route.create_project = true;
    route.create_task = false;
    route.suggested_project_id = selectedProject?.id || current.decision.matchedContext.projectId || null;
    route.launch_workflow = false;
    const response = await request<AgentOsKanbanCreationResponse>("/api/intent/create-kanban", {
      method: "POST",
      signal,
      body: JSON.stringify({ route }),
    });
    if (!response.ok) throw new Error(response.error || "Research-to-Deliverable workflow was not started.");
    const card: ResearchWorkflowCard = {
      title: response.chat_card?.title || "Research-to-Deliverable workflow started",
      projectId: response.project_id,
      workflowType: response.workflow_type,
      graphTemplate: response.graph_template,
      taskIds: response.task_ids ?? {},
      tasks: response.tasks ?? [],
      outputs: response.chat_card?.outputs ?? current.preview.researchDeliverable?.outputs ?? [],
      status: response.chat_card?.status || "Task graph ready",
      idempotent: response.idempotent,
    };
    setResearchWorkflowCard(card);
    setSelectedProjectId(response.project_id || selectedProject?.id || current.decision.matchedContext.projectId || "");
    const taskCount = card.tasks.length;
    setRoutingActionMessage(`Research-to-Deliverable workflow started${response.idempotent ? " (already existed)" : ""}${card.projectId ? ` for ${card.projectId}` : ""}${taskCount ? ` with ${taskCount} Kanban cards` : ""}.`);
    updateDraft("");
    setAttachments([]);
    return card;
  }

  function autoStartResearchDeliverable(decision: ChatIntentDecision, preview: ChatIntentPreview) {
    return (
      decision.intentType === "research_to_deliverable" &&
      decision.confidence === "high" &&
      preview.canProceed &&
      permissionMode !== "draft-only" &&
      decision.matchedContext.approvalRequired !== true
    );
  }

  async function runRoutingActionFor(
    current: { instruction: string; decision: ChatIntentDecision; preview: ChatIntentPreview },
    action: ChatIntentRoutingActionId,
    options: { signal?: AbortSignal; requestId?: string; speakReply?: boolean } = {},
  ) {
    if (routingActionBusy) return;
    const { speakReply = false, ...sendOptions } = options;
    if (action === "clarify") {
      setRoutingActionMessage(null);
      setRoutingActionError(null);
      const newMessages = await sendToAgent("default", composeClarificationContext(current.instruction, current.decision, current.preview), [], sendOptions);
      const directReply = [...newMessages].reverse().find((message) => message.role === "agent" && visibleChatText(message).trim());
      if (speakReply && directReply) speakAgentReply(directReply);
      updateDraft("");
      setAttachments([]);
      setRoutingPreview(null);
      return;
    }
    setRoutingActionBusy(action);
    setRoutingActionMessage(null);
    setRoutingActionError(null);
    try {
      if (action === "send_to_agent") {
        const newMessages = await sendToAgent("default", composeInstructionContext(current.instruction, current.decision), [], sendOptions);
        const directReply = [...newMessages].reverse().find((message) => message.role === "agent" && visibleChatText(message).trim());
        if (speakReply && directReply) speakAgentReply(directReply);
        updateDraft("");
        setAttachments([]);
        setRoutingPreview(null);
        return;
      }

      if (action === "start_research_deliverable") {
        await runResearchDeliverableWorkflow(current, options.signal);
        return;
      }

      if (action === "launch_workflow") {
        const workflowId = current.decision.matchedContext.workflowId;
        if (!workflowId) throw new Error("No workflow candidate is linked to this route.");
        const response = await request<WorkflowLaunchResponse>(`/api/workflows/${encodeURIComponent(workflowId)}/launch`, {
          method: "POST",
          signal: options.signal,
          body: JSON.stringify({
            projectId: selectedProject?.id,
            title: routerTaskTitle("Workflow", current.instruction),
            request: current.instruction,
            runMode: "approval_required",
          }),
        });
        if (!response.ok) throw new Error(response.error || "Workflow launch was not queued.");
        setRoutingActionMessage(`Workflow queued${response.workflow?.name ? `: ${response.workflow.name}` : ""}.`);
        return;
      }

      if (action === "create_routine_draft" || action === "recommend_routine") {
        const routineId = slugFromInstruction("chat-routine", current.instruction);
        const response = await request<{ ok?: boolean; error?: string; routine?: { id?: string; name?: string } }>("/api/automations", {
          method: "POST",
          signal: options.signal,
          body: JSON.stringify({
            id: routineId,
            name: routerTaskTitle("Routine draft", current.instruction),
            type: "workspace",
            routine_type: "workspace",
            workspace_id: selectedProject?.id,
            agent_id: current.decision.matchedContext.approvalRequired ? "melkizac" : "devops",
            schedule: "draft - not scheduled",
            trigger_status: "disabled",
            status: "draft",
            approval_policy_dependency: { decision: "approval_required", reason: "Created from main chat router; review before enabling." },
            quota_policy: { blocked: true, reason: "Draft routine from chat router; enable deliberately after review." },
          }),
        });
        if (!response.ok) throw new Error(response.error || "Routine draft was not created.");
        setRoutingActionMessage(`Routine draft created${response.routine?.id ? `: ${response.routine.id}` : ""}.`);
        return;
      }

      const isProjectKickoff = action === "create_project";
      const forcedTaskRoute = action === "create_project_task" || action === "create_task";
      const route = agentOsRoutePayload(current.instruction, current.decision, isProjectKickoff);
      if (forcedTaskRoute) {
        route.intent_type = "kanban_task";
        route.create_task = true;
        route.create_project = false;
        route.suggested_project_id = selectedProject?.id || current.decision.matchedContext.projectId || null;
      }
      const response = await request<AgentOsKanbanCreationResponse>("/api/intent/create-kanban", {
        method: "POST",
        signal: options.signal,
        body: JSON.stringify({ route }),
      });
      if (!response.ok) throw new Error(response.error || "Task was not created.");
      const createdTask = response.tasks?.[0];
      const taskCount = response.tasks?.length ?? 0;
      const graphLabel = response.workflow_type === "research_to_deliverable" && taskCount > 1
        ? ` with ${taskCount} dependency-linked cards`
        : "";
      setRoutingActionMessage(`${response.mode === "project" ? "Project kickoff" : "Task Board"} card ${response.idempotent ? "already exists" : "created"}${createdTask?.id ? `: ${createdTask.id}` : ""}${graphLabel}.`);
      updateDraft("");
      setAttachments([]);
      setRoutingPreview(null);
    } catch (err) {
      if (options.signal?.aborted) throw err;
      setRoutingActionError(err instanceof Error ? err.message : "Router action failed.");
    } finally {
      setRoutingActionBusy(null);
    }
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

  function composeClarificationContext(instruction: string, intentDecision: ChatIntentDecision, preview: ChatIntentPreview) {
    const context = [
      selectedProject ? `Project: ${projectLabel(selectedProject)} (${selectedProject.id})` : "Project: No Project selected",
      `Permission: ${selectedPermission.promptLabel}`,
      `Model: ${selectedModel.promptLabel}`,
      attachments.length ? `Attachments: ${attachments.map((file) => `${file.name} (${formatBytes(file.size)})`).join(", ")}` : null,
    ].filter(Boolean);
    const suggestedQuestion = preview.suggestedQuestion || "Ask one concise clarification question before taking action.";
    return `${instruction}\n\n[Mission Control Chat Context]\n${context.join("\n")}\n\n[Mission Control Intent Routing]\nThe router was not confident enough to create tasks, projects, routines, or workflows automatically. Do not expose router internals. Reply in normal chat with a brief clarification question only. Suggested question: ${suggestedQuestion}\n\n${serializeChatIntentDecision(intentDecision)}`;
  }

  function shouldClarifyInChat(decision: ChatIntentDecision, preview: ChatIntentPreview) {
    return !preview.canProceed || decision.confidence === "low" || decision.nextAction === "ask_clarifying_question";
  }

  function defaultRoutingAction(decision: ChatIntentDecision, preview: ChatIntentPreview): ChatIntentRoutingActionId {
    if (shouldClarifyInChat(decision, preview)) return "clarify";
    if (decision.intentType === "research_to_deliverable" && autoStartResearchDeliverable(decision, preview)) return "start_research_deliverable";
    if (decision.intentType === "workflow" && decision.matchedContext.workflowId && permissionMode !== "draft-only") return "launch_workflow";
    if ((decision.intentType === "routine_recommendation" || decision.intentType === "modify_routine") && permissionMode !== "draft-only") return "create_routine_draft";
    if (decision.intentType === "project" && permissionMode !== "draft-only" && !decision.matchedContext.approvalRequired) return "create_project";
    if ((decision.intentType === "kanban_task" || decision.intentType === "create_one_time_task") && permissionMode !== "draft-only" && !decision.matchedContext.approvalRequired) {
      return selectedProject?.id ? "create_project_task" : "create_task";
    }
    return "send_to_agent";
  }

  async function submitInstruction(instructionText: string, options: { preserveDraft?: boolean; keepVoiceScreen?: boolean } = {}) {
    const instruction = instructionText.trim();
    if (!instruction || sending) return;
    if (!options.keepVoiceScreen) {
      // Plain text submits must never inherit a previous voice session's reply mode.
      // Voice reply is opt-in per voice-originated message only.
      setVoiceReplyMode(false);
      setVoiceReplyText("");
      setVoiceReplyNeedsTap(false);
      pendingVoiceReplyRef.current = null;
      if (speechPlaying) {
        window.speechSynthesis?.cancel();
        setSpeechPlaying(false);
        stopVoiceVisualPulse();
      }
    }
    const sentAttachments = attachments;
    const controller = new AbortController();
    const requestId = `main-chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    activeMainRequestRef.current = { id: requestId, controller };
    setHasStartedMainChat(true);
    updateDraft("");
    setAttachments([]);
    setPendingMainMessage({ text: instruction, attachments: sentAttachments });
    const startedAt = Date.now();
    setProcessingStartedAt(startedAt);
    setProcessingNow(startedAt);
    setSending(true);
    setError(null);
    try {
      const intentDecision = await routeInstruction(instruction, controller.signal);
      if (controller.signal.aborted) return;
      const preview = buildChatIntentPreview(intentDecision);
      const routed = { instruction, decision: intentDecision, preview };
      // Keep the router silent by default. The agent/router decides the path;
      // users see only chat replies, clarification questions, compact task cards,
      // or real Approval Gates when policy requires them.
      setRoutingPreview(null);
      setRoutingActionMessage(null);
      setRoutingActionError(null);
      await runRoutingActionFor(routed, defaultRoutingAction(intentDecision, preview), {
        signal: controller.signal,
        requestId,
        speakReply: options.keepVoiceScreen === true,
      });
      if (options.keepVoiceScreen) setVoiceStatus("ready");
      if (options.preserveDraft === true) updateDraft(instruction);
    } catch (err) {
      if (controller.signal.aborted) {
        setRoutingActionError("Stopped the current message before it finished processing.");
      } else {
        const message = err instanceof Error ? err.message : "Failed to send message.";
        const maybeCompleted = /bad gateway|gateway|timeout|network|failed to fetch|502|503|504/i.test(message);
        if (maybeCompleted) {
          setError("Connection dropped while Melkizac was processing. Refreshing the latest chat instead of putting the sent message back in the composer…");
          for (const delay of [1200, 3000, 6000, 10000]) {
            window.setTimeout(() => void refreshAgent("default").catch(() => undefined), delay);
          }
        } else {
          updateDraft(instruction);
          setAttachments(sentAttachments);
          setError(message);
        }
      }
    } finally {
      if (activeMainRequestRef.current?.id === requestId) activeMainRequestRef.current = null;
      setPendingMainMessage(null);
      setProcessingStartedAt(null);
      setSending(false);
      window.requestAnimationFrame(() => composerTextareaRef.current?.focus());
    }
  }

  async function submit() {
    await submitInstruction(draft);
  }

  async function stopMainChatProcessing() {
    const active = activeMainRequestRef.current;
    const requestId = active?.id ?? activeMainBackendRequestId ?? undefined;
    if (!requestId) return;
    active?.controller.abort();
    activeMainRequestRef.current = null;
    setPendingMainMessage(null);
    setProcessingStartedAt(null);
    setSending(false);
    setRoutingActionBusy(null);
    setRoutingActionMessage(null);
    setRoutingActionError("Stopping current message…");
    try {
      await stopProcessingForAgent("default", requestId);
      await refreshAgent("default").catch(() => undefined);
      setRoutingActionError("Stopped the current message before it finished processing.");
    } catch (err) {
      setRoutingActionError(err instanceof Error ? `Stopped locally, but backend stop failed: ${err.message}` : "Stopped locally, but backend stop failed.");
    }
  }

  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  return !shouldShowMainChatTranscript ? (
    <div className="clean-chat-page">
      <section className="clean-chat-shell" aria-label="Clean Chat command center">
        <header className="clean-chat-mobile-topbar" aria-label="Chat controls">
          <button className="clean-chat-round-button" type="button" aria-label="Open Mission Control menu">
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
          <label className="clean-chat-model-button clean-chat-top-model-select" aria-label="AI model selector">
            <strong>{selectedModel.label === "AUTO" ? "Melkizac" : selectedModel.label}</strong>
            <span>{selectedModel.value === "auto" ? "Auto" : ""}</span>
            <select value={modelMode} onChange={(event) => setModelMode(event.target.value as ChatModelMode)}>
              {modelModeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M7 10l5 5 5-5" />
            </svg>
          </label>
          <button className="clean-chat-round-button clean-chat-compose-button" type="button" aria-label="New chat">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M5 19l1.4-4.8L17 3.6a2.1 2.1 0 013 3L9.4 17.2 5 19z" />
              <path d="M13.5 6.5l4 4" />
            </svg>
          </button>
        </header>

        <div className="clean-chat-hero" aria-label="Chat start prompt">
          <h1>{heroPrompt}</h1>
        </div>

        <form className="clean-chat-composer" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <textarea
            ref={composerTextareaRef}
            value={draft}
            onChange={(event) => updateDraft(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder="Ask Melkizac"
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
              {renderVoiceReplyControl()}
              {renderMicButton()}
              <button className={`clean-chat-send ${draft.trim() ? "ready" : "idle-disabled"}`} type="submit" disabled={sending || !draft.trim()} aria-label="Send message">
                ↑
              </button>
            </div>
          </div>
        </form>

        <div className="clean-project-strip">
          <span>▱</span>
          <select
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
            aria-label="Project selector"
            aria-busy={contextHydrating && !projects.length}
            disabled={contextHydrating && !projects.length}
          >
            <option value="">{contextHydrating && !projects.length ? "Loading projects…" : "No Project selected"}</option>
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

        <main ref={mainChatHistoryRef} className={`main-chat-history ${voiceStatus !== "idle" ? "voice-mode" : ""}`} aria-label={voiceStatus !== "idle" ? "Voice input activation" : "Melkizac conversation history"}>
          {voiceStatus !== "idle" ? (
            renderVoiceActivation("full")
          ) : mainChatMessages.length === 0 && !visiblePendingMainMessage ? (
            <div className="main-chat-empty-state">
              <span className="main-chat-avatar">ME</span>
              <strong>Starting the Melkizac conversation…</strong>
              <p>Your message will appear here while Melkizac responds.</p>
            </div>
          ) : (
            <>
              {mainChatMessages.map((message) => {
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
              })}
              {visiblePendingMainMessage && (
                <article className="main-chat-row user pending" key="main-chat-pending-user">
                  <div className="main-chat-message-stack">
                    <div className="main-chat-meta">
                      <strong>You</strong>
                      <span>Web UI · Chat</span>
                      <time>just now</time>
                    </div>
                    <div className="main-chat-bubble">
                      <p>{visiblePendingMainMessage.text}</p>
                      {visiblePendingMainMessage.attachments.length ? (
                        <div className="main-chat-message-attachments">
                          {visiblePendingMainMessage.attachments.map((attachment) => (
                            <span key={attachment.id}>{attachment.name}</span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <span className="main-chat-user-avatar">M</span>
                </article>
              )}
              {isMainChatProcessing && (
                <div className="processing-inline main-chat-processing-inline" role="status" aria-live="polite" aria-label="Melkizac is processing your message">
                  <span className="processing-inline-dots" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                  <span>Melkizac is processing…</span>
                  <span className="processing-inline-timer" aria-label={`Elapsed processing time ${processingElapsedLabel}`} title="Elapsed processing time">
                    {processingElapsedLabel}
                  </span>
                </div>
              )}
            </>
          )}
          <div ref={latestMessageRef} className="main-chat-latest-sentinel" aria-hidden="true" />
        </main>

        <form className="main-chat-composer" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <div className="mobile-composer-prompt">
            {selectedProject ? `What should we work on in ${projectLabel(selectedProject)}?` : "What should Melkizac work on?"}
          </div>
          {routingActionMessage && <div className="main-chat-route-status success">{routingActionMessage}</div>}
          {routingActionError && <div className="main-chat-route-status error">{routingActionError}</div>}
          {researchWorkflowCard && (
            <section className="main-chat-research-card" aria-label="Research-to-Deliverable workflow status">
              <div>
                <span className="main-chat-research-kicker">Research-to-Deliverable workflow started</span>
                <h2>{researchWorkflowCard.title}</h2>
                <p>{researchWorkflowCard.status}{researchWorkflowCard.idempotent ? " · Existing graph reused" : " · Kanban graph queued"}</p>
              </div>
              <dl>
                <div><dt>Project</dt><dd>{researchWorkflowCard.projectId || "Project tenant pending"}</dd></div>
                <div><dt>Template</dt><dd>{researchWorkflowCard.graphTemplate || researchWorkflowCard.workflowType || "research_to_deliverable_v1"}</dd></div>
                <div><dt>Tasks</dt><dd>{researchWorkflowCard.tasks.length || Object.keys(researchWorkflowCard.taskIds).length} cards</dd></div>
                <div><dt>Outputs</dt><dd>{researchWorkflowCard.outputs.length ? researchWorkflowCard.outputs.join(", ") : "Research notes"}</dd></div>
              </dl>
              <div className="main-chat-research-actions">
                <button type="button" onClick={() => setView("board")}>Open Task Board</button>
                <button type="button" onClick={() => setView("research-runs")}>Open Research Runs</button>
              </div>
            </section>
          )}
          <textarea
            ref={composerTextareaRef}
            value={draft}
            onChange={(event) => updateDraft(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder={isMainChatProcessing ? "Melkizac is processing…" : "Send a task or message to Melkizac..."}
            disabled={isMainChatProcessing}
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
                  aria-busy={contextHydrating && !projects.length}
                  disabled={contextHydrating && !projects.length}
                >
                  <option value="">{contextHydrating && !projects.length ? "Loading projects…" : "No Project selected"}</option>
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
              {renderVoiceReplyControl()}
              {renderMicButton()}
              <button
                className={isMainChatProcessing ? "clean-chat-send stop-send" : "clean-chat-send"}
                type="button"
                onClick={() => (isMainChatProcessing ? stopMainChatProcessing() : void submit())}
                disabled={!isMainChatProcessing && !draft.trim()}
                aria-label={isMainChatProcessing ? "Stop current message processing" : "Send message"}
                title={isMainChatProcessing ? "Stop current message processing" : "Send message"}
              >
                {isMainChatProcessing ? "■" : "↑"}
              </button>
            </div>
          </div>
          {error && <div className="clean-chat-error">{error}</div>}
        </form>
      </section>
    </div>
  );
}
