import type { CSSProperties } from "react";

type Name =
  | "logo"
  | "mission"
  | "projects"
  | "board"
  | "skills"
  | "approvals"
  | "automations"
  | "audit"
  | "costs"
  | "settings"
  | "plus"
  | "search"
  | "send"
  | "download"
  | "edit"
  | "close"
  | "more"
  | "file"
  | "check"
  | "spinner";

const paths: Record<Name, string> = {
  logo: "M12 2l9 6-9 6-9-6 9-6zM3 14l9 6 9-6",
  mission: "M3 4h18v16H3zM3 9h18M8 4v16",
  projects: "M3 7h7l2 2h9v10a2 2 0 01-2 2H5a2 2 0 01-2-2zM3 7V5a2 2 0 012-2h4l2 2h8a2 2 0 012 2v2",
  board: "M4 4h4v16H4zM10 4h4v11h-4zM16 4h4v14h-4z",
  skills: "M12 3l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.2 6.8 19l1-5.8L3.6 9.1l5.8-.8z",
  approvals: "M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  automations: "M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  audit: "M4 5h16M4 12h16M4 19h10",
  costs: "M12 3v18M17 7.5c0-1.9-1.8-3-5-3s-5 1.1-5 3 1.5 3 5 3 5 1.1 5 3-1.8 3-5 3-3.9-.4-5-2.1",
  settings: "M19.4 13a7 7 0 000-2l2-1.6-2-3.4-2.4 1a7 7 0 00-1.7-1L14.9 3h-4l-.4 2.4a7 7 0 00-1.7 1l-2.4-1-2 3.4L4.6 11a7 7 0 000 2l-2 1.6 2 3.4 2.4-1a7 7 0 001.7 1l.4 2.4h4l.4-2.4a7 7 0 001.7-1l2.4 1 2-3.4z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  plus: "M12 5v14M5 12h14",
  search: "M21 21l-4.3-4.3M11 18a7 7 0 100-14 7 7 0 000 14z",
  send: "M12 19V5M5 12l7-7 7 7",
  download: "M12 3v12M7 11l5 5 5-5M5 21h14",
  edit: "M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z",
  close: "M18 6L6 18M6 6l12 12",
  more: "M12 6h.01M12 12h.01M12 18h.01",
  file: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6",
  check: "M20 6L9 17l-5-5",
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
