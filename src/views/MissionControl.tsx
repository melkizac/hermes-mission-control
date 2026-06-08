import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { ChatIntentRoutingPreview } from "../components/ChatIntentRoutingPreview";
import type { ChatIntentRoutingAction, ChatIntentRoutingActionId } from "../components/ChatIntentRoutingPreview";
import voiceHudReference from "../assets/voice-hud-reference.jpg";
import { useStore } from "../services/store";
import { buildChatIntentPreview, routeChatIntent, serializeChatIntentDecision } from "../services/chatIntentRouter";
import type { ChatIntentDecision, ChatIntentPreview, ChatMissionContext, ChatRoutineContext, ChatWorkflowContext } from "../services/chatIntentRouter";
import type { AutomationsResponse, BoardResponse, BoardTask, BoardTaskMutationResponse, Message, ProjectRecord, ProjectsResponse, WorkflowLaunchResponse, WorkflowLibraryResponse } from "../types";

const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

type ChatPermissionMode = "ask-critical" | "full-policy" | "draft-only";
type ChatModelMode = "auto" | "gpt-55-medium" | "fast" | "deep";

type ChatAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
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

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)}MB`;
}

function projectLabel(project: ProjectRecord) {
  return project.name || project.id;
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
  const [routingPreview, setRoutingPreview] = useState<{
    instruction: string;
    decision: ChatIntentDecision;
    preview: ChatIntentPreview;
  } | null>(null);
  const [routingActionBusy, setRoutingActionBusy] = useState<ChatIntentRoutingActionId | null>(null);
  const [routingActionMessage, setRoutingActionMessage] = useState<string | null>(null);
  const [routingActionError, setRoutingActionError] = useState<string | null>(null);
  const latestMessageRef = useRef<HTMLDivElement | null>(null);
  const mainChatHistoryRef = useRef<HTMLElement | null>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);

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
  const greeting = singaporeDaypartGreeting();
  const heroPrompt = selectedProject ? `What should we work on in “${projectLabel(selectedProject)}”?` : `${greeting}, Melverick!`;
  const melkizac = agents.find((agent) => agent.id === "default") ?? agents[0];
  const mainChatMessages = useMemo(
    () => (melkizac?.messages ?? []).filter(isRenderableChatMessage).slice(-80),
    [melkizac?.messages],
  );

  function scrollToLatestMainChatMessage() {
    window.requestAnimationFrame(() => {
      latestMessageRef.current?.scrollIntoView({ block: "end", behavior: "auto" });
      const history = mainChatHistoryRef.current;
      if (history) history.scrollTop = history.scrollHeight;
    });
  }

  useEffect(() => {
    if (!hasStartedMainChat) return;
    scrollToLatestMainChatMessage();
  }, [hasStartedMainChat, mainChatMessages.length, sending]);

  useEffect(() => {
    const wasInVoiceMode = previousVoiceStatusRef.current !== "idle";
    const isNowTextMode = voiceStatus === "idle";
    previousVoiceStatusRef.current = voiceStatus;
    if (!hasStartedMainChat || !wasInVoiceMode || !isNowTextMode) return;
    const frame = window.requestAnimationFrame(() => {
      scrollToLatestMainChatMessage();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hasStartedMainChat, voiceStatus]);

  useEffect(() => {
    if (!voiceReplyMode) return;
    const latestAgentMessage = [...mainChatMessages].reverse().find((message) => message.role === "agent");
    if (!latestAgentMessage) return;
    const messageId = String(latestAgentMessage.id);
    if (messageId === voiceReplyBaselineId || messageId === spokenMessageId) return;
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

  function routerTaskBody(instruction: string, decision: ChatIntentDecision) {
    return [
      "Created from the main chat router recommendation card.",
      selectedProject ? `Project scope: ${projectLabel(selectedProject)} (${selectedProject.id})` : "Project scope: none selected",
      `Intent: ${decision.intentType}`,
      `Confidence: ${decision.confidence}`,
      `Next action: ${decision.nextAction}`,
      `Reason: ${decision.reason}`,
      "",
      "Original instruction:",
      instruction,
      "",
      "Safety: this card queues work only. External, destructive, account-sensitive, or scheduled actions still require normal Mission Control approval gates.",
    ].join("\n");
  }

  function routerActionsFor(current: { instruction: string; decision: ChatIntentDecision; preview: ChatIntentPreview } | null): ChatIntentRoutingAction[] {
    if (!current) return [];
    const { decision, preview } = current;
    if (!preview.canProceed || decision.confidence === "low") {
      return [{ id: "clarify", label: "Ask clarification", detail: preview.suggestedQuestion || "Focus composer with the suggested clarification", kind: "primary" }];
    }
    const actions: ChatIntentRoutingAction[] = [];
    if (selectedProject?.id) {
      actions.push({ id: "create_project_task", label: "Create project task", detail: `Queue under ${projectLabel(selectedProject)}`, kind: "primary" });
    } else {
      actions.push({ id: "create_task", label: "Create Task Board card", detail: "Queue as a safe one-time task", kind: "primary" });
    }
    if (decision.matchedContext.workflowId) {
      actions.push({ id: "launch_workflow", label: "Launch workflow", detail: `Queue ${decision.matchedContext.workflowTitle || decision.matchedContext.workflowId}`, kind: "safe" });
    }
    if (decision.intentType === "modify_routine") {
      actions.push({ id: "recommend_routine", label: "Recommend routine", detail: "Create a reviewable routine recommendation task", kind: "safe" });
    }
    return actions;
  }

  async function runRoutingAction(action: ChatIntentRoutingActionId) {
    const current = routingPreview;
    if (!current || routingActionBusy) return;
    if (action === "clarify") {
      setRoutingActionMessage(null);
      setRoutingActionError(null);
      setError(current.preview.suggestedQuestion || "Please clarify the target before I route this.");
      window.requestAnimationFrame(() => composerTextareaRef.current?.focus());
      return;
    }
    setRoutingActionBusy(action);
    setRoutingActionMessage(null);
    setRoutingActionError(null);
    try {
      if (action === "launch_workflow") {
        const workflowId = current.decision.matchedContext.workflowId;
        if (!workflowId) throw new Error("No workflow candidate is linked to this route.");
        const response = await request<WorkflowLaunchResponse>(`/api/workflows/${encodeURIComponent(workflowId)}/launch`, {
          method: "POST",
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

      const titlePrefix = action === "recommend_routine" ? "Routine recommendation" : selectedProject ? "Project task" : "Chat task";
      const payload = {
        title: routerTaskTitle(titlePrefix, current.instruction),
        body: routerTaskBody(current.instruction, current.decision),
        assignee: "melkizac",
        status: "todo",
        priority: 1,
        tenant: selectedProject?.id || current.decision.matchedContext.projectId || undefined,
        skills: current.decision.intentType === "modify_routine" ? ["schedule"] : undefined,
      };
      const response = selectedProject?.id && action !== "create_task"
        ? await request<BoardTaskMutationResponse>(`/api/projects/${encodeURIComponent(selectedProject.id)}/tasks`, { method: "POST", body: JSON.stringify(payload) })
        : await request<BoardTaskMutationResponse>("/api/tasks", { method: "POST", body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(response.error || "Task was not created.");
      setRoutingActionMessage(`Task Board card created${response.task?.id ? `: ${response.task.id}` : ""}.`);
    } catch (err) {
      setRoutingActionError(err instanceof Error ? err.message : "Router action failed.");
    } finally {
      setRoutingActionBusy(null);
    }
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

  async function submitInstruction(instructionText: string, options: { preserveDraft?: boolean; keepVoiceScreen?: boolean } = {}) {
    const instruction = instructionText.trim();
    if (!instruction || sending) return;
    setHasStartedMainChat(true);
    setSending(true);
    setError(null);
    const intentDecision = routeInstruction(instruction);
    const preview = buildChatIntentPreview(intentDecision);
    setRoutingPreview({ instruction, decision: intentDecision, preview });
    setRoutingActionMessage(null);
    setRoutingActionError(null);
    if (!preview.canProceed) {
      setSending(false);
      setError(preview.suggestedQuestion ?? "Please clarify the target before I route this.");
      if (options.keepVoiceScreen) setVoiceStatus("ready");
      window.requestAnimationFrame(() => composerTextareaRef.current?.focus());
      return;
    }
    try {
      const newMessages = await sendToAgent("default", composeInstructionContext(instruction, intentDecision));
      const directReply = options.keepVoiceScreen
        ? [...newMessages].reverse().find((message) => message.role === "agent" && visibleChatText(message).trim())
        : undefined;
      if (directReply) speakAgentReply(directReply);
      if (options.preserveDraft !== true) updateDraft("");
      setAttachments([]);
      if (options.keepVoiceScreen) {
        setVoiceStatus((current) => (current === "sending" ? "ready" : current));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mission Control could not send this instruction.");
      if (options.keepVoiceScreen) setVoiceStatus("ready");
    } finally {
      setSending(false);
    }
  }

  async function submit() {
    await submitInstruction(draft);
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

        <main ref={mainChatHistoryRef} className={`main-chat-history ${voiceStatus !== "idle" ? "voice-mode" : ""}`} aria-label={voiceStatus !== "idle" ? "Voice input activation" : "Melkizac conversation history"}>
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
          <div className="mobile-composer-prompt">
            {selectedProject ? `What should we work on in ${projectLabel(selectedProject)}?` : "What should Melkizac work on?"}
          </div>
          {routingPreview && (
            <ChatIntentRoutingPreview
              preview={routingPreview.preview}
              decision={routingPreview.decision}
              sending={sending}
              actions={routerActionsFor(routingPreview)}
              actionBusy={routingActionBusy}
              actionMessage={routingActionMessage}
              actionError={routingActionError}
              onAction={(action) => { void runRoutingAction(action); }}
              onEdit={() => composerTextareaRef.current?.focus()}
            />
          )}
          <textarea
            ref={composerTextareaRef}
            value={draft}
            onChange={(event) => updateDraft(event.target.value)}
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
              {renderVoiceReplyControl()}
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
