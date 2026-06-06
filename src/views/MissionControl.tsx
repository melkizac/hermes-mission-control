import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { ChatIntentRoutingPreview } from "../components/ChatIntentRoutingPreview";
import voiceHudReference from "../assets/voice-hud-reference.jpg";
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
  const draftRef = useRef("");
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
    if (!voiceReplyMode) return;
    const latestAgentMessage = [...mainChatMessages].reverse().find((message) => message.role === "agent");
    if (!latestAgentMessage) return;
    const messageId = String(latestAgentMessage.id);
    if (messageId === voiceReplyBaselineId || messageId === spokenMessageId) return;
    speakAgentReply(latestAgentMessage);
  }, [mainChatMessages, spokenMessageId, voiceReplyBaselineId, voiceReplyMode]);

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
    utterance.lang = "en-SG";
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onstart = () => {
      if (voiceSpeechStartTimerRef.current) {
        window.clearTimeout(voiceSpeechStartTimerRef.current);
        voiceSpeechStartTimerRef.current = null;
      }
      setVoiceReplyNeedsTap(false);
      setSpeechPlaying(true);
      setVoiceStatus("speaking");
      setVoiceMessage("Melkizac is speaking. Tap the animation to stop.");
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
    setVoiceStatus(userStarted ? "speaking" : "ready");
    setVoiceMessage(userStarted ? "Starting voice reply…" : "Melkizac replied. Playing voice reply…");
    setVoiceReplyNeedsTap(false);
    window.speechSynthesis.speak(utterance);
    voiceSpeechStartTimerRef.current = window.setTimeout(() => {
      if (!window.speechSynthesis.speaking) {
        setSpeechPlaying(false);
        stopVoiceVisualPulse();
        setVoiceStatus("ready");
        setVoiceReplyNeedsTap(true);
        setVoiceMessage("Melkizac replied. Tap the animation to play the voice reply.");
      }
    }, 900);
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
      const visibleVoiceText = voiceReplyText || (voiceStatus === "listening" ? voiceTranscript : "");
      return (
        <button
          className={`voice-activation full-window ${voiceStatus} ${speechPlaying ? "voice-speaking" : ""} voice-deactivate-hitarea`}
          type="button"
          onClick={handleVoiceScreenTap}
          aria-label={label}
          title={voiceTitle}
          style={voiceStyle}
        >
          {orb}
          <span className="voice-activation-panel" aria-hidden="true">
            <strong>{voiceReplyNeedsTap ? "Tap to hear Melkizac" : voiceStatus === "speaking" ? "Melkizac speaking" : voiceStatus === "sending" ? "Waiting for Melkizac" : voiceStatus === "listening" ? "Listening" : voiceReplyText ? "Melkizac replied" : "Voice ready"}</strong>
            <span>{voiceMessage}</span>
            {visibleVoiceText && <em>{visibleVoiceText}</em>}
          </span>
        </button>
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
    if (!preview.canProceed) {
      setSending(false);
      setError(preview.suggestedQuestion ?? "Please clarify the target before I route this.");
      if (options.keepVoiceScreen) setVoiceStatus("ready");
      window.requestAnimationFrame(() => composerTextareaRef.current?.focus());
      return;
    }
    try {
      await sendToAgent("default", composeInstructionContext(instruction, intentDecision));
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
        <h1>{selectedProject ? `What should we work on in ${projectLabel(selectedProject)}?` : "What should Melkizac work on?"}</h1>

        <form className="clean-chat-composer" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <textarea
            ref={composerTextareaRef}
            value={draft}
            onChange={(event) => updateDraft(event.target.value)}
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
              {renderVoiceReplyControl()}
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
          <div className="mobile-composer-prompt">
            {selectedProject ? `What should we work on in ${projectLabel(selectedProject)}?` : "What should Melkizac work on?"}
          </div>
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
