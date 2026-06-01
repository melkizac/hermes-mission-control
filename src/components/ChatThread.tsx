import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../services/store";
import { Icon } from "./Icon";
import type { Agent, Message } from "../types";
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
  return (m.role === "user" || m.role === "agent") && Boolean(m.text?.trim() || m.artifact || m.insight);
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

export function ChatThread({ agent, onOpenDetails }: { agent: Agent; onOpenDetails?: () => void }) {
  const { send, refreshSelected } = useStore();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [lastSeenKey, setLastSeenKey] = useState<string | null | undefined>(undefined);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const threadRef = useRef<HTMLDivElement | null>(null);
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
    const target = unreadStartIndex >= 0 && !pendingText ? unreadRef.current : bottomRef.current;
    window.requestAnimationFrame(() => {
      target?.scrollIntoView({ block: unreadStartIndex >= 0 && !pendingText ? "start" : "end" });
      updateJumpButton();
    });
  }, [agent.id, unreadStartIndex, sortedMessages.length, pendingText]);

  useEffect(() => {
    if (!latestMessageKey) return;
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(storageKey, latestMessageKey);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [latestMessageKey, storageKey]);

  const submit = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    setPendingText(text);
    setSending(true);
    setError(null);
    try {
      await send(text);
    } catch (err) {
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
        setError(message);
      }
    } finally {
      setPendingText(null);
      setSending(false);
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
            <MessageView m={m} agent={agent} />
          </div>
        ))}
        {pendingText && (
          <>
            <MessageView m={{ id: "pending-user", role: "user", text: pendingText, at: "just now" }} agent={agent} />
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
        <div className="cbox">
          <span className="plus">
            <Icon name="plus" size={18} />
          </span>
          <input
            placeholder={sending ? `Sending to ${agent.name}…` : `Send a task or message to ${agent.name}…`}
            value={draft}
            disabled={sending}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void submit();
              }
            }}
          />
          <button className="send" onClick={() => void submit()} disabled={sending || !draft.trim()}>
            {sending ? "…" : <Icon name="send" size={16} />}
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

function MessageView({ m, agent }: { m: Message; agent: Agent }) {
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
          <div className="who">
            {agent.name} <span className="t">{messageTimestampLabel(m)}</span>
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
            <b>Insight:</b> {m.insight}
          </div>
        </div>
      </div>
    );
  }

  if (m.role === "system") {
    return (
      <div style={{ marginLeft: 41, marginBottom: 16 }}>
        <div className="sysmsg">{m.text}</div>
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
        <div className="who">
          {isUser ? "You" : agent.name} <span className="t">{messageTimestampLabel(m)}</span>
        </div>
        <div className="bubble">{m.text}</div>
      </div>
    </div>
  );
}
