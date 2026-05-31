import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../services/store";
import { Icon } from "./Icon";
import type { Agent, Message } from "../types";

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

export function ChatThread({ agent, onOpenDetails }: { agent: Agent; onOpenDetails?: () => void }) {
  const { send } = useStore();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSeenKey, setLastSeenKey] = useState<string | null | undefined>(undefined);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const unreadRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const p = statusPill[agent.status];
  const storageKey = `hmc:last-seen-message:${agent.id}`;
  const readableMessages = useMemo(() => agent.messages.filter(isReadableMessage), [agent.messages]);
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

  useEffect(() => {
    const target = unreadStartIndex >= 0 ? unreadRef.current : bottomRef.current;
    window.requestAnimationFrame(() => {
      target?.scrollIntoView({ block: unreadStartIndex >= 0 ? "start" : "end" });
    });
  }, [agent.id, unreadStartIndex, agent.messages.length]);

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
    setSending(true);
    setError(null);
    try {
      await send(text);
    } catch (err) {
      setDraft(text);
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
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

      <div className="thread scroll" ref={threadRef}>
        <div className="divider">Unified Hermes chat history · Terminal + Telegram + Web UI</div>
        {agent.messages.length === 0 && (
          <div className="empty" style={{ marginTop: 30 }}>
            No messages yet. Send {agent.name} a task below.
          </div>
        )}
        {agent.messages.map((m) => (
          <div key={m.id}>
            {m.id === unreadStartId && (
              <div className="unread-divider" ref={unreadRef}>
                <span>Unread since your last visit</span>
              </div>
            )}
            <MessageView m={m} agent={agent} />
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

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
            {agent.name} <span className="t">{m.at}</span>
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
          {isUser ? "You" : agent.name} <span className="t">{m.at}</span>
        </div>
        <div className="bubble">{m.text}</div>
      </div>
    </div>
  );
}
