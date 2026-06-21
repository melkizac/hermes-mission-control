import type { Agent } from "../types";

type AgentAvatarProps = {
  agent: Pick<Agent, "name" | "initials" | "color" | "avatarUrl">;
  className?: string;
  userLabel?: string;
  user?: boolean;
};

export function AgentAvatar({ agent, className = "av", user = false, userLabel = "M" }: AgentAvatarProps) {
  const avatarUrl = agent.avatarUrl?.startsWith("/api/attachments/agent-avatar-") ? agent.avatarUrl : "";
  if (user) {
    return <span className={className} style={{ background: "#1e2633" }}>{userLabel}</span>;
  }
  if (avatarUrl) {
    return <span className={`${className} has-image`} style={{ background: agent.color }}><img src={avatarUrl} alt="" /></span>;
  }
  return <span className={className} style={{ background: agent.color }}>{agent.initials}</span>;
}
