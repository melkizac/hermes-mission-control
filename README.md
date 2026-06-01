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

## Detailed documentation

The current live implementation is documented in:

```text
docs/HERMES_MISSION_CONTROL.md
```

That document covers the product model, architecture, API routes, data sources, Agent Org V2, automations, approvals, Task Board, Skills Hub, Projects, Second Brain, Audit Log, Costs, deployment, verification, safety rules, and roadmap.

## What's implemented

- **Mission Control** — daily operator cockpit for attention, outputs, health, activity, and next actions.
- **Agents** — unified Hermes agent/channel chat surface with drawer-first details.
- **Agent Org / AI Workforce** — registry-backed operational control plane with 8 digital coworkers, queues, flows, runs, outputs, permissions, health, and safe actions.
- **Approvals / Inbox** — durable human-in-the-loop review queue with edit-before-approve and cron-output-derived items.
- **Task Board / Issues** — Kanban/list task queue backed by Hermes `kanban.db`.
- **Skills Hub** — searchable/routable library of installed Hermes skills.
- **Automations** — Hermes cron routines with schedule, status, run, pause/resume, outputs, and traces.
- **Projects / Workspaces** — context cockpit for workspaces, plans, knowledge, and activity.
- **Second Brain** — Karpathy-style LLM Wiki browser backed by `/root/.openclaw/workspace/kb`.
- **Audit Log** — session/run trace viewer backed by Hermes `state.db`.
- **Costs** — token/cost observability backed by Hermes session billing fields.

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
