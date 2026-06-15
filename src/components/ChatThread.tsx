import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent } from "react";
import { useStore } from "../services/store";
import { Icon } from "./Icon";
import type { Agent, Attachment, Message, ModelRoutingSelection, ProjectChatResponse, ReplyContext, RouterConfig } from "../types";
import { formatSingaporeTime } from "../utils/time";

const ONE_DAY_SECONDS = 24 * 60 * 60;

const statusPill: Record<string, { bg: string; fg: string; dot: string }> = {
  active: { bg: "var(--good-soft)", fg: "#0f7a37", dot: "#15a34a" },
  working: { bg: "var(--good-soft)", fg: "#0f7a37", dot: "#15a34a" },
  idle: { bg: "#eef0f3", fg: "#7b8494", dot: "#aab2bf" },
  degraded: { bg: "var(--warn-soft)", fg: "#9a5e07", dot: "#e8941b" },
  waiting: { bg: "var(--warn-soft)", fg: "#9a5e07", dot: "#e8941b" },
  offline: { bg: "var(--bad-soft)", fg: "#b62a2a", dot: "#dc4040" },
  error: { bg: "var(--bad-soft)", fg: "#b62a2a", dot: "#dc4040" },
};

function visibleMessageKey(m: Message) {
  return `${m.id}|${m.role}`;
}

function isReadableMessage(m: Message) {
  return (m.role === "user" || m.role === "agent") && Boolean(m.text?.trim() || m.attachments?.length || m.artifact || m.insight);
}

function visibleChatText(text?: string) {
  const raw = text || "";
  const markers = ["[Mission Control Chat Context]", "[Mission Control Intent Routing]"];
  const firstInternalMarker = markers
    .map((marker) => raw.indexOf(marker))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  return (firstInternalMarker === undefined ? raw : raw.slice(0, firstInternalMarker)).trim();
}

function messageTimestampLabel(m: Message) {
  if (!m.ts) return m.at;
  const ageSeconds = Date.now() / 1000 - m.ts;
  if (ageSeconds < ONE_DAY_SECONDS) return m.at;

  const sourceParts = m.at?.split(" · ") ?? [];
  const prefix = sourceParts.length > 1 ? `${sourceParts[0]} · ` : "";
  const absolute = formatSingaporeTime(new Date(m.ts * 1000).toISOString(), {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
  return `${prefix}${absolute}`;
}

function messageAuthor(m: Message, agent: Agent) {
  if (m.role === "user") return "You";
  if (m.role === "agent") return agent.name;
  return "System";
}

function messageTextForReply(m: Message) {
  const visibleText = visibleChatText(m.text);
  if (visibleText) return visibleText;
  if (m.insight?.trim()) return m.insight.trim();
  if (m.artifact) return [m.artifact.filename, m.artifact.path, m.artifact.preview].filter(Boolean).join("\n");
  if (m.attachments?.length) return m.attachments.map((a) => `${a.filename} (${a.mime || "file"})`).join("\n");
  return "Message without text";
}

function replyContextForMessage(m: Message, agent: Agent): ReplyContext {
  return {
    id: m.id,
    role: m.role,
    author: messageAuthor(m, agent),
    text: messageTextForReply(m).slice(0, 2000),
    at: messageTimestampLabel(m),
  };
}

function formatRunDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function agentGroupLabel(name: string) {
  return name.replace(/channels/gi, (match) => (match[0] === "C" ? "Groups" : "groups"));
}

function replyPreviewText(reply: ReplyContext) {
  return reply.text.replace(/\s+/g, " ").trim().slice(0, 220) || "Message without text";
}

export function ChatThread({
  agent,
  onOpenDetails,
  onOpenWorkerLog,
  onOpenRateLimits,
  projectChats,
  selectedProjectId = "all",
  selectedSessionId = "all",
}: {
  agent: Agent;
  onOpenDetails?: () => void;
  onOpenWorkerLog?: () => void;
  onOpenRateLimits?: () => void;
  projectChats?: ProjectChatResponse | null;
  selectedProjectId?: string;
  selectedSessionId?: string;
}) {
  const { send, stopProcessing, uploadAttachment, refreshSelected, getModelRouter, setView } = useStore();
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [replyTo, setReplyTo] = useState<ReplyContext | null>(null);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState<{ agentId: string; text: string; attachments: Attachment[]; replyTo?: ReplyContext } | null>(null);
  const [processingStartedAt, setProcessingStartedAt] = useState<{ agentId: string; startedAt: number } | null>(null);
  const [processingNow, setProcessingNow] = useState(() => Date.now());
  const [routerConfig, setRouterConfig] = useState<RouterConfig | null>(null);
  const [modelRouterLoading, setModelRouterLoading] = useState(false);
  const [modelSelection, setModelSelection] = useState(() => window.localStorage.getItem("hmc:model-selection") || "auto");
  const [lastSeenKey, setLastSeenKey] = useState<string | null | undefined>(undefined);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [agentActionMenuOpen, setAgentActionMenuOpen] = useState(false);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const agentActionMenuRef = useRef<HTMLDivElement | null>(null);
  const activeRequestRef = useRef<{ id: string; agentId: string; controller: AbortController } | null>(null);
  const unreadRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const p = statusPill[agent.status] || statusPill.degraded;
  const storageKey = `hmc:last-seen-message:${agent.id}`;
  const enabledModels = useMemo(() => (routerConfig?.models ?? []).filter((model) => model.enabled), [routerConfig]);
  const selectedModel = useMemo(() => enabledModels.find((model) => model.id === modelSelection), [enabledModels, modelSelection]);
  const modelSelectorLabel = selectedModel
    ? `${selectedModel.label || selectedModel.model} · ${selectedModel.tier}${selectedModel.authorized ? "" : " · key missing"}`
    : modelRouterLoading
      ? "Loading model options…"
    : routerConfig?.enabled === false
      ? "Default Hermes model"
      : "Auto-select by complexity";
  const projectSessions = useMemo(
    () => (projectChats?.sessions ?? []).filter((session) => selectedProjectId === "all" || session.project_id === selectedProjectId),
    [projectChats, selectedProjectId],
  );
  const scopedSessionIds = useMemo(() => new Set(projectSessions.map((session) => session.id)), [projectSessions]);
  const scopedMessages = useMemo(() => {
    if (selectedSessionId !== "all") return agent.messages.filter((m) => m.sessionId === selectedSessionId || m.requestId?.includes(selectedSessionId));
    if (selectedProjectId !== "all") return agent.messages.filter((m) => m.projectId === selectedProjectId || (!m.projectId && (!m.sessionId || scopedSessionIds.has(m.sessionId))));
    return agent.messages;
  }, [agent.messages, scopedSessionIds, selectedProjectId, selectedSessionId]);
  const activeProjectName = useMemo(
    () => projectChats?.projects.find((project) => project.id === selectedProjectId)?.name,
    [projectChats, selectedProjectId],
  );
  const activeSession = useMemo(
    () => projectSessions.find((session) => session.id === selectedSessionId),
    [projectSessions, selectedSessionId],
  );
  const activeSessionTitle = activeSession?.title;
  const sortedMessages = useMemo(
    () =>
      [...scopedMessages].sort(
        (a, b) =>
          (a.ts ?? 0) - (b.ts ?? 0) ||
          (String(a.id).startsWith("session-") ? 0 : 1) - (String(b.id).startsWith("session-") ? 0 : 1) ||
          String(a.id).localeCompare(String(b.id)),
      ),
    [scopedMessages],
  );
  const readableMessages = useMemo(() => sortedMessages.filter(isReadableMessage), [sortedMessages]);
  const latestMessageKey = readableMessages.length ? visibleMessageKey(readableMessages[readableMessages.length - 1]) : null;
  const activeBackendRequestId = useMemo(() => {
    const activeIds = new Set(agent.processingRequests ?? []);
    if (!activeIds.size) return null;
    const activeUserRequests = [...sortedMessages]
      .reverse()
      .filter((m) => m.role === "user" && m.requestId && activeIds.has(m.requestId));
    for (const userMessage of activeUserRequests) {
      const completed = sortedMessages.some((m) => m.requestId === userMessage.requestId && (m.role === "agent" || m.role === "system"));
      if (!completed) return userMessage.requestId ?? null;
    }
    return agent.processingRequests?.[0] ?? null;
  }, [agent.processingRequests, sortedMessages]);
  const activeBackendRequestDetail = useMemo(
    () => (agent.processingRequestDetails ?? []).find((item) => item.id === activeBackendRequestId),
    [activeBackendRequestId, agent.processingRequestDetails],
  );
  const activeBackendUserMessage = useMemo(
    () => sortedMessages.find((m) => m.role === "user" && m.requestId === activeBackendRequestId),
    [activeBackendRequestId, sortedMessages],
  );
  const activeLocalRequest = activeRequestRef.current?.agentId === agent.id ? activeRequestRef.current : null;
  const pendingBackendUserVisible = useMemo(
    () => sortedMessages.some((m) => m.role === "user" && m.requestId === activeLocalRequest?.id && Boolean(m.text?.trim() || m.attachments?.length)),
    [activeLocalRequest?.id, sortedMessages],
  );
  const visiblePendingMessage = pendingMessage?.agentId === agent.id && !pendingBackendUserVisible ? pendingMessage : null;
  const activeBackendStartedAt = activeBackendUserMessage?.ts
    ? activeBackendUserMessage.ts * 1000
    : activeBackendRequestDetail?.started_at
      ? activeBackendRequestDetail.started_at * 1000
      : null;
  const activeLocalStartedAt = processingStartedAt?.agentId === agent.id ? processingStartedAt.startedAt : null;
  const sendingForThisAgent = sending && activeLocalRequest?.agentId === agent.id;
  const isProcessing = sendingForThisAgent || Boolean(activeBackendRequestId);
  const effectiveProcessingStartedAt = activeLocalStartedAt ?? activeBackendStartedAt;
  const processingElapsedLabel = effectiveProcessingStartedAt ? formatRunDuration(processingNow - effectiveProcessingStartedAt) : "0:00";

  const resizeComposerInput = () => {
    const input = composerInputRef.current;
    if (!input) return;
    input.style.height = "auto";
    const styles = window.getComputedStyle(input);
    const lineHeight = Number.parseFloat(styles.lineHeight) || 20;
    const paddingY = Number.parseFloat(styles.paddingTop || "0") + Number.parseFloat(styles.paddingBottom || "0");
    const maxHeight = lineHeight * 10 + paddingY;
    const nextHeight = Math.min(input.scrollHeight, maxHeight);
    input.style.height = `${nextHeight}px`;
    input.style.overflowY = input.scrollHeight > maxHeight + 1 ? "auto" : "hidden";
  };

  useLayoutEffect(() => {
    resizeComposerInput();
  }, [draft]);

  useEffect(() => {
    const onResize = () => resizeComposerInput();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!agentActionMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!agentActionMenuRef.current?.contains(event.target as Node)) setAgentActionMenuOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [agentActionMenuOpen]);

  useEffect(() => {
    if (!effectiveProcessingStartedAt) return;
    setProcessingNow(Date.now());
    const timer = window.setInterval(() => setProcessingNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [effectiveProcessingStartedAt]);

  useEffect(() => {
    if (!activeBackendRequestId) return;
    const poll = window.setInterval(() => void refreshSelected().catch(() => undefined), 3000);
    return () => window.clearInterval(poll);
  }, [activeBackendRequestId, refreshSelected]);

  const ensureModelRouter = useCallback(async () => {
    if (routerConfig || modelRouterLoading) return routerConfig;
    setModelRouterLoading(true);
    let alive = true;
    try {
      const cfg = await getModelRouter();
      if (!alive) return cfg;
      setRouterConfig(cfg);
      const exists = modelSelection === "auto" || (cfg.models ?? []).some((model) => model.enabled && model.id === modelSelection);
      if (!exists) setModelSelection("auto");
      return cfg;
    } catch {
      if (alive) setRouterConfig(null);
      return null;
    } finally {
      if (alive) setModelRouterLoading(false);
    }
  }, [getModelRouter, modelRouterLoading, modelSelection, routerConfig]);

  useEffect(() => {
    if (modelSelection === "auto") return;
    let alive = true;
    setModelRouterLoading(true);
    void getModelRouter()
      .then((cfg) => {
        if (!alive) return;
        setRouterConfig(cfg);
        const exists = modelSelection === "auto" || (cfg.models ?? []).some((model) => model.enabled && model.id === modelSelection);
        if (!exists) setModelSelection("auto");
      })
      .catch(() => {
        if (alive) setRouterConfig(null);
      })
      .finally(() => {
        if (alive) setModelRouterLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [getModelRouter, modelSelection]);

  useEffect(() => {
    window.localStorage.setItem("hmc:model-selection", modelSelection);
  }, [modelSelection]);

  const resolveModelRouting = async (): Promise<ModelRoutingSelection> => {
    if (modelSelection === "auto") return { mode: "auto" };
    const cfg = routerConfig ?? await ensureModelRouter();
    const manualModel = (cfg?.models ?? []).find((model) => model.enabled && model.id === modelSelection);
    return manualModel ? { mode: "manual", modelId: manualModel.id } : { mode: "auto" };
  };

  useEffect(() => {
    const previousSeen = window.localStorage.getItem(storageKey);
    setLastSeenKey(previousSeen ?? null);
  }, [storageKey]);

  const unreadStartIndex = useMemo(() => {
    if (!readableMessages.length || lastSeenKey === undefined) return -1;
    if (lastSeenKey === null) return -1;
    const seenIndex = readableMessages.findIndex((m) => visibleMessageKey(m) === lastSeenKey);
    if (seenIndex < 0) return 0;
    return seenIndex < readableMessages.length - 1 ? seenIndex + 1 : -1;
  }, [lastSeenKey, readableMessages]);

  const unreadStartId = unreadStartIndex >= 0 ? readableMessages[unreadStartIndex]?.id : null;

  const updateJumpButton = () => {
    const thread = threadRef.current;
    if (!thread) return;
    const distanceFromBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight;
    setShowJumpToLatest(distanceFromBottom > 180);
  };

  const jumpToLatest = () => {
    const thread = threadRef.current;
    if (thread) {
      thread.scrollTo({ top: thread.scrollHeight, behavior: "smooth" });
    } else {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
    window.setTimeout(updateJumpButton, 350);
  };

  useEffect(() => {
    const target = unreadStartIndex >= 0 && !visiblePendingMessage ? unreadRef.current : bottomRef.current;
    window.requestAnimationFrame(() => {
      target?.scrollIntoView({ block: unreadStartIndex >= 0 && !visiblePendingMessage ? "start" : "end" });
      updateJumpButton();
    });
  }, [agent.id, unreadStartIndex, sortedMessages.length, visiblePendingMessage]);

  useEffect(() => {
    if (!latestMessageKey) return;
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(storageKey, latestMessageKey);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [latestMessageKey, storageKey]);

  const submit = async () => {
    const text = draft.trim();
    const sentAttachments = attachments;
    const sentReplyTo = replyTo;
    if ((!text && sentAttachments.length === 0) || isProcessing || uploading) return;
    const controller = new AbortController();
    const requestId = `ui-${agent.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    activeRequestRef.current = { id: requestId, agentId: agent.id, controller };
    setDraft("");
    setAttachments([]);
    setReplyTo(null);
    setPendingMessage({ agentId: agent.id, text, attachments: sentAttachments, replyTo: sentReplyTo ?? undefined });
    const startedAt = Date.now();
    setProcessingStartedAt({ agentId: agent.id, startedAt });
    setProcessingNow(startedAt);
    setSending(true);
    setError(null);
    try {
      const modelRouting = await resolveModelRouting();
      await send(text, sentAttachments, { signal: controller.signal, requestId, replyTo: sentReplyTo ?? undefined, modelRouting });
    } catch (err) {
      if (controller.signal.aborted) {
        setError("Stopped the current message before it was added to the chat.");
        return;
      }
      const message = err instanceof Error ? err.message : "Failed to send message";
      const maybeCompleted = /bad gateway|gateway|timeout|network|failed to fetch|502|503|504/i.test(message);
      if (maybeCompleted) {
        setDraft("");
        setError("Connection dropped while the agent was processing. Refreshing the latest chat instead of putting the sent message back in the composer…");
        for (const delay of [1200, 3000, 6000, 10000]) {
          window.setTimeout(() => void refreshSelected().catch(() => undefined), delay);
        }
      } else {
        setDraft(text);
        setAttachments(sentAttachments);
        setReplyTo(sentReplyTo);
        setError(message);
      }
    } finally {
      if (activeRequestRef.current?.id === requestId) activeRequestRef.current = null;
      setPendingMessage(null);
      setProcessingStartedAt(null);
      setSending(false);
    }
  };

  const stopCurrentMessage = async () => {
    const active = activeRequestRef.current?.agentId === agent.id ? activeRequestRef.current : null;
    const requestId = active?.id ?? activeBackendRequestId ?? undefined;
    if (!requestId) return;
    active?.controller.abort();
    setPendingMessage((current) => current?.agentId === agent.id ? null : current);
    setProcessingStartedAt((current) => current?.agentId === agent.id ? null : current);
    setSending(false);
    setError("Stopping current message…");
    try {
      await stopProcessing(requestId);
      setReplyTo(null);
      await refreshSelected().catch(() => undefined);
      setError("Stopped the current message before it finished processing.");
    } catch (err) {
      setError(err instanceof Error ? `Stopped locally, but backend stop failed: ${err.message}` : "Stopped locally, but backend stop failed");
    } finally {
      if (active && activeRequestRef.current?.id === active.id) activeRequestRef.current = null;
    }
  };

  const uploadFiles = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded: Attachment[] = [];
      for (const file of files.slice(0, 8 - attachments.length)) {
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`${file.name} is larger than the 10 MB upload limit`);
        }
        uploaded.push(await uploadAttachment(file));
      }
      setAttachments((cur) => [...cur, ...uploaded].slice(0, 8));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload attachment");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onPickFiles = async (files: FileList | null) => {
    await uploadFiles(files ? Array.from(files) : []);
  };

  const handlePasteIntoChat = (event: ClipboardEvent<HTMLDivElement>) => {
    if (isProcessing || uploading) return;
    const target = event.target as HTMLElement | null;
    const isNativeEditable = Boolean(target?.closest("input, textarea, select, [contenteditable='true']"));
    const clipboard = event.clipboardData;
    const fileItems = Array.from(clipboard.items ?? [])
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    const pastedFiles = fileItems.length ? fileItems : Array.from(clipboard.files ?? []);

    if (pastedFiles.length > 0) {
      event.preventDefault();
      void uploadFiles(pastedFiles);
      window.requestAnimationFrame(() => composerInputRef.current?.focus());
      return;
    }

    const text = clipboard.getData("text/plain");
    if (!text || isNativeEditable) return;
    event.preventDefault();
    setDraft((current) => `${current}${current && !current.endsWith("\n") ? "\n" : ""}${text}`);
    window.requestAnimationFrame(() => composerInputRef.current?.focus());
  };

  return (
    <div className="center" onPaste={handlePasteIntoChat}>
      <div className="chead">
        <span className="av" style={{ background: agent.color }}>
          {agent.initials}
        </span>
        <div className="nm">
          {agent.name} — {agentGroupLabel(agent.squad)} Agent
        </div>
        <span className="statuspill" style={{ background: p.bg, color: p.fg }}>
          <span className="sdot" style={{ background: p.dot }} />
          {agent.statusLabel || agent.status} · {agent.activityState || agent.availability || "runtime"} · session #{agent.sessionCount}
        </span>
        <div className="right">
          {(onOpenWorkerLog || onOpenDetails || onOpenRateLimits) && (
            <div className="agent-action-menu" ref={agentActionMenuRef}>
              <button
                className="iconbtn agent-action-menu-trigger"
                type="button"
                aria-label="Open agent actions"
                aria-haspopup="menu"
                aria-expanded={agentActionMenuOpen}
                onClick={() => setAgentActionMenuOpen((open) => !open)}
              >
                <Icon name="more" size={16} />
              </button>
              {agentActionMenuOpen && (
                <div className="agent-action-dropdown" role="menu" aria-label="Agent actions">
                  {onOpenWorkerLog && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAgentActionMenuOpen(false);
                        onOpenWorkerLog();
                      }}
                    >
                      Agent Log
                    </button>
                  )}
                  {onOpenDetails && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAgentActionMenuOpen(false);
                        onOpenDetails();
                      }}
                    >
                      Details
                    </button>
                  )}
                  {onOpenRateLimits && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAgentActionMenuOpen(false);
                        onOpenRateLimits();
                      }}
                    >
                      Rate limits
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="thread scroll" ref={threadRef} onScroll={updateJumpButton}>
        <div className="divider">
          {selectedSessionId !== "all"
            ? `Session view · ${activeSessionTitle ?? selectedSessionId}${activeSession?.relationship_type ? ` · ${activeSession.relationship_type.replace(/[_-]+/g, " ")}` : ""}`
            : selectedProjectId !== "all"
              ? `Project view · ${activeProjectName ?? selectedProjectId}`
              : "Global Command Chat · sorted into projects and sessions"}
        </div>
        {sortedMessages.length === 0 && (
          <div className="empty" style={{ marginTop: 30 }}>
            No messages yet. Send {agent.name} a task below.
          </div>
        )}
        {sortedMessages.map((m) => (
          <div key={m.id}>
            {m.id === unreadStartId && (
              <div className="unread-divider" ref={unreadRef}>
                <span>Unread since your last visit</span>
              </div>
            )}
            <MessageView m={m} agent={agent} onReply={(message) => setReplyTo(replyContextForMessage(message, agent))} />
          </div>
        ))}
        {(visiblePendingMessage || activeBackendRequestId) && (
          <>
            {visiblePendingMessage && (
              <MessageView m={{ id: "pending-user", role: "user", text: visiblePendingMessage.text, attachments: visiblePendingMessage.attachments, replyTo: visiblePendingMessage.replyTo, at: "just now" }} agent={agent} />
            )}
            <div className="processing-inline" role="status" aria-live="polite" aria-label={`${agent.name} is processing your message`}>
              <span className="processing-inline-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <span>{agent.name} is processing…</span>
              <span className="processing-inline-timer" aria-label={`Elapsed processing time ${processingElapsedLabel}`} title="Elapsed processing time">
                {processingElapsedLabel}
              </span>
            </div>
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {showJumpToLatest && (
        <button
          className="jump-to-latest"
          type="button"
          onClick={jumpToLatest}
          aria-label="Jump back to the latest message"
        >
          <span>Latest</span>
          <Icon name="arrowDown" size={15} />
        </button>
      )}

      <div className="composer">
        {error && <div className="senderror">{error}</div>}
        {replyTo && (
          <div className="reply-context" aria-label="Replying to selected message">
            <div>
              <b>Replying to {replyTo.author}</b>
              <span>{replyPreviewText(replyTo)}</span>
            </div>
            <button type="button" onClick={() => setReplyTo(null)} aria-label="Clear reply context" title="Clear reply context">
              <Icon name="close" size={13} />
            </button>
          </div>
        )}
        {attachments.length > 0 && (
          <div className="attachment-tray" aria-label="Selected attachments">
            {attachments.map((attachment) => (
              <AttachmentChip
                key={`${attachment.path}-${attachment.filename}`}
                attachment={attachment}
                onRemove={() => setAttachments((cur) => cur.filter((item) => item.path !== attachment.path))}
              />
            ))}
          </div>
        )}
        <div className="cbox composer-card">
          <textarea
            ref={composerInputRef}
            className="composer-input"
            placeholder={uploading ? "Uploading attachment…" : isProcessing ? `${agent.name} is processing…` : `Send a task or message to ${agent.name}…`}
            value={draft}
            disabled={isProcessing || uploading}
            rows={1}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
          />
          <div className="composer-control-row">
            <button
              className="plus"
              type="button"
              disabled={isProcessing || uploading || attachments.length >= 8}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach image or file"
              title="Attach image or file"
            >
              <Icon name="plus" size={20} />
            </button>
            <input
              ref={fileInputRef}
              className="file-input"
              type="file"
              multiple
              accept="image/*,.txt,.md,.csv,.json,.yaml,.yml,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
              onChange={(e) => void onPickFiles(e.currentTarget.files)}
            />
            <div className="composer-spacer" />
            <label className="model-selector-row" title={modelSelectorLabel}>
              <span className="sr-only">Model</span>
              <select
                value={selectedModel ? selectedModel.id : "auto"}
                onChange={(e) => setModelSelection(e.target.value)}
                onFocus={() => void ensureModelRouter()}
                onPointerDown={() => void ensureModelRouter()}
                disabled={isProcessing || uploading}
                aria-label="Select AI model for this message"
              >
                <option value="auto">{modelRouterLoading ? "Auto · loading models…" : "Auto"}</option>
                {enabledModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {(model.label || model.model)} · {model.tier}{model.authorized ? "" : " · key missing"}
                  </option>
                ))}
              </select>
            </label>
            <button className="mic" type="button" onClick={() => setView("agent-voice")} aria-label="Open Agent Voice visualizer" title="Open Agent Voice">
              <Icon name="mic" size={18} />
            </button>
            <button
              className={isProcessing ? "send stop-send" : "send"}
              type="button"
              onClick={() => (isProcessing ? void stopCurrentMessage() : void submit())}
              disabled={uploading || (!isProcessing && !draft.trim() && attachments.length === 0)}
              aria-label={isProcessing ? "Stop current message processing" : "Send message"}
              title={isProcessing ? "Stop current message processing" : "Send message"}
            >
              {isProcessing ? <Icon name="stop" size={15} /> : uploading ? "…" : <Icon name="send" size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentChip({ attachment, onRemove }: { attachment: Attachment; onRemove?: () => void }) {
  const isImage = attachment.mime.startsWith("image/") && attachment.url;
  return (
    <div className="attachment-chip">
      {isImage ? <img src={attachment.url} alt="" /> : <span className="attachment-file-icon"><Icon name="file" size={14} /></span>}
      <div className="attachment-chip-main">
        <span>{attachment.filename}</span>
        <small>{attachment.mime || "file"} · {formatBytes(attachment.sizeBytes)}</small>
      </div>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remove ${attachment.filename}`}>
          <Icon name="close" size={13} />
        </button>
      )}
    </div>
  );
}

function AttachmentList({ attachments }: { attachments?: Attachment[] }) {
  if (!attachments?.length) return null;
  return (
    <div className="message-attachments">
      {attachments.map((attachment) => (
        <a
          key={`${attachment.path}-${attachment.filename}`}
          className="message-attachment-card"
          href={attachment.url || "#"}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => {
            if (!attachment.url) e.preventDefault();
          }}
        >
          {attachment.mime.startsWith("image/") && attachment.url ? (
            <img src={attachment.url} alt={attachment.filename} />
          ) : (
            <span className="attachment-file-icon"><Icon name="file" size={16} /></span>
          )}
          <span>
            <b>{attachment.filename}</b>
            <small>{attachment.mime || "file"} · {formatBytes(attachment.sizeBytes)}</small>
          </span>
        </a>
      ))}
    </div>
  );
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!ok) throw new Error("Copy failed");
}

function CopyMessageButton({ text, label = "message" }: { text?: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const value = text?.trim() ?? "";
  if (!value) return null;

  const onCopy = async () => {
    try {
      await copyTextToClipboard(value);
      setCopied(true);
      setFailed(false);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setFailed(true);
      window.setTimeout(() => setFailed(false), 1800);
    }
  };

  return (
    <button
      className={"copymsg" + (copied ? " copied" : "") + (failed ? " failed" : "")}
      type="button"
      onClick={onCopy}
      aria-label={`Copy ${label} text`}
      title={failed ? "Copy failed" : copied ? "Copied" : "Copy text"}
    >
      <Icon name={copied ? "check" : "copy"} size={13} />
      <span>{failed ? "Failed" : copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

function ReplyMessageButton({ message, onReply }: { message: Message; onReply?: (message: Message) => void }) {
  if (!onReply || message.role === "system") return null;
  return (
    <button
      className="replymsg"
      type="button"
      onClick={() => onReply(message)}
      aria-label="Reply using this message as context"
      title="Reply using this message as context"
    >
      <Icon name="reply" size={13} />
      <span>Reply</span>
    </button>
  );
}

function ReplyQuote({ reply }: { reply?: ReplyContext }) {
  if (!reply) return null;
  return (
    <div className="reply-quote">
      <b>{reply.author}</b>
      <span>{replyPreviewText(reply)}</span>
    </div>
  );
}

function MessageView({ m, agent, onReply }: { m: Message; agent: Agent; onReply?: (message: Message) => void }) {
  if (m.toolCall) {
    return (
      <div style={{ marginLeft: 41 }}>
        <div className="toolchip">
          <span className="spin" /> running skill · <span className="mono">{m.toolCall.skill}</span>
          {m.toolCall.detail ? ` · ${m.toolCall.detail}` : ""}
        </div>
      </div>
    );
  }

  if (m.artifact) {
    const a = m.artifact;
    return (
      <div className="msg">
        <span className="av" style={{ background: agent.color }}>
          {agent.initials}
        </span>
        <div>
          <div className="who message-meta">
            {agent.name} <span className="t">{messageTimestampLabel(m)}</span>
            <span className="message-actions">
              <ReplyMessageButton message={m} onReply={onReply} />
              <CopyMessageButton text={a.preview || `${a.filename}\n${a.path}`} label="artifact preview" />
            </span>
          </div>
          <div className="artifact">
            <div className="top">
              <div className="aic">▦</div>
              <div>
                <div className="fn">{a.filename}</div>
                <div className="ameta">
                  {a.path} · {Math.round(a.sizeBytes / 1000)} KB{a.version ? ` · ${a.version}` : ""}{a.qaStatus ? ` · QA ${a.qaStatus}` : ""}
                </div>
              </div>
              {a.downloadUrl || a.url ? (
                <a className="dl" href={a.downloadUrl || a.url} target="_blank" rel="noreferrer" download aria-label={`Download ${a.filename}`}>
                  <Icon name="download" size={15} />
                </a>
              ) : (
                <button className="dl" type="button" disabled aria-label="No download available">
                  <Icon name="download" size={15} />
                </button>
              )}
            </div>
            {a.preview && <div className="prev">{a.preview}</div>}
            <div className="artifact-actions">
              {(a.previewUrl || a.url) && <a href={a.previewUrl || a.url} target="_blank" rel="noreferrer">Preview</a>}
              {a.driveUrl && <a href={a.driveUrl} target="_blank" rel="noreferrer">Drive</a>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (m.insight) {
    return (
      <div style={{ marginLeft: 41 }}>
        <div className="insight">
          <span>✦</span>
          <div>
            <div className="message-meta insight-meta">
              <b>Insight</b>
              <span className="message-actions">
                <ReplyMessageButton message={m} onReply={onReply} />
                <CopyMessageButton text={m.insight} label="insight" />
              </span>
            </div>
            {m.insight}
          </div>
        </div>
      </div>
    );
  }

  if (m.role === "system") {
    return (
      <div style={{ marginLeft: 41, marginBottom: 16 }}>
        <div className="sysmsg">
          <span>{m.text}</span>
          <CopyMessageButton text={m.text} label="system message" />
        </div>
      </div>
    );
  }

  const isUser = m.role === "user";
  const visibleText = visibleChatText(m.text);
  return (
    <div className={"msg" + (isUser ? " me" : "")}>
      <span className="av" style={{ background: isUser ? "#1e2633" : agent.color }}>
        {isUser ? "M" : agent.initials}
      </span>
      <div>
        <div className="who message-meta">
          <span>
            {isUser ? "You" : agent.name} <span className="t">{messageTimestampLabel(m)}</span>
          </span>
          <span className="message-actions">
            <ReplyMessageButton message={m} onReply={onReply} />
            <CopyMessageButton text={visibleText} label={isUser ? "your message" : "agent message"} />
          </span>
        </div>
        <ReplyQuote reply={m.replyTo} />
        {visibleText && <div className="bubble">{visibleText}</div>}
        <AttachmentList attachments={m.attachments} />
      </div>
    </div>
  );
}
