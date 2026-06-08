import type { CSSProperties } from "react";

type Name =
  | "logo"
  | "profile"
  | "logout"
  | "mission"
  | "chat"
  | "agents"
  | "projects"
  | "board"
  | "skills"
  | "memory"
  | "approvals"
  | "bell"
  | "automations"
  | "audit"
  | "costs"
  | "usage"
  | "settings"
  | "admin"
  | "dashboard"
  | "agentOrg"
  | "modelRouter"
  | "runtimes"
  | "secondBrain"
  | "setup"
  | "plus"
  | "refresh"
  | "search"
  | "send"
  | "download"
  | "edit"
  | "close"
  | "more"
  | "chevronDown"
  | "file"
  | "check"
  | "arrowDown"
  | "copy"
  | "reply"
  | "stop"
  | "mic"
  | "spinner";

const paths: Record<Name, string> = {
  logo: "M12 2l9 6-9 6-9-6 9-6zM3 14l9 6 9-6",
  profile: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0",
  logout: "M10 17l5-5-5-5M15 12H3M21 5v14a2 2 0 01-2 2h-6M13 3h6a2 2 0 012 2",
  mission: "M4 5h16v12H4zM8 21h8M12 17v4M8 9h3M14 9h3M8 13h8",
  chat: "M5 6.5A3.5 3.5 0 018.5 3h7A3.5 3.5 0 0119 6.5v4A3.5 3.5 0 0115.5 14H11l-4.2 3.4A.5.5 0 016 17v-3.2A3.5 3.5 0 015 10.5zM9 8h6M9 11h4",
  agents: "M9 11a4 4 0 118 0v2a4 4 0 11-8 0zM6 21a6 6 0 0112 0M7 8H5a3 3 0 00-3 3v1M19 8h-2a3 3 0 013 3v1",
  projects: "M3 7h7l2 2h9v10a2 2 0 01-2 2H5a2 2 0 01-2-2zM3 7V5a2 2 0 012-2h4l2 2h8a2 2 0 012 2v2",
  board: "M4 5h16M6 9h4v5H6zM14 9h4v9h-4zM6 18h4",
  skills: "M12 3l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.2 6.8 19l1-5.8L3.6 9.1l5.8-.8z",
  memory: "M8 4a3 3 0 00-3 3v1.2A3.8 3.8 0 003 12a3.8 3.8 0 002 3.4V17a3 3 0 003 3h1M16 4a3 3 0 013 3v1.2a3.8 3.8 0 012 3.8 3.8 3.8 0 01-2 3.4V17a3 3 0 01-3 3h-1M12 5v14M8 10h3M13 14h3",
  approvals: "M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  bell: "M18 8a6 6 0 10-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
  automations: "M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  audit: "M4 5h16M4 12h16M4 19h10",
  costs: "M12 3v18M17 7.5c0-1.9-1.8-3-5-3s-5 1.1-5 3 1.5 3 5 3 5 1.1 5 3-1.8 3-5 3-3.9-.4-5-2.1",
  usage: "M4 14a8 8 0 1116 0M12 14l4-4M8 18h8",
  settings: "M19.4 13a7 7 0 000-2l2-1.6-2-3.4-2.4 1a7 7 0 00-1.7-1L14.9 3h-4l-.4 2.4a7 7 0 00-1.7 1l-2.4-1-2 3.4L4.6 11a7 7 0 000 2l-2 1.6 2 3.4 2.4-1a7 7 0 001.7 1l.4 2.4h4l.4-2.4a7 7 0 001.7-1l2.4 1 2-3.4z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  admin: "M12 3l8 4v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V7zM12 8v6M12 17h.01",
  dashboard: "M4 4h7v7H4zM15 4h5v5h-5zM15 13h5v7h-5zM4 15h7v5H4z",
  agentOrg: "M12 5a3 3 0 110 6 3 3 0 010-6zM5 15a3 3 0 110 6 3 3 0 010-6zM19 15a3 3 0 110 6 3 3 0 010-6zM10 11l-4 4M14 11l4 4",
  modelRouter: "M6 4h12v6H6zM8 14h8M12 10v10M5 20h14M4 7H2M22 7h-2",
  runtimes: "M8 3v5M16 3v5M6 8h12v4a6 6 0 01-12 0zM12 18v3",
  secondBrain: "M9 4a3 3 0 00-3 3v1a3 3 0 00-2 5.2V14a4 4 0 004 4h1M15 4a3 3 0 013 3v1a3 3 0 012 5.2V14a4 4 0 01-4 4h-1M12 5v16M9 10h3M12 14h3",
  setup: "M14.7 6.3a4 4 0 00-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 005.4-5.4L15 12l-3-3z",
  plus: "M12 5v14M5 12h14",
  refresh: "M20 6v5h-5M4 18v-5h5M18.4 9A7 7 0 006.8 6.8L4 11M5.6 15a7 7 0 0011.6 2.2L20 13",
  search: "M21 21l-4.3-4.3M11 18a7 7 0 100-14 7 7 0 000 14z",
  send: "M12 19V5M5 12l7-7 7 7",
  download: "M12 3v12M7 11l5 5 5-5M5 21h14",
  edit: "M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z",
  close: "M18 6L6 18M6 6l12 12",
  more: "M12 6h.01M12 12h.01M12 18h.01",
  chevronDown: "M5 8l7 7 7-7",
  file: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6",
  check: "M20 6L9 17l-5-5",
  arrowDown: "M12 5v14M5 12l7 7 7-7",
  copy: "M8 8h10a2 2 0 012 2v10a2 2 0 01-2 2H8a2 2 0 01-2-2V10a2 2 0 012-2zM4 16H3a2 2 0 01-2-2V4a2 2 0 012-2h10a2 2 0 012 2v1",
  reply: "M10 7l-5 5 5 5M5 12h9a5 5 0 015 5v1",
  stop: "M7 7h10v10H7z",
  mic: "M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3zM5 11v1a7 7 0 0014 0v-1M12 19v3M8 22h8",
  spinner: "M12 2a10 10 0 019.5 7",
};

export function Icon({
  name,
  size = 18,
  className,
  style,
}: {
  name: Name;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
