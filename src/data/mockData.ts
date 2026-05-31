import type { Agent, Approval } from "../types";

const now = "2025-09-09T10:00:00Z";

const soul = (name: string, role: string, traits: string) => `# ${name} — SOUL

You are ${name}, a ${role}.

## Voice
${traits}

## Boundaries
- You confirm before any destructive or external action (deleting files,
  sending messages, posting publicly, moving money).
- You don't pretend to be human.
- You hand off to the right squad-mate when a task is outside your remit.
`;

const memory = (facts: string) => `# MEMORY

## Working knowledge
${facts}

## Recently learned
- (updated automatically by the agent over time)
`;

const agentsMd = (rules: string) => `# AGENTS.md

## Project context
${rules}

## Conventions
- Write deliverables to ./workspace/
- Log every external action for the audit trail.
`;

const configYaml = `model: claude-opus-4-8
gateway:
  auto_resume: true
  cron: enabled
memory:
  enabled: true
secrets:
  provider: bitwarden   # values never rendered in the UI
`;

function files(name: string, role: string, traits: string, facts: string, rules: string) {
  return [
    { name: "SOUL.md", label: "identity · slot 1", kind: "soul" as const, content: soul(name, role, traits), sizeBytes: 480, updatedAt: now },
    { name: "MEMORY.md", label: "working knowledge", kind: "memory" as const, content: memory(facts), sizeBytes: 4200, updatedAt: now },
    { name: "AGENTS.md", label: "project rules", kind: "agents" as const, content: agentsMd(rules), sizeBytes: 610, updatedAt: now },
    { name: "config.yaml", label: "runtime · secrets", kind: "config" as const, content: configYaml, sizeBytes: 210, updatedAt: now },
  ];
}

export const seedAgents: Agent[] = [
  {
    id: "atlas",
    name: "Atlas",
    squad: "Operations",
    initials: "AT",
    color: "#0e8f84",
    model: "claude-opus-4-8",
    status: "working",
    activity: "Reconciling Q2 invoices vs bank stmt…",
    lastActive: "now",
    profilePath: "~/.hermes/atlas",
    uptime: "6h 12m",
    sessionCount: 41,
    insightSummary:
      "Double charges detected on Q2 invoices. Reconciliation complete; 3 mismatches isolated to the Stripe sync. Awaiting your approval to dispatch a refund to Finance.",
    insightStatus: "Awaiting approval",
    skills: [
      { id: "s1", name: "invoice-reconcile", category: "finance", source: "custom-repo" },
      { id: "s2", name: "xlsx-builder", category: "docs", source: "hub" },
      { id: "s3", name: "bank-sync", category: "finance", source: "hub" },
      { id: "s4", name: "email-summary", category: "comms", source: "hub" },
    ],
    files: files(
      "Atlas",
      "meticulous operations agent who owns reconciliation and back-office workflows",
      "Direct, numbers-first, never hand-wavy. You show your working.",
      "- Q2 close runs the 2nd week of each quarter.\n- Stripe → bank sync occasionally double-posts; always cross-check.",
      "Owns invoice reconciliation, vendor records, and ops reporting for the SME finance stack."
    ),
    messages: [
      { id: "m1", role: "user", text: "Reconcile the Q2 invoices against the bank statement and flag any mismatches.", at: "22m ago" },
      { id: "m2", role: "agent", text: "On it. I pulled 142 transactions for Q2 and matched them against the bank statement. Found 3 mismatches so far — writing the full reconciliation to your workspace now.", at: "22m ago" },
      { id: "m3", role: "agent", toolCall: { skill: "invoice-reconcile", status: "running", detail: "142 rows" }, at: "22m ago" },
      {
        id: "m4",
        role: "agent",
        at: "21m ago",
        artifact: {
          id: "a1",
          filename: "Q2_Reconciliation.xlsx",
          path: "workspace/atlas",
          mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          sizeBytes: 18000,
          preview: "INV-2043  $3,150  mismatch\nINV-2045  $2,400  mismatch\nINV-2051  $980  mismatch\n139 matched ✓",
          createdAt: now,
        },
      },
      { id: "m5", role: "agent", insight: "All 3 mismatches are duplicate charges from the Stripe → bank sync. Atlas suggests a refund task for Sol (Finance). Approve to dispatch.", at: "21m ago" },
    ],
    artifacts: [
      { id: "a1", filename: "Q2_Reconciliation.xlsx", path: "workspace/atlas", mime: "spreadsheet", sizeBytes: 18000, preview: "139 matched · 3 mismatches", createdAt: now },
      { id: "a2", filename: "notes.md", path: "workspace/atlas", mime: "text/markdown", sizeBytes: 1200, createdAt: now },
      { id: "a3", filename: "run-log.txt", path: "workspace/atlas", mime: "text/plain", sizeBytes: 3400, createdAt: now },
    ],
    tasks: [
      { id: "t1", title: "Q2 invoice reconciliation", status: "running", updatedAt: "22m ago" },
      { id: "t2", title: "Dispatch refund to Finance", status: "blocked", updatedAt: "21m ago" },
      { id: "t3", title: "Vendor record cleanup", status: "queued", updatedAt: "1h ago" },
    ],
  },
  {
    id: "mercury",
    name: "Mercury",
    squad: "Comms",
    initials: "ME",
    color: "#e8941b",
    model: "claude-opus-4-8",
    status: "waiting",
    activity: "Drafted reply to client — needs approval",
    lastActive: "2m",
    profilePath: "~/.hermes/mercury",
    uptime: "3h 04m",
    sessionCount: 18,
    insightSummary: "Drafted a reply to Sarah Mitchell about the double-charge. Tone matched to a frustrated-but-polite customer. Holding to send pending your approval.",
    insightStatus: "Awaiting approval",
    skills: [
      { id: "s5", name: "email-compose", category: "comms", source: "hub" },
      { id: "s6", name: "tone-matcher", category: "comms", source: "custom-repo" },
      { id: "s7", name: "crm-lookup", category: "ops", source: "hub" },
    ],
    files: files(
      "Mercury",
      "client communications agent who drafts and triages inbound messages",
      "Warm, concise, human. You never sound like a template.",
      "- Premium customers get a response within 1 business hour.",
      "Handles inbound email/chat triage and reply drafting. Never sends without approval."
    ),
    messages: [
      { id: "mm1", role: "user", text: "Sarah was double-charged. Draft a reply.", at: "5m ago" },
      { id: "mm2", role: "agent", text: "Draft ready. I confirmed the refund is already initiated and offered a receipt. Holding to send — approve in the Approvals queue.", at: "4m ago" },
    ],
    artifacts: [{ id: "ma1", filename: "reply-draft.md", path: "workspace/mercury", mime: "text/markdown", sizeBytes: 800, createdAt: now }],
    tasks: [{ id: "mt1", title: "Reply to Sarah Mitchell", status: "blocked", updatedAt: "4m ago" }],
  },
  {
    id: "iris",
    name: "Iris",
    squad: "Research",
    initials: "IR",
    color: "#3b6fe0",
    model: "claude-opus-4-8",
    status: "working",
    activity: "Scraping 12 competitor pages…",
    lastActive: "4m",
    profilePath: "~/.hermes/iris",
    uptime: "1h 47m",
    sessionCount: 9,
    insightSummary: "Crawling 12 competitor pricing pages. 8 done, building a comparison matrix.",
    insightStatus: "Running",
    skills: [
      { id: "s8", name: "web-scrape", category: "research", source: "hub" },
      { id: "s9", name: "compare-matrix", category: "research", source: "custom-repo" },
    ],
    files: files(
      "Iris",
      "research agent who gathers and structures competitive intelligence",
      "Skeptical, source-cites everything, flags low-confidence findings.",
      "- Always note the source URL and capture date for every data point.",
      "Owns market and competitor research. Outputs structured comparison tables."
    ),
    messages: [
      { id: "ii1", role: "user", text: "Pull competitor pricing for the SME tier.", at: "6m ago" },
      { id: "ii2", role: "agent", toolCall: { skill: "web-scrape", status: "running", detail: "8/12 pages" }, at: "4m ago" },
    ],
    artifacts: [],
    tasks: [{ id: "it1", title: "Competitor pricing scan", status: "running", updatedAt: "4m ago" }],
  },
  {
    id: "sol",
    name: "Sol",
    squad: "Finance",
    initials: "SO",
    color: "#7b8494",
    model: "claude-opus-4-8",
    status: "idle",
    activity: "Idle · next cron run 18:00",
    lastActive: "2h",
    profilePath: "~/.hermes/sol",
    uptime: "—",
    sessionCount: 27,
    insightSummary: "No active task. Scheduled daily cash-position report at 18:00.",
    insightStatus: "Idle",
    skills: [
      { id: "s10", name: "refund-dispatch", category: "finance", source: "custom-repo" },
      { id: "s11", name: "cash-report", category: "finance", source: "hub" },
    ],
    files: files(
      "Sol",
      "finance agent who handles refunds, reporting, and cash position",
      "Careful, compliance-minded. Double-confirms anything that moves money.",
      "- Refunds above $1,000 require a second human approval.",
      "Owns finance operations. All money movements are gated behind approvals."
    ),
    messages: [{ id: "so1", role: "system", text: "Daily cash-position report scheduled for 18:00.", at: "2h ago" }],
    artifacts: [{ id: "soa1", filename: "cash-position.xlsx", path: "workspace/sol", mime: "spreadsheet", sizeBytes: 9000, createdAt: now }],
    tasks: [{ id: "sot1", title: "Daily cash-position report", status: "queued", updatedAt: "2h ago" }],
  },
  {
    id: "echo",
    name: "Echo",
    squad: "Creative",
    initials: "EC",
    color: "#dc4040",
    model: "claude-opus-4-8",
    status: "error",
    activity: "Skill 'video-render' not installed",
    lastActive: "9m",
    profilePath: "~/.hermes/echo",
    uptime: "—",
    sessionCount: 12,
    insightSummary: "Task failed: the 'video-render' skill is referenced but not installed on this profile. Install it from the Skills Hub to retry.",
    insightStatus: "Error",
    skills: [{ id: "s12", name: "caption-writer", category: "content", source: "custom-repo" }],
    files: files(
      "Echo",
      "content agent who produces social copy and short-form video scripts",
      "Punchy, casual, hook-first. Never corporate.",
      "- Keep captions under 120 words.",
      "Owns short-form content. Renders video via the video-render skill (currently missing)."
    ),
    messages: [
      { id: "ec1", role: "user", text: "Turn the launch post into a reel.", at: "10m ago" },
      { id: "ec2", role: "system", text: "Error: skill 'video-render' not installed on profile echo.", at: "9m ago" },
    ],
    artifacts: [],
    tasks: [{ id: "ect1", title: "Launch reel", status: "error", updatedAt: "9m ago" }],
  },
  {
    id: "vega",
    name: "Vega",
    squad: "Creative",
    initials: "VE",
    color: "#9aa2b1",
    model: "claude-opus-4-8",
    status: "idle",
    activity: "Idle",
    lastActive: "1d",
    profilePath: "~/.hermes/vega",
    uptime: "—",
    sessionCount: 5,
    insightSummary: "No active task.",
    insightStatus: "Idle",
    skills: [{ id: "s13", name: "design-brief", category: "design", source: "custom-repo" }],
    files: files(
      "Vega",
      "design agent who turns briefs into layout and visual direction",
      "Aesthetic-led, opinionated about hierarchy and spacing.",
      "- Default to the Nexius dark-navy + teal system unless told otherwise.",
      "Owns visual direction and layout briefs."
    ),
    messages: [],
    artifacts: [],
    tasks: [],
  },
];

export const seedApprovals: Approval[] = [
  { id: "ap1", agentId: "mercury", agentName: "Mercury", kind: "Send email", detail: "Reply to sarah.mitchell@gmail.com about the double-charge refund.", createdAt: "4m ago" },
  { id: "ap2", agentId: "atlas", agentName: "Atlas", kind: "Dispatch refund", detail: "Hand off 3 duplicate charges ($6,530 total) to Sol for refund.", createdAt: "21m ago" },
];
