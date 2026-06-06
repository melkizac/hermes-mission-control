import { useEffect, useMemo, useState } from "react";

type DocPage = {
  id: string;
  label: string;
  kicker: string;
  title: string;
  intro: string;
  sections: Array<{
    heading: string;
    body: string;
    bullets?: string[];
  }>;
  cards?: Array<{
    title: string;
    body: string;
  }>;
  example?: string;
  operatorNotes?: string[];
};

const pages: DocPage[] = [
  {
    id: "overview",
    label: "Overview",
    kicker: "Melverick_OS · Hermes Mission Control",
    title: "Operate your AI workforce from one control plane.",
    intro:
      "Hermes is the worker layer. Mission Control is the management, audit, and trust layer: the place where digital coworkers, delegated work, approvals, browser sessions, runtime readiness, evidence, costs, and second-brain context become visible and governable.",
    sections: [
      {
        heading: "Why Mission Control exists",
        body:
          "Chat alone is not enough once agents begin doing real work. A chat window hides ownership, status, proof, cost, runtime location, and handoff state. Mission Control turns scattered AI work into an operating system: work is assigned, tracked, supervised, approved, and archived with evidence.",
        bullets: [
          "Move from ‘I chat with an agent’ to ‘I operate a team of digital coworkers.’",
          "Make background work visible before it surprises the operator.",
          "Give every important output a source, owner, status, and proof trail.",
          "Keep human approval at leverage points instead of making every step manual.",
        ],
      },
      {
        heading: "The operator promise",
        body:
          "The main question Mission Control answers is simple: what is happening, what needs me, and what evidence proves the work is done? Every major page contributes to this loop. Delegate Work creates structured tasks. Task Board keeps execution visible. Approval Gates protect sensitive actions. Browser Activity shows live web work. Runtime Connectors explain where execution can safely run.",
      },
      {
        heading: "How to read this documentation",
        body:
          "Each section below is now its own page. Use the side navigation to jump directly to a topic, or use the Back and Next controls at the bottom to move through the operator journey in order. The content is written for practical use: what the section is for, when to use it, what to look for, and what good evidence looks like.",
      },
    ],
    cards: [
      { title: "Control", body: "Start, stop, delegate, approve, reject, and take over critical work from one surface." },
      { title: "Visibility", body: "See running tasks, browser sessions, action logs, evidence, screenshots, and runtime state." },
      { title: "Governance", body: "Require approval before external posts, sends, submits, purchases, destructive changes, or policy-sensitive work." },
      { title: "Proof", body: "Preserve artifacts, links, screenshots, API responses, task results, and audit traces." },
    ],
    example:
      "Morning use: open Mission Control, clear Needs Attention, inspect Running Now, review browser sessions, delegate one high-value outcome, then check task evidence before marking work complete.",
    operatorNotes: [
      "Use Mission Control as the operating cockpit, not as a replacement for every specialist page.",
      "If an agent cannot prove what it did, treat the task as incomplete.",
      "Sensitive external actions should be approval-gated even if the agent is confident.",
    ],
  },
  {
    id: "hermes-agent",
    label: "Hermes Agent",
    kicker: "Hermes Agent foundation",
    title: "Hermes Agent is the worker layer Mission Control supervises.",
    intro:
      "Mission Control is built around Hermes Agent by Nous Research: an autonomous, self-improving AI agent that can run in the terminal, messaging platforms, browser-capable runtimes, scheduled jobs, webhooks, MCP tools, plugins, and profile-isolated workers. Mission Control documents how those Hermes capabilities become visible, governable, and evidence-backed for operators.",
    sections: [
      {
        heading: "What Hermes Agent provides",
        body:
          "Hermes is not just a chat window. It is the execution layer that can use tools, remember stable context, load reusable skills, run from different providers and profiles, connect to messaging platforms, execute scheduled jobs, and coordinate durable multi-agent work. Mission Control sits above that layer to show status, ownership, approvals, evidence, runtime boundaries, and cost.",
        bullets: [
          "Self-improving skills: reusable procedures Hermes can create, load, improve, and apply across sessions.",
          "Persistent memory: stable user preferences and environment facts that reduce repeated steering.",
          "Provider-agnostic models: OpenRouter, Anthropic, OpenAI, Nous Portal, Gemini, DeepSeek, xAI, local/custom endpoints, and other OpenAI-compatible providers.",
          "Toolsets: terminal, file, browser, web, vision, image generation, text-to-speech, delegation, cron, messaging, MCP, and more depending on configuration.",
          "Profiles: isolated Hermes identities with their own config, sessions, memory, skills, plugins, and gateway behavior.",
          "Gateway: Telegram, Discord, Slack, WhatsApp, Signal, Matrix, Email, Teams, SMS, Mattermost, Home Assistant, Feishu, WeCom, DingTalk, webhooks, and API Server surfaces.",
        ],
      },
      {
        heading: "How Mission Control maps Hermes features",
        body:
          "Mission Control should not duplicate Hermes documentation line by line. Instead, it translates Hermes primitives into operator surfaces: Profiles become AI Workforce identities, skills become reusable know-how in Skills Hub, cron jobs become Routines, Kanban tasks become Task Board work, browser/tool calls become Browser Activity and Audit Log evidence, plugins/MCP become connectors and capabilities, and gateway sessions become multi-channel agent history.",
        bullets: [
          "Hermes Chat / Gateway → Chat, Agents, Telegram links, and session history.",
          "Hermes Skills → Skills Hub, workflow rules, and repeatable operating procedures.",
          "Hermes Cron → Routines, scheduled checks, recurring monitors, and delivery logs.",
          "Hermes Kanban → Task Board, multi-agent work queues, dependencies, worker runs, and verification stages.",
          "Hermes MCP / Plugins → Tools Hub, Plugins Hub, Runtime Connectors, and external capability readiness.",
          "Hermes Sessions / Audit → evidence, cost telemetry, source channels, run traces, and proof of work.",
        ],
      },
      {
        heading: "Key Hermes commands operators should recognize",
        body:
          "Most daily work should be driven through Mission Control or Melkizac chat, but these Hermes commands are useful reference points when diagnosing configuration, capabilities, or runtime behavior.",
        bullets: [
          "hermes setup — configure model, terminal, gateway, tools, and agent settings.",
          "hermes model — select or change the model/provider.",
          "hermes doctor — check dependencies and configuration health.",
          "hermes tools list — inspect enabled toolsets and availability.",
          "hermes skills list — inspect installed skills and reusable procedures.",
          "hermes plugins list — inspect bundled or installed plugins.",
          "hermes mcp list — inspect configured MCP servers and exposed tools.",
          "hermes cron list — inspect scheduled routines and recurring jobs.",
          "hermes kanban list / watch / runs / log — inspect durable task-board work and worker attempts.",
          "hermes gateway status — inspect messaging gateway health.",
          "hermes profile list — inspect isolated Hermes identities such as Melkizac and DevOps profiles.",
        ],
      },
      {
        heading: "When to use each Hermes work mode",
        body:
          "Different Hermes primitives serve different operating patterns. Mission Control should make the choice understandable without forcing non-technical users to choose raw infrastructure every time.",
        bullets: [
          "Normal chat: small, direct tasks or questions that do not need durable tracking.",
          "delegate_task: quick parallel subtasks inside the current session, useful for research fan-out or review/implementation splits.",
          "Kanban / Kanban Swarm: durable multi-agent projects, large migrations, verifier/synthesizer flows, and work that needs logs, ownership, retry, or resume.",
          "Cron / Routines: recurring checks, daily planners, monitors, reports, and scheduled deliveries.",
          "Webhooks: event-triggered work from external systems.",
          "MCP and plugins: external capabilities that should be connected, permissioned, and shown as tools/connectors in Mission Control.",
          "Profiles and worktrees: isolated agents or coding lanes when separate identity, tools, memory, or filesystem isolation matters.",
        ],
      },
      {
        heading: "Reference source",
        body:
          "The canonical Hermes Agent documentation remains the source of truth for installation, providers, toolsets, gateway setup, MCP, skills, plugins, cron, Kanban, profiles, slash commands, and developer extension details. Mission Control documentation should link to it and summarize only the operator-relevant parts needed to run Melverick_OS safely.",
        bullets: [
          "Official docs: https://hermes-agent.nousresearch.com/docs/",
          "Use Hermes docs for exact setup/configuration commands.",
          "Use Mission Control docs for operating model, governance, evidence, workflow, and UI behavior.",
        ],
      },
    ],
    cards: [
      { title: "Hermes = worker layer", body: "Executes with tools, skills, memory, models, profiles, gateways, cron, Kanban, plugins, and MCP." },
      { title: "Mission Control = governance layer", body: "Supervises work with task ownership, approvals, runtime readiness, browser visibility, evidence, cost, and audit trails." },
      { title: "Skills preserve know-how", body: "Reusable procedures turn one-off successful work into repeatable operating capability." },
      { title: "Kanban makes work durable", body: "Large multi-agent work belongs on the board when logs, retries, dependencies, or verification matter." },
    ],
    example:
      "Example mapping: a request to audit a website funnel can become a Hermes Kanban task, use browser/web/file tools, load a website-audit skill, pause behind approval before submit, publish Browser Activity events, and finish with Task Board evidence in Mission Control.",
    operatorNotes: [
      "Do not expose raw credentials, tokens, profile files, or private runtime data while documenting Hermes capabilities.",
      "If exact setup details change, link back to the official Hermes docs rather than copying stale command fragments into Mission Control.",
      "Mission Control should explain what a capability means operationally: who owns it, what it can do, what requires approval, and what evidence proves completion.",
    ],
  },
  {
    id: "glossary",
    label: "Glossary",
    kicker: "Mission Control terminology",
    title: "Mission Control terminology and relationship map.",
    intro:
      "These are the canonical words Mission Control should use when turning user intent into governed AI work. The goal is to keep chat, Projects, Task Board, Routines, Approval Gates, Evidence, and AI Workforce pages aligned around one shared operating model.",
    sections: [
      {
        heading: "Relationship map",
        body:
          "Use the simple operator map: Project = the folder / operating space, Goal = the desired result, Mission = the campaign or run to achieve the result, Task = the individual action, and Evidence = proof it happened. Melkizac owns the translation from plain user intent into this structure, then adds capability checks, approval gates, blockers, workflows, routines, and audit records where needed.",
        bullets: [
          "Project = the folder / operating space",
          "Goal = the desired result",
          "Mission = the campaign/run to achieve the result",
          "Task = the individual action",
          "Evidence = proof it happened",
          "Workflow = reusable process template",
          "Routine = scheduled or recurring execution",
          "Routine is the user-facing term; automation is the technical implementation",
          "Skill = reusable know-how; tool = execution capability",
          "Approval Gate = approve/reject checkpoint; human task = manual action",
          "Output = deliverable; evidence = proof that the work happened",
        ],
      },
      {
        heading: "Core work terms",
        body:
          "Intent is the raw user request in plain language. Project is the folder or operating space where the work belongs. Goal is the desired result. Mission is the campaign or execution run created to achieve that result. Task is the individual action assigned to an agent, human, or system routine. Evidence is the proof that the action or mission actually happened.",
        bullets: [
          "Intent: ‘I want more course signups.’",
          "Project: ‘Nexius Academy Course Growth.’",
          "Goal: ‘Increase qualified AI course signups.’",
          "Mission: ‘Run this month’s signup campaign.’",
          "Tasks: ‘Check funnel, draft posts, monitor leads, prepare follow-up.’",
          "Evidence: screenshots, drafts, lead records, and approval trail.",
        ],
      },
      {
        heading: "Repeatable work terms",
        body:
          "Workflow is a reusable process design for a type of work. Routine is scheduled or recurring Hermes work, such as a weekly monitor or daily planner. Automation is the internal technical mechanism behind a routine, such as cron, webhook, or background worker. Use Routine in operator-facing UI and reserve Automation for admin/technical contexts.",
        bullets: [
          "Workflow: Course signup growth loop.",
          "Routine: Run the course signup growth loop every Monday at 9am.",
          "Automation: The cron/webhook/background implementation that triggers the routine.",
        ],
      },
      {
        heading: "Capability terms",
        body:
          "Skill is reusable know-how: the proven method Hermes follows. Tool is an execution capability, such as browser, terminal, Telegram, GitHub, Supabase, or Google Workspace. Connector gives access to an external system or account. Runtime is where the work executes, such as Hermes server, browser runtime, cron scheduler, or desktop gateway.",
        bullets: [
          "Skill: Website funnel check.",
          "Tool: Browser.",
          "Connector: Browserbase, Google Workspace, Telegram, Supabase, or LinkedIn connector.",
          "Runtime: VPS, cron scheduler, browser runtime, external connector, or future desktop gateway.",
        ],
      },
      {
        heading: "Governance and proof terms",
        body:
          "Approval Gate is a human approve/reject checkpoint before sensitive external, destructive, costly, policy-sensitive, or authority-bound action. Blocker is something preventing progress. Output or Artifact is the deliverable Hermes produced. Evidence is proof of work. Audit Log is the deeper operational trace of what happened.",
        bullets: [
          "Approval Gate: approve a LinkedIn post before publishing.",
          "Blocker: LinkedIn access is unavailable or course date is missing.",
          "Output / Artifact: LinkedIn draft, funnel audit report, spreadsheet, or presentation.",
          "Evidence: screenshot, final URL, source links, API response, build output, or approval record.",
          "Audit Log: run trace, tool calls, timestamps, costs, approvals, errors, and retries.",
        ],
      },
      {
        heading: "People and execution terms",
        body:
          "Agent is an AI worker or logical role responsible for work. AI Workforce is the user-facing view of agents and responsibilities. Run is one execution instance of a mission, task, workflow, or routine. Non-technical users should not need to choose agents, tools, or runtimes; Melkizac should decide and make the design visible.",
        bullets: [
          "Agent: Melkizac, Content Ops, LinkedIn Growth, Nexius Leads, DevOps Builder, or Second Brain.",
          "AI Workforce: the business-facing map of who works on what.",
          "Run: one browser check, one scheduled routine execution, one research lane, or one workflow launch.",
        ],
      },
    ],
    cards: [
      { title: "Project vs Goal", body: "Project is the folder / operating space; Goal is the desired result." },
      { title: "Mission vs Task", body: "Mission is the campaign/run to achieve the result; Task is an individual action." },
      { title: "Workflow vs Routine", body: "Workflow is the reusable process; Routine is the scheduled recurring execution." },
      { title: "Output vs Evidence", body: "Output is the deliverable; Evidence proves the deliverable or action happened." },
    ],
    example:
      "Project: Nexius Academy Course Growth. Goal: Increase qualified AI course signups. Mission: Run this month’s signup campaign. Tasks: check funnel, draft posts, monitor leads, prepare follow-up. Evidence: screenshots, drafts, lead records, and approval trail. If this campaign repeats, Melkizac can turn the mission pattern into a Workflow and schedule it as a Routine.",
    operatorNotes: [
      "Use Routine in UI; automation may remain as an internal API/schema term.",
      "Do not mix Approval Gates with human tasks: approvals are approve/reject decisions; human tasks are manual actions.",
      "Every mission should define success criteria, approval boundaries, and evidence expectations before execution.",
    ],
  },
  {
    id: "revamp",
    label: "Revamp map",
    kicker: "Major revamp map",
    title: "Mission Control is now an operator platform, not just an agent chat.",
    intro:
      "The revamp adds the missing layers required for real autonomous work: delegation, structured results, packaged workflows, runtime readiness, browser visibility, and mobile/Telegram handoffs. The sequence matters because each layer depends on the previous one.",
    sections: [
      {
        heading: "Phase 1 · Delegate Work",
        body:
          "Delegate Work became the front door for structured agent work. Instead of typing into a blank chat, the operator can state an outcome, attach project context, choose an agent/runtime path, and create a task that is visible on the board from the start.",
        bullets: ["Outcome-first intake", "Project/workspace context", "Agent and runtime routing", "Task creation with clear evidence expectations"],
      },
      {
        heading: "Phase 2 · Evidence Results",
        body:
          "Task completion is no longer just a status label. Result drawers can show summaries, artifacts, evidence timelines, approval gates, next actions, and proof that work actually happened. This is the core trust layer.",
      },
      {
        heading: "Phase 3 · Workflow Library",
        body:
          "Recurring SME processes are packaged into launchable workflows. A workflow template describes steps, expected outputs, evidence requirements, approvals, and follow-up actions so repeatable business operations do not need to be reinvented each time.",
      },
      {
        heading: "Phase 4 · Runtime Readiness",
        body:
          "Runtime readiness makes execution locality explicit. Mission Control should show whether work is running on the VPS, an external runtime, a desktop gateway, or a future Windows-local connector. It must not imply access that has not been configured and verified.",
      },
      {
        heading: "Phase 5 · Browser operation visibility",
        body:
          "Browser work is a runtime capability. The current Browser Activity contracts and APIs expose domain, current URL, screenshot evidence, action logs, account-sensitive and approval indicators, runtime status, and final evidence fields without pretending Windows-local execution is configured.",
      },
      {
        heading: "Phase 6 · Mobile and Telegram handoff",
        body:
          "Mobile hardening makes Mission Control usable from Telegram and phone-sized screens. Deep links should open the exact task, approval, agent, or result context so the operator can act without hunting through navigation.",
      },
      {
        heading: "Phase 7 · Browser Activity operator surface",
        body:
          "Browser Activity is now a workspace-visible operator page with compact browser-session cards, drawer-first details, latest screenshot, action log, approval gate, final evidence, and Stop/Takeover controls.",
      },
      {
        heading: "Phase 8–10 · Mobile Operator and Research Runs",
        body:
          "Mobile Operator Mode, Research Runs visibility, and the Research Run creation bridge exist in source/tests. They are useful operator extensions that sit on top of the core operator surfaces.",
      },
      {
        heading: "Phase 11 · Browser Runtime Event Bridge",
        body:
          "Browser Activity can now ingest live browser/runtime events from connectors via /api/browser-sessions/events. Runtime-event sessions merge with the readiness fallback and expose live-event counts, domain/current URL, screenshot evidence, action logs, account-sensitive and approval-gated indicators, Stop/Takeover controls, and final evidence slots.",
      },
      {
        heading: "Phase 12 · Browser Runtime Producer Client",
        body:
          "Browser workers now have a reusable producer client in source/scripts/browser_runtime_producer.py. Browserbase, Playwright, desktop-browser agents, or Hermes browser wrappers can call session_started, navigated, screenshot_captured, before_external_action, final_evidence, failed, and poll_controls to publish real lifecycle events into Browser Activity.",
      },
      {
        heading: "Phase 13 · Safe Browser Funnel Check Probe",
        body:
          "A real Playwright no-submit website funnel probe now calls the producer. It opens a safe public page, captures a screenshot, detects forms and submit controls, emits final evidence, then stops at before_external_action('submit') so Browser Activity shows an approval-gated blocked session instead of allowing an unapproved form submission.",
      },
      {
        heading: "Phase 14 · Production Browser Funnel Check Job",
        body:
          "The no-submit probe now has a production-safe batch wrapper in source/scripts/browser_funnel_check_job.py. It loads JSON target configs, creates or updates Task Board items, runs the real browser check, attaches Browser Activity session/screenshot/final URL evidence to task results, keeps detected submit boundaries blocked for approval, and polls Stop/Takeover before and after browser execution.",
      },
      {
        heading: "Phase 15 · Website Funnel Check Workflow",
        body:
          "Workflow Library now exposes a Website Funnel Check packaged workflow. Operators can provide a targetUrl, launch a queued Task Board item with Phase 14 job config and command artifacts, keep NO_SUBMIT enforced, and review the approval gate before any real form submit.",
      },
      {
        heading: "Phase 16 · Scheduled Funnel Checks",
        body:
          "Website Funnel Check can prepare paused recurring routine bindings with a cron schedule, target config, latest funnel run status, evidence history, and mandatory NO_SUBMIT approval safeguards. Real routine enablement remains an operator decision after target/schedule review.",
      },
      {
        heading: "Phase 17 · Enable real scheduled funnel routines",
        body:
          "Routines can now explicitly enable an approved Website Funnel Check binding as a real Hermes cron job. The enable action requires operator approval, preserves NO_SUBMIT and safe-target metadata, delivers locally, and keeps Browser Activity/run-history evidence linked for audit.",
      },
      {
        heading: "Phase 18 · Configured target management + routine history UI",
        body:
          "Routines now includes a Website Funnel Check target registry. Operators can add approved safe public targets, see target approval/latest-run/evidence-history status, and use per-target Enable, Pause, or Run now controls while NO_SUBMIT and safeTargetRequired remain mandatory.",
      },
      {
        heading: "Phase 19 · Target evidence drill-down + production connector readiness",
        body:
          "Website Funnel Check targets now open an evidence detail drawer with latest screenshot, Browser Activity session link, Task result evidence link, final URL, approval history, and a production connector readiness checklist. Run-now remains a dry-run only / NO_SUBMIT action until a production connector is explicitly configured.",
      },
      {
        heading: "Phase 20 · Production connector configuration gate",
        body:
          "Routines now includes a production connector configuration gate for Browserbase, desktop-browser, and future Windows gateway connectors. The gate stores only redacted credentials, requires explicit operator approval and a dry-run connectivity test, keeps account-sensitive flows disabled, and does not enable any real connector before the checkpoint.",
      },
      {
        heading: "Phase 21 · Connector dry-run health probe",
        body:
          "The desktop-browser connector can now run a real safe public dry-run probe on the Mission Control Linux host using the existing Playwright no-submit funnel check. The probe navigates, captures screenshot/final URL evidence, publishes Browser Activity, records last-probe health, and stops before submit while the connector itself remains disabled.",
      },
      {
        heading: "Phase 22 · Browser Activity evidence drill-through",
        body:
          "Connector probes now drill through into Browser Activity with inline screenshot evidence, final URL/domain/status, and a visible external-action boundary so operators can review proof without leaving the runtime context.",
      },
      {
        heading: "Phase 23 · Probe history hygiene",
        body:
          "Routines keeps a probe history list for connector dry-runs and lets operators archive old probe evidence for hygiene while preserving audit records, screenshot paths, Browser Activity links, and disabled connector state.",
      },
      {
        heading: "Phase 24 · Production enablement policy",
        body:
          "The connector gate now surfaces an explicit production policy: supervised NO_SUBMIT dry-runs are allowed, but submit/post/send/purchase and account-sensitive autonomy remain blocked until a separate checkpoint.",
      },
      {
        heading: "Phase 25 · Browser runtime track completion and UX polish",
        body:
          "The browser-runtime track now has a completion checklist, operator next actions, clearer connector command-center hierarchy, improved mobile states, and evidence-first labels. The system is ready for supervised dry-runs; not ready for account-sensitive autonomy.",
      },
    ],
    example:
      "The revamp path is dependency-aware: first create work, then show evidence, then package repeatable work, then expose runtime boundaries, supervise browser sessions, make handoffs mobile-ready, bind safe browser checks into paused routines, explicitly enable approved routines, and finally manage approved targets/history before production connectors.",
    operatorNotes: [
      "Do not skip evidence and runtime readiness when adding new autonomous capabilities.",
      "A feature is only operator-ready when it has status, controls, and proof of work.",
      "Real Windows-local execution remains blocked until WINDOWS_HERMES_GATEWAY_URL, token, approved folders, and a successful probe are configured.",
      "Workflow-specific model compare is pending; the current Model Router is only an allow-list and route-planning surface.",
      "Future phases should preserve the same pattern: TDD, focused scope, deploy safely, then verify live behavior.",
    ],
  },
  {
    id: "daily-flow",
    label: "Daily flow",
    kicker: "Daily operating flow",
    title: "Use Mission Control as a morning cockpit and intervention console.",
    intro:
      "The daily flow is designed to prevent agent work from becoming invisible backlog. Start with attention and risk, then inspect active work, then delegate new outcomes only after current blockers and approvals are understood.",
    sections: [
      {
        heading: "1. Clear Needs Attention first",
        body:
          "Approval gates, blocked work, failed routines, API/auth warnings, and account-sensitive browser actions should be handled before adding more work. This keeps agents from piling up behind preventable human bottlenecks.",
        bullets: ["Approve or reject sensitive actions", "Resolve access and credential blockers", "Read high-risk browser or runtime warnings", "Convert vague blockers into concrete next actions"],
      },
      {
        heading: "2. Inspect Running Now",
        body:
          "Running work should be visible across the dashboard, Task Board, Agents, Agent Org, Routines, Runtime Connectors, and Browser Activity. Check whether work is progressing, waiting for approval, stuck on a tool, or using an unexpected runtime.",
      },
      {
        heading: "3. Delegate the next outcome",
        body:
          "Use Delegate Work when you have a business outcome but do not want to craft a full prompt. Use Workflow Library when the process is repeatable. The output should be a visible task, not an invisible chat promise.",
      },
      {
        heading: "4. Review proof of work",
        body:
          "A completed task should include evidence: screenshots, links, artifacts, API responses, build output, test results, audit traces, or next-action cards. If proof is missing, reopen or comment on the task instead of treating it as done.",
      },
      {
        heading: "5. Tune the system",
        body:
          "When a pattern repeats, convert it into a routine, packaged workflow, skill, connector rule, approval policy, or model-router rule. Mission Control should reduce future steering, not just manage today’s queue.",
      },
    ],
    example:
      "A good daily pass takes this shape: clear approvals → inspect running work → stop/takeover risky sessions → launch one or two high-value workflows → review evidence → update routines or skills if a workflow repeated.",
    operatorNotes: [
      "Task Board is for execution and blockers; Approval Gates are for explicit approve/reject decisions.",
      "Running browser sessions should be inspected before external forms, posts, sends, or purchases happen.",
      "Do not assign new work to an agent that is already blocked on missing access or unclear authority.",
    ],
  },
  {
    id: "delegate-work",
    label: "Delegate Work",
    kicker: "Delegate Work",
    title: "Give agents outcomes, context, constraints, and proof requirements.",
    intro:
      "Delegate Work is the front door for turning plain business instructions into structured work. It helps the operator avoid blank-chat prompting by collecting the outcome, context, target project, owner, risk, runtime expectations, and verification requirements before the task begins.",
    sections: [
      {
        heading: "When to use it",
        body:
          "Use Delegate Work when the outcome is clear but the execution path should be handled by an agent. It is ideal for audits, research, funnel checks, content preparation, task cleanup, documentation updates, code investigations, and operational checks that need evidence.",
        bullets: ["You want a visible task rather than a one-off chat", "The work belongs to a project or workspace", "Evidence or follow-up tasks will matter", "The agent may need to choose tools or route to another runtime"],
      },
      {
        heading: "What to include in a strong brief",
        body:
          "A good delegated task states the business outcome, relevant context, constraints, approval boundaries, and verification method. The agent should know what finished means before it starts. Avoid micromanaging clicks unless the clicks are the requirement.",
        bullets: ["Goal: the business result", "Context: relevant project, files, URLs, audience, or constraints", "Risk: what requires approval", "Verify by: screenshots, tests, links, API response, artifact, or evidence timeline"],
      },
      {
        heading: "How the result should appear",
        body:
          "After creation, the delegated work should appear on Task Board with an owner, status, evidence expectations, and a result drawer. If the task blocks, the board should show the blocker in operator language and provide a concrete next step.",
      },
      {
        heading: "Mobile usage",
        body:
          "On mobile, the Delegate Work form should remain easy to fill. Confirmation should include a direct task link so the operator can move from Telegram or phone browser straight into the task result or board drawer.",
      },
    ],
    cards: [
      { title: "Good prompt", body: "Audit the Nexius Academy lead intake flow. Verify lead form, tracking, confirmation message, and follow-up handoff. Provide screenshots/URLs and create follow-up tasks for each issue." },
      { title: "Weak prompt", body: "Check the website. This is too broad because the agent cannot tell what evidence, pages, or business outcome matter." },
    ],
    example:
      "Use Delegate Work for: ‘Research three ICP pain points from recent LinkedIn posts, draft practical content angles in my voice, and create approval-gated post tasks with evidence links.’",
    operatorNotes: [
      "Delegate Work should create visible work, not hidden chat state.",
      "Human-owned tasks should be concrete and ready to act, not vague approvals.",
      "If the same brief repeats, promote it into Workflow Library.",
    ],
  },
  {
    id: "workflow-library",
    label: "Workflow Library",
    kicker: "Workflow Library",
    title: "Launch repeatable SME workflows with built-in evidence and approvals.",
    intro:
      "Workflow Library packages recurring business operations into templates. A template should describe the trigger, inputs, steps, responsible agent, expected artifacts, approval gates, evidence requirements, and next actions.",
    sections: [
      {
        heading: "What makes a workflow different from a task",
        body:
          "A task is one piece of work. A workflow is a repeatable pattern that can generate tasks, artifacts, approvals, and follow-up actions. The library is where proven operator procedures become reusable business machinery.",
        bullets: ["Repeatable trigger or business situation", "Known steps and expected outputs", "Standard evidence requirements", "Known approval or risk points", "Reusable owner/agent routing"],
      },
      {
        heading: "Nexius Academy lead intake workflow",
        body:
          "This workflow is for checking lead capture quality, follow-up readiness, location/+65 verification, tracking gaps, and handoff blockers. It should produce evidence-backed findings and Task Board actions rather than a vague summary.",
      },
      {
        heading: "LinkedIn content operating loop",
        body:
          "This workflow separates Content Ops from LinkedIn Growth. Content Ops researches trends and drafts practical angles. LinkedIn Growth handles timing, approval rules, account-sensitive actions, and live execution boundaries. Approval gates protect publishing.",
      },
      {
        heading: "When to create a new workflow",
        body:
          "Create a workflow when you notice the same task pattern happening repeatedly: website funnel QA, lead triage, content research, course campaign checks, meeting follow-ups, blog publishing, ICP warming, or report generation.",
      },
    ],
    example:
      "Launch ‘LinkedIn content operating loop’ after trend research is needed. The workflow should generate draft artifacts, evidence links, approval gates, and next actions for publishing or engagement.",
    operatorNotes: [
      "A workflow should make repeated work safer and faster, not just create more cards.",
      "Every workflow should declare what evidence proves it completed correctly.",
      "External posting, sending, submitting, or purchasing steps should remain approval-gated.",
    ],
  },
  {
    id: "task-board",
    label: "Task Board",
    kicker: "Task Board",
    title: "Keep work visible, owned, and evidence-backed.",
    intro:
      "Task Board is the execution lane for queued, running, blocked, done, error, and human-owned work. It is where autonomous work becomes operationally visible rather than buried in chat transcripts.",
    sections: [
      {
        heading: "What belongs on the board",
        body:
          "Any work that has an owner, status, blocker, due action, or evidence trail belongs on the board. Agent-executable work should be assigned to agents or runtimes. Human-only work should be assigned to Melverick with exact instructions, links, expected result, and completion criteria.",
        bullets: ["Agent tasks", "Human-only access or decision tasks", "Blocked work", "Follow-up actions from completed results", "Workflow-generated steps", "Verification and audit tasks"],
      },
      {
        heading: "Structured result drawer",
        body:
          "A completed or active task can expose a result drawer with summary, artifacts, evidence timeline, approval gates, next actions, blockers, and verification outputs. This allows the operator to inspect proof without reading raw logs.",
      },
      {
        heading: "Blocked task handling",
        body:
          "Blocked tasks should explain the blocker in normal operator language: what is missing, who owns the next action, what link or credential is needed, and how the agent should resume afterward. Avoid raw JSON or vague ‘blocked’ labels.",
      },
      {
        heading: "Search and deep links",
        body:
          "Task IDs, result text, comments, blockers, and owners should be searchable. Telegram or mobile links such as /app?view=board&task=<task_id> should open the relevant task drawer directly.",
      },
    ],
    example:
      "If an agent says ‘I need access to the campaign dashboard’, create or update a Melverick-owned Task Board card with the exact URL, needed permission, what to click, and what to report when done.",
    operatorNotes: [
      "Use the board for work; use approvals only for explicit approve/reject gates.",
      "A done task without evidence is only a claim.",
      "Human cards should be ready-to-act from the card body, not require another conversation.",
    ],
  },
  {
    id: "approvals",
    label: "Approval Gates",
    kicker: "Needs Attention / Approval Gates",
    title: "Protect high-leverage actions without slowing the whole system.",
    intro:
      "Approval Gates are the human-in-the-loop safety layer. They should appear when an agent is about to perform an external-facing, irreversible, costly, policy-sensitive, authority-bound, or account-sensitive action.",
    sections: [
      {
        heading: "What requires approval",
        body:
          "The approval queue should catch moments where the cost of being wrong is high. Examples include LinkedIn posts/comments, outbound emails, client-facing messages, form submissions, purchases, destructive file/database actions, production deploys, or actions under a user/account identity.",
        bullets: ["Post", "Send", "Submit", "Purchase", "Delete", "Deploy", "Change permissions", "Use account-sensitive browser context"],
      },
      {
        heading: "What does not belong in approvals",
        body:
          "Do not overload approvals with ordinary manual work. If the human needs to grant access, answer a question, provide missing context, or do a manual step, that belongs on Task Board / Needs Attention as a human-owned action, not an approve/reject gate.",
      },
      {
        heading: "What an approval card should show",
        body:
          "A good approval card contains the proposed action, destination/account, risk level, source context, generated content or change summary, evidence preview, and clear Approve / Reject / Edit controls. For browser work, include the latest screenshot and action log context.",
      },
      {
        heading: "Approval outcomes",
        body:
          "Approving should let the agent continue exactly one gated action. Rejecting should preserve the reason and send the agent back with a concrete correction. Editing should change the artifact or outbound text before approval.",
      },
    ],
    example:
      "LinkedIn example: approve only after checking target account, post/comment text, screenshot preview, and whether the agent is about to publish from the correct profile.",
    operatorNotes: [
      "Approval Gates are for leverage points, not every minor step.",
      "Reject with a reason so the agent can learn the correction path.",
      "External browser actions should surface approval-required indicators before execution.",
    ],
  },
  {
    id: "agents",
    label: "Agents & Agent Org",
    kicker: "Agents & Agent Org",
    title: "Talk to agents, then manage them as a workforce.",
    intro:
      "The Agents page is for direct instruction and profile-backed chat. Agent Org is the workforce map: goals, queues, permissions, health, outputs, collaboration flows, and safe actions. Together they turn individual chats into an accountable operating model.",
    sections: [
      {
        heading: "My Agents",
        body:
          "Use My Agents for direct agent communication: ask questions, attach files, give instructions, stop a problematic run, or request verified output. The chat surface should show meaningful user/assistant history while keeping raw tool traces in audit views.",
        bullets: ["Choose the right profile-backed agent", "Use project/session scope when relevant", "Attach files when the agent needs source material", "Stop runs that are wrong, stale, or risky", "Ask for evidence before accepting completion"],
      },
      {
        heading: "Agent Org",
        body:
          "Agent Org shows digital coworkers as an operating system: goals, queues, permissions, active runs, outputs, health, and handoffs. Logical agents such as Content Ops, LinkedIn Growth, Nexius Leads, and Second Brain can collaborate while Melkizac remains the chief operator/control-plane agent.",
      },
      {
        heading: "Agent-owned by default",
        body:
          "New goals should default to agent-owned execution. Agents should choose strategy, steps, monitoring, verification, and fallback handling when they have enough context. Melverick should receive only human-only tasks: authority, access, credentials, real-world decisions, or missing business context.",
      },
      {
        heading: "Work vs personal domains",
        body:
          "Mission Control should separate work agents from personal finance/trading/net-worth agents. Cross-domain reads or actions should be explicit and approval-gated so business workflows do not accidentally mix with personal-sensitive context.",
      },
    ],
    example:
      "Good agent instruction: ‘Goal: increase Nexius Academy qualified lead capture this week. Context: SkillsFuture course page and lead table. Constraints: no live messages without approval. Verify by: lead_capture deltas, screenshots, and Task Board follow-ups.’",
    operatorNotes: [
      "Do not split Terminal, Telegram, and Web UI into fake agents; they are channels unless a true separate profile/runtime exists.",
      "Show agent capabilities and permissions from real config, not guessed labels.",
      "Use Agent Org when managing goals and queues; use Agent chat when giving a direct instruction.",
    ],
  },
  {
    id: "browser-activity",
    label: "Browser Activity",
    kicker: "Browser Activity",
    title: "Supervise agent browsing with screenshots, logs, risk labels, and takeover controls.",
    intro:
      "Browser Activity is the visibility layer for web-based agent work. It matters whenever an agent is using a browser for LinkedIn, funnel QA, form checks, lead capture checks, client research, website testing, or Browserbase-style sessions.",
    sections: [
      {
        heading: "What Mission Control should show",
        body:
          "A browser session should expose the current domain, current URL, screenshot preview, browser status, action log, account-sensitive indicator, approval-required marker, and final screenshot/link evidence. The operator should understand where the agent is and what it is about to do without taking over every click.",
        bullets: ["Current domain/site", "Current URL", "Screenshot preview", "Action log", "Session status", "Account-sensitive marker", "Approval-required marker", "Final screenshot/link evidence"],
      },
      {
        heading: "Why account sensitivity matters",
        body:
          "Some websites act under a real identity: LinkedIn, email, payment portals, CRMs, customer admin panels, and lead systems. Browser Activity should flag account-sensitive sessions so the operator knows the risk is not just technical; it can affect brand, client, money, or customer data.",
      },
      {
        heading: "Approval before submit/post/send/purchase",
        body:
          "Before external actions such as submit, post, send, purchase, or account changes, the browser session should pause behind an approval gate. The approval should include the screenshot, destination, action text, and recent action log so the operator can make a fast decision.",
      },
      {
        heading: "Stop and takeover controls",
        body:
          "If the agent appears to be on the wrong account, wrong page, or wrong action path, the operator needs immediate controls: stop the session, prepare takeover, jump to the related task, or add an instruction. These controls should work on mobile as well as desktop.",
      },
      {
        heading: "Final evidence",
        body:
          "When the browser task completes, the task result should preserve final evidence: screenshot, final URL, submitted form confirmation, published link, or captured error state. This evidence is what makes browser automation auditable instead of magical.",
      },
    ],
    example:
      "LinkedIn example: when an agent reaches a comment or post action, inspect the screenshot, check the account-sensitive flag, read the proposed text, then approve only if the target profile and content are correct.",
    operatorNotes: [
      "Browser work is a runtime capability and should come after Runtime Readiness.",
      "Never allow silent submit/post/send/purchase actions on account-sensitive sessions.",
      "If final screenshot or link evidence is missing, the browser task is not fully proven.",
    ],
  },
  {
    id: "runtime",
    label: "Runtimes",
    kicker: "Runtimes, connectors, and desktop gateway",
    title: "Know where work can safely run before assigning it.",
    intro:
      "Runtime readiness explains execution locality: whether a task can run on the VPS, a registered connector, a desktop gateway, a browser runtime, or a future Windows-local environment. The UI must make boundaries explicit and avoid overstating access.",
    sections: [
      {
        heading: "Runtime Connectors",
        body:
          "Runtime Connectors should show registered targets, connector tokens, heartbeat status, recent events, readiness, and what each runtime is allowed to do. Operators need to know whether a worker is connected, stale, degraded, or unavailable before routing work there.",
        bullets: ["Target name and type", "Heartbeat age", "Last event", "Allowed capabilities", "Approval boundaries", "Readiness warnings"],
      },
      {
        heading: "Desktop Gateway",
        body:
          "Desktop Gateway is the readiness surface for local/desktop execution. It should show whether remote/VPS execution is ready, whether Windows-local execution is configured, which folders are approved, and what approval boundaries exist.",
      },
      {
        heading: "Windows-local boundary",
        body:
          "Windows-local execution must remain visibly not connected until a real reachable WINDOWS_HERMES_GATEWAY_URL, token, approved Windows folders, and successful connection probe are provided. Demo readiness is not proof of access to the user’s PC.",
      },
      {
        heading: "Routing decisions",
        body:
          "Agents should route work based on capability and trust boundary: server-safe tasks on VPS, browser tasks through browser runtimes, account-sensitive actions with approvals, and local file/desktop actions only when an approved local gateway exists.",
      },
    ],
    example:
      "Before assigning a local-file automation, check Desktop Gateway readiness. If Windows-local is not connected, create a human setup task or route to a safe VPS-compatible alternative.",
    operatorNotes: [
      "Do not imply Mission Control has PC access until it is actually configured and probed.",
      "Runtime status should come from real probes and heartbeats, not static text.",
      "Browser Activity should reference runtime state when a browser session is live.",
    ],
  },
  {
    id: "knowledge",
    label: "Knowledge & Evidence",
    kicker: "Knowledge, evidence, audit, and costs",
    title: "Use evidence, not vibes, to operate agents.",
    intro:
      "The knowledge and evidence layer gives agents context and gives operators confidence. It includes the second brain, project knowledge, skills, audit logs, artifacts, session traces, model/cost telemetry, and proof-of-work records.",
    sections: [
      {
        heading: "Second Brain and project context",
        body:
          "Knowledge surfaces should expose the second-brain wiki, project notes, workflows, reference docs, and source material that agents can use. Good context reduces repeated prompting and keeps agent decisions aligned with business reality.",
        bullets: ["Project briefs", "Wiki topics", "Workflow rules", "Reference documents", "Meeting or transcript outputs", "Known constraints and preferences"],
      },
      {
        heading: "Evidence records",
        body:
          "Evidence records should answer what happened, when, where, by whom, and with what proof. For code work, proof may be tests and builds. For browser work, proof may be screenshots and final URLs. For research, proof may be links, excerpts, and synthesis artifacts.",
      },
      {
        heading: "Audit Log",
        body:
          "Audit Log should expose sessions, source channels, timestamps, tool traces, outputs, errors, retries, token usage, and cost where available. The operator should be able to inspect a run without needing to read raw databases or terminal logs.",
      },
      {
        heading: "Skills and model routing",
        body:
          "Skills are reusable procedures, not random prompt snippets. Model routing should reserve frontier models for strategy, planning, complex reasoning, code review, and high-risk decisions while routing simpler work to cheaper options when safe.",
      },
    ],
    example:
      "For an SGQR/PayNow integration task, the agent should use the stored SGQR topic, produce code/test evidence, link changed files, and preserve verification output in the task result.",
    operatorNotes: [
      "If a source, artifact, or run trace is missing, ask the agent to produce one before accepting the result.",
      "Costs should support routing decisions, not just vanity reporting.",
      "Skills should be updated when a new reusable workflow is discovered.",
    ],
  },
  {
    id: "telegram",
    label: "Telegram links",
    kicker: "Mobile and Telegram handoff",
    title: "Deep links should open the exact Mission Control context that needs action.",
    intro:
      "Telegram is where operators often receive alerts. Mission Control links should not merely open the dashboard; they should open the relevant task, result, approval, agent, or browser context so the operator can act immediately from mobile.",
    sections: [
      {
        heading: "What every alert should contain",
        body:
          "A good Telegram/operator alert includes a short title, risk/status, owner or agent, direct Mission Control link, and exact completion instruction. The human should know what decision is needed before opening the link.",
        bullets: ["Short title", "Risk/status", "Owner/agent", "Direct Mission Control URL", "Exact action instruction", "Deadline or urgency if relevant"],
      },
      {
        heading: "Supported deep-link shapes",
        body:
          "Deep links should open the correct route and drawer automatically. Examples include /app?view=board&task=<task_id>, /app?view=task-result&task=<task_id>, /app?view=approvals&approval=<approval_id>, /app?view=agents&agent=<agent_id>, and /app?view=browser-ops.",
      },
      {
        heading: "Mobile operator expectations",
        body:
          "On a phone, the linked context should be reachable without desktop-only controls. Drawers should fit the viewport, bottom navigation should not cover composer/action buttons, and quick interventions such as stop, approve, reject, comment, or open result should remain tappable.",
      },
      {
        heading: "When to send an alert",
        body:
          "Send Telegram alerts for approval gates, stuck blockers, high-risk browser sessions, completed high-value artifacts, failed routines, or human-owned tasks that bottleneck a goal. Avoid noisy alerts for routine success that requires no action.",
      },
    ],
    example:
      "Example alert: ‘Needs approval: LinkedIn comment draft. Risk: account-sensitive external post. Owner: LinkedIn Growth. Open: /app?view=approvals&approval=<id>. Action: review, edit if needed, then approve or reject.’",
    operatorNotes: [
      "A link that only opens the dashboard is incomplete for urgent work.",
      "Mobile deep links should open drawers/cards automatically.",
      "Alert text should include the exact action, not just ‘please review.’",
    ],
  },
  {
    id: "examples",
    label: "Examples",
    kicker: "Examples",
    title: "Common operator workflows and how to run them.",
    intro:
      "These examples show how the Mission Control pieces work together. The key pattern is always the same: define the outcome, assign visible work, supervise risk, approve sensitive actions, and verify evidence.",
    sections: [
      {
        heading: "LinkedIn content operating loop",
        body:
          "Start from Workflow Library or Delegate Work. Content Ops researches trends and drafts practical, operator-led angles. LinkedIn Growth handles timing, account-sensitive rules, comments, posting approvals, and engagement windows. Browser Activity should be used if live LinkedIn browsing is involved.",
        bullets: ["Trend research evidence", "Draft artifact", "Approval gate before post/comment", "Browser screenshot if live account is used", "Task result with final link or scheduled proof"],
      },
      {
        heading: "Website funnel testing",
        body:
          "Delegate a funnel audit with target URLs, expected conversion path, and proof requirements. Browser Activity should capture page URLs, screenshots, action log, form behavior, and confirmation states. Task Board should receive follow-up tasks for each issue.",
      },
      {
        heading: "Lead capture checks",
        body:
          "For Nexius lead ops, verify new lead_capture entries, required +65/location fields for physical SG classes, form confirmation, routing, and follow-up readiness. Evidence should include screenshots, relevant URLs, and safe summaries rather than raw sensitive data.",
      },
      {
        heading: "Client research",
        body:
          "Use Delegate Work for scoped research: company, ICP, problem area, deliverable format, and source requirements. Browser Activity helps supervise live browsing. Final evidence should include source links, dated notes, and a concise recommendation artifact.",
      },
      {
        heading: "Documentation update",
        body:
          "Ask an agent to update docs only after clarifying audience, page structure, source of truth, and verification method. Good completion proof includes changed files, build output, deployed URL, and browser verification with no console errors.",
      },
    ],
    example:
      "A complete workflow chain: Telegram alert → deep-linked approval → browser screenshot review → approve gated action → final task evidence → follow-up Task Board item for unresolved issue.",
    operatorNotes: [
      "The same operator grammar should work across LinkedIn, websites, lead ops, client research, and docs.",
      "Every example should end with evidence or a human-ready next action.",
      "When an example repeats often, turn it into a packaged workflow.",
    ],
  },
  {
    id: "safety",
    label: "Safety",
    kicker: "Safety and operating rules",
    title: "Trust comes from boundaries, approvals, and evidence.",
    intro:
      "Mission Control should make agents more capable without making them invisible or unbounded. The safety model is practical: clear authority, explicit runtimes, approval gates for risky actions, and evidence for completed work.",
    sections: [
      {
        heading: "Core rules",
        body:
          "Agents can research, draft, summarize, inspect, test, and prepare actions autonomously. They should not silently perform external-facing, destructive, costly, account-sensitive, or authority-bound actions without the right approval or configured permission.",
        bullets: ["Approval before submit/post/send/purchase", "No hidden destructive changes", "No implied Windows-local access", "No secrets in logs or docs", "Evidence required before completion"],
      },
      {
        heading: "Credential and data handling",
        body:
          "Credentials, tokens, API keys, passwords, connection strings, and raw sensitive financial/customer data should not be printed into docs or operator summaries. Store secrets securely and verify with safe checks without exposing the secret value.",
      },
      {
        heading: "Human tasks vs approvals",
        body:
          "Use approvals for decisions where the agent is ready to act but needs permission. Use Task Board for human-only work such as granting access, deciding strategy when context is missing, providing business authority, or completing a manual external step.",
      },
      {
        heading: "Evidence standard",
        body:
          "Good evidence is concrete and reproducible: build output, test result, API status, screenshot, final URL, changed file path, audit trace, source link, or artifact. A narrative summary is useful, but it should not replace proof.",
      },
      {
        heading: "Escalation",
        body:
          "If an agent is stuck, risky, or operating under uncertainty, Mission Control should surface the blocker with an actionable handoff: what is wrong, who owns it, what to do, where to click, and how to report completion.",
      },
    ],
    example:
      "Safe browser rule: the agent may navigate and prepare a draft, but before clicking Post/Submit/Send/Purchase it must pause, show screenshot/action-log context, and wait for approval.",
    operatorNotes: [
      "Trust is not built by hiding risk; it is built by making risk visible and controllable.",
      "Autonomy should increase throughput while preserving operator authority.",
      "If proof cannot be produced, the system should say so directly and create a next action.",
    ],
  },
];

export function MissionControlDocs() {
  const initialIndex = useMemo(() => {
    if (typeof window === "undefined") return 0;
    const hash = window.location.hash.replace("#", "");
    const found = pages.findIndex((page) => page.id === hash);
    return found >= 0 ? found : 0;
  }, []);

  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const activePage = pages[activeIndex];
  const previousPage = activeIndex > 0 ? pages[activeIndex - 1] : null;
  const nextPage = activeIndex < pages.length - 1 ? pages[activeIndex + 1] : null;

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      const found = pages.findIndex((page) => page.id === hash);
      if (found >= 0) setActiveIndex(found);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const goToPage = (index: number) => {
    const bounded = Math.max(0, Math.min(index, pages.length - 1));
    setActiveIndex(bounded);
    window.history.pushState(null, "", `#${pages[bounded].id}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="docs-page">
      <aside className="docs-sidebar">
        <a className="docs-brand" href="/">
          <span>MC</span>
          <b>Mission Control Docs</b>
        </a>
        <nav aria-label="Mission Control documentation pages">
          {pages.map((page, index) => (
            <button
              key={page.id}
              type="button"
              className={activeIndex === index ? "active" : undefined}
              aria-current={activeIndex === index ? "page" : undefined}
              onClick={() => goToPage(index)}
            >
              {page.label}
            </button>
          ))}
        </nav>
        <a className="docs-open-app" href="/app">
          Open Mission Control →
        </a>
      </aside>

      <main className="docs-main" id={activePage.id}>
        <article className="docs-page-card" aria-labelledby={`${activePage.id}-title`}>
          <p className="docs-kicker">{activePage.kicker}</p>
          <div className="docs-page-heading">
            <div>
              <p className="docs-page-count">Page {activeIndex + 1} of {pages.length}</p>
              <h1 id={`${activePage.id}-title`}>{activePage.title}</h1>
              <p className="docs-lede">{activePage.intro}</p>
            </div>
            <div className="docs-hero-card docs-page-loop">
              <span>Operator loop</span>
              <ol>
                <li>Understand the context</li>
                <li>Choose the right control</li>
                <li>Check risk and ownership</li>
                <li>Act or approve</li>
                <li>Verify evidence</li>
              </ol>
            </div>
          </div>

          <div className="docs-content-stack">
            {activePage.sections.map((section) => (
              <section className="docs-section-block" key={section.heading}>
                <h2>{section.heading}</h2>
                <p>{section.body}</p>
                {section.bullets ? (
                  <ul className="docs-list">
                    {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>

          {activePage.cards ? (
            <div className="docs-grid two docs-card-grid">
              {activePage.cards.map((card) => (
                <div className="docs-card" key={card.title}>
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                </div>
              ))}
            </div>
          ) : null}

          {activePage.example ? (
            <div className="docs-callout">
              <b>Example:</b> {activePage.example}
            </div>
          ) : null}

          {activePage.operatorNotes?.length ? (
            <section className="docs-section-block docs-operator-notes">
              <h2>Operator notes</h2>
              <ul className="docs-list strong">
                {activePage.operatorNotes.map((note) => <li key={note}>{note}</li>)}
              </ul>
            </section>
          ) : null}

          <nav className="docs-page-nav" aria-label="Documentation page navigation">
            <button type="button" onClick={() => goToPage(activeIndex - 1)} disabled={!previousPage}>
              <span>← Back</span>
              <b>{previousPage ? previousPage.label : "Start"}</b>
            </button>
            <a href="/app">Open Mission Control</a>
            <button type="button" onClick={() => goToPage(activeIndex + 1)} disabled={!nextPage}>
              <span>Next →</span>
              <b>{nextPage ? nextPage.label : "End"}</b>
            </button>
          </nav>
        </article>
      </main>
    </div>
  );
}
