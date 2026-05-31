# Hermes Mission Control

A mission-control UI for orchestrating multiple [Hermes](https://hermes-agent.nousresearch.com)
(Nous Research) agents — view what every agent is doing, chat with any of them,
inspect their output, edit the files that make up each agent (SOUL.md, MEMORY.md,
AGENTS.md, config.yaml), manage their skills, and approve gated actions.

> In Hermes, **one agent = one profile** (an isolated `HERMES_HOME`).
> A **task** = a gateway session/job. **Output** = files in the agent's workspace.

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

That's it — the app runs against an in-memory mock (`MockHermesClient`), so you
can click around with no backend. `npm run build` produces a production bundle.

## What's implemented

- **Mission Control** — 3-pane layout (roster · chat/activity · context panel)
  - Live agent **roster** with status (working / waiting / idle / error), filters, squads
  - **Chat** with the selected agent; message types include tool-call chips,
    inline **output artifact** cards (Cowork-style), and AI-insight strips
  - **Context panel** tabs: **Output** (workspace artifacts), **Config**
    (agent info, **skills** add/remove, **config-file** editor), **Tasks**
  - **Create / delete** agents; **edit + save** any config file
- **Approvals** — working human-in-the-loop queue (approve / reject)
- Scaffolded placeholder screens: Task Board (Kanban), Skills Hub, Automations,
  Audit Log, Settings — each documented inline with what it becomes.

## Project layout

```
src/
  types.ts                 Domain types (Agent, Task, Skill, ConfigFile, …)
  data/mockData.ts         Seed data (6 agents, approvals)
  services/
    hermesClient.ts        ← THE integration interface (read this first)
    mockHermesClient.ts    In-memory implementation (default)
    store.tsx              React context wiring the client to the UI
  components/              NavRail, Roster, ChatThread, ContextPanel,
                           FileEditorDrawer, NewAgentModal, Icon
  views/                   MissionControl, Approvals, Placeholder
  styles/                  tokens.css + app.css
server/                    Optional Express bridge to a real Hermes install
```

## Going live

Everything the UI does flows through one interface: `src/services/hermesClient.ts`.
To connect a real Hermes install, implement that interface against the backend
in `server/` (start the bridge, then point an `HttpHermesClient` at it) and swap
the one line in `store.tsx`. See **INTEGRATION.md** for the full guide.

## Stack

Vite + React 18 + TypeScript (strict). Plain CSS with design tokens — no UI
framework, so it's easy to port to Tailwind/shadcn if you prefer. Zero runtime
dependencies beyond React.
