import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../services/store";
import { Icon } from "./Icon";
import type { Agent, Attachment, Message, ReplyContext } from "../types";
import { formatSingaporeTime } from "../utils/time";

const ONE_DAY_SECONDS = 24 * 60 * 60;

const statusPill: Record<string, { bg: string; fg: string; dot: string }> = {
  working: { bg: "var(--good-soft)", fg: "#0f7a37", dot: "#15a34a" },
  waiting: { bg: "var(--warn-soft)", fg: "#9a5e07", dot: "#e8941b" },
  idle: { bg: "#eef0f3", fg: "#7b8494", dot: "#aab2bf" },
  error: { bg: "var(--bad-soft)", fg: "#b62a2a", dot: "#dc4040" },
  offline: { bg: "#eef0f3", fg: "#7b8494", dot: "#aab2bf" },
};

function visibleMessageKey(m: Message) {
  return `${m.id}|${m.role}`;
}

function isReadableMessage(m: Message) {
  return (m.role === "user" || m.role === "agent") && Boolean(m.text?.trim() || m.attachments?.length || m.artifact || m.insight);
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
  if (m.text?.trim()) return m.text.trim();
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

function replyPreviewText(reply: ReplyContext) {
  return reply.text.replace(/\s+/g, " ").trim().slice(0, 220) || "Message without text";
}

export function ChatThread({ agent, onOpenDetails }: { agent: Agent; onOpenDetails?: () => void }) {
  const { send, stopProcessing, uploadAttachment, refreshSelected } = useStore();
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [replyTo, setReplyTo] = useState<ReplyContext | null>(null);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState<{ text: string; attachments: Attachment[]; replyTo?: ReplyContext } | null>(null);
  const [lastSeenKey, setLastSeenKey] = useState<string | null | undefined>(undefined);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeRequestRef = useRef<{ id: string; controller: AbortController } | null>(null);
  const unreadRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const p = statusPill[agent.status];
  const storageKey = `hmc:last-seen-message:${agent.id}`;
  const sortedMessages = useMemo(
    () =>
      [...agent.messages].sort(
        (a, b) =>
          (a.ts ?? 0) - (b.ts ?? 0) ||
          (String(a.id).startsWith("session-") ? 0 : 1) - (String(b.id).startsWith("session-") ? 0 : 1) ||
          String(a.id).localeCompare(String(b.id)),
      ),
    [agent.messages],
  );
  const readableMessages = useMemo(() => sortedMessages.filter(isReadableMessage), [sortedMessages]);
  const latestMessageKey = readableMessages.length ? visibleMessageKey(readableMessages[readableMessages.length - 1]) : null;

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
    const target = unreadStartIndex >= 0 && !pendingMessage ? unreadRef.current : bottomRef.current;
    window.requestAnimationFrame(() => {
      target?.scrollIntoView({ block: unreadStartIndex >= 0 && !pendingMessage ? "start" : "end" });
      updateJumpButton();
    });
  }, [agent.id, unreadStartIndex, sortedMessages.length, pendingMessage]);

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
    if ((!text && sentAttachments.length === 0) || sending || uploading) return;
    const controller = new AbortController();
    const requestId = `ui-${agent.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    activeRequestRef.current = { id: requestId, controller };
    setDraft("");
    setAttachments([]);
    setReplyTo(null);
    setPendingMessage({ text, attachments: sentAttachments, replyTo: sentReplyTo ?? undefined });
    setSending(true);
    setError(null);
    try {
      await send(text, sentAttachments, { signal: controller.signal, requestId, replyTo: sentReplyTo ?? undefined });
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
      setSending(false);
    }
  };

  const stopCurrentMessage = async () => {
    const active = activeRequestRef.current;
    if (!active) return;
    active.controller.abort();
    setPendingMessage(null);
    setSending(false);
    setError("Stopping current message…");
    try {
      await stopProcessing(active.id);
      setReplyTo(null);
      setError("Stopped the current message before it was added to the chat.");
    } catch (err) {
      setError(err instanceof Error ? `Stopped locally, but backend stop failed: ${err.message}` : "Stopped locally, but backend stop failed");
    } finally {
      if (activeRequestRef.current?.id === active.id) activeRequestRef.current = null;
    }
  };

  const onPickFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded: Attachment[] = [];
      for (const file of Array.from(files).slice(0, 8 - attachments.length)) {
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

  return (
    <div className="center">
      <div className="chead">
        <span className="av" style={{ background: agent.color }}>
          {agent.initials}
        </span>
        <div className="nm">
          {agent.name} — {agent.squad} Agent
        </div>
        <span className="statuspill" style={{ background: p.bg, color: p.fg }}>
          <span className="sdot" style={{ background: p.dot }} />
          {agent.status} · session #{agent.sessionCount}
        </span>
        <div className="right">
          {onOpenDetails && (
            <button className="btn agent-details-trigger" onClick={onOpenDetails}>
              Details
            </button>
          )}
          <button className="iconbtn">
            <Icon name="more" size={16} />
          </button>
        </div>
      </div>

      <div className="thread scroll" ref={threadRef} onScroll={updateJumpButton}>
        <div className="divider">Unified Hermes chat history · Terminal + Telegram + Web UI</div>
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
        {pendingMessage && (
          <>
            <MessageView m={{ id: "pending-user", role: "user", text: pendingMessage.text, attachments: pendingMessage.attachments, replyTo: pendingMessage.replyTo, at: "just now" }} agent={agent} />
            <AgentThinking agent={agent} />
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
        <div className="cbox">
          <button
            className="plus"
            type="button"
            disabled={sending || uploading || attachments.length >= 8}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach image or file"
            title="Attach image or file"
          >
            <Icon name="plus" size={18} />
          </button>
          <input
            ref={fileInputRef}
            className="file-input"
            type="file"
            multiple
            accept="image/*,.txt,.md,.csv,.json,.yaml,.yml,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
            onChange={(e) => void onPickFiles(e.currentTarget.files)}
          />
          <input
            placeholder={uploading ? "Uploading attachment…" : sending ? `Sending to ${agent.name}…` : `Send a task or message to ${agent.name}…`}
            value={draft}
            disabled={sending || uploading}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void submit();
              }
            }}
          />
          <button
            className={sending ? "send stop-send" : "send"}
            type="button"
            onClick={() => (sending ? void stopCurrentMessage() : void submit())}
            disabled={uploading || (!sending && !draft.trim() && attachments.length === 0)}
            aria-label={sending ? "Stop current message processing" : "Send message"}
            title={sending ? "Stop current message processing" : "Send message"}
          >
            {sending ? <Icon name="stop" size={15} /> : uploading ? "…" : <Icon name="send" size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}

function AgentThinking({ agent }: { agent: Agent }) {
  return (
    <div className="msg thinking-msg" aria-live="polite" aria-label={`${agent.name} is processing your last instruction`}>
      <span className="av thinking-avatar" style={{ background: agent.color }}>
        <span className="orbit-dot" />
        {agent.initials}
      </span>
      <div>
        <div className="who">
          {agent.name} <span className="t">processing now</span>
        </div>
        <div className="thinking-card">
          <div className="thinking-orb" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="thinking-copy">
            <b>Thinking through the instruction</b>
            <span>Reading context, planning the next move, and preparing a response…</span>
          </div>
          <div className="thinking-steps" aria-hidden="true">
            <i />
            <i />
            <i />
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
                  {a.path} · {Math.round(a.sizeBytes / 1000)} KB
                </div>
              </div>
              <button className="dl">
                <Icon name="download" size={15} />
              </button>
            </div>
            {a.preview && <div className="prev">{a.preview}</div>}
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
            <CopyMessageButton text={m.text} label={isUser ? "your message" : "agent message"} />
          </span>
        </div>
        <ReplyQuote reply={m.replyTo} />
        {m.text && <div className="bubble">{m.text}</div>}
        <AttachmentList attachments={m.attachments} />
      </div>
    </div>
  );
}
