import type { Message } from "../types";

export const CHAT_SESSIONS_CHANGED_EVENT = "hmc:chat-sessions-changed";
const ACTIVE_CHAT_SESSIONS_KEY = "hmc:active-chat-sessions";

function readActiveSessions() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ACTIVE_CHAT_SESSIONS_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed as Record<string, string> : {};
  } catch {
    return {};
  }
}

export function activeChatSession(agentId: string) {
  return readActiveSessions()[agentId] || "";
}

export function rememberActiveChatSession(agentId: string, sessionId: string) {
  const current = readActiveSessions();
  current[agentId] = sessionId;
  window.localStorage.setItem(ACTIVE_CHAT_SESSIONS_KEY, JSON.stringify(current));
}

export function clearActiveChatSession(agentId: string) {
  const current = readActiveSessions();
  delete current[agentId];
  window.localStorage.setItem(ACTIVE_CHAT_SESSIONS_KEY, JSON.stringify(current));
}

export function provisionalConversationTitle(message: string, maxLength = 60) {
  const clean = message
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[`*_#>]+/g, " ")
    .replace(/https?:\/\/\S+/g, "link")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[-:;,.!?\s]+|[-:;,.!?\s]+$/g, "");
  if (!clean) return "New conversation";
  const firstSentence = clean.split(/(?<=[.!?])\s+/, 1)[0] || clean;
  const words = firstSentence.split(" ").slice(0, 10).join(" ");
  const shortened = words.length > maxLength ? `${words.slice(0, maxLength - 1).trim()}…` : words;
  return shortened.charAt(0).toUpperCase() + shortened.slice(1);
}

export function conversationFromMessages(messages: Message[], fallbackTitle: string) {
  const message = [...messages].reverse().find((item) => item.sessionId);
  if (!message?.sessionId) return null;
  return {
    sessionId: message.sessionId,
    title: message.sessionTitle || fallbackTitle,
  };
}

export function notifyChatSessionsChanged(sessionId?: string) {
  window.dispatchEvent(new CustomEvent(CHAT_SESSIONS_CHANGED_EVENT, { detail: { sessionId } }));
}
