# AI Workforce Loop Operating Model

Status: canonical operating model  
Created: 2026-06-12  
Owner: Melverick Ng  
Primary orchestrator: Melkizac / default Hermes agent  
KB mirror: `/root/.hermes/workspace/kb/wiki/topics/ai-workforce-loop-operating-model.md`

## Purpose

This document codifies loop engineering as the standard operating model for Melverick's AI workforce and Hermes Mission Control (HMC). Digital coworkers should not behave like one-shot chatbots. They should operate as governed feedback loops with tools, evidence, termination logic, and human approval boundaries.

## Standard loop

```text
Goal → Plan / Route → Act → Observe → Adjust → Verify → Report / Escalate
```

## 1. Goal

Every non-trivial task needs a clear target before execution:

- desired outcome;
- owner/profile;
- scope and non-goals;
- success condition;
- approval boundaries;
- required evidence.

## 2. Plan / Route

Melkizac decides whether work should be handled directly, routed to a specialist, tracked in HMC/Kanban, scheduled as a routine, or paused for approval.

Routing follows `AI_WORKFORCE_TEAM_MAP.md`. Capability is not ownership: broad tool access does not override specialist ownership.

## 3. Act

Agents must take concrete tool-backed action when action is required:

- inspect files, logs, dashboards, inboxes, calendars, KB pages, or APIs;
- edit files or create artifacts;
- run commands, tests, builds, scripts, or browser checks;
- update HMC/Kanban state;
- create drafts, reports, or structured outputs.

Plan-only responses are insufficient when tools can perform the work.

## 4. Observe

The agent reads actual tool/environment results:

- stdout/stderr;
- test/build result;
- API response;
- browser state or screenshot;
- created file path;
- calendar/cron/job state;
- HMC/Kanban evidence;
- approval/blocker state.

## 5. Adjust

The next action must be based on observed evidence. Agents should change strategy when the same failure repeats, route work to the right profile when ownership is wrong, and escalate when the blocker is access, approval, or business judgment.

## 6. Verify

Completion requires evidence, not agent self-report. Acceptable evidence includes:

- passing tests or builds;
- API readback;
- browser/UI verification;
- created artifact readback;
- cron/calendar/job listing;
- HMC/Kanban output and evidence record.

## 7. Report / Escalate

Reports should state what was done, what evidence verified it, where the artifact/state lives, and what remains blocked. Escalate only for missing access, external submission, destructive/public-impacting changes, sensitive data movement, or real business judgment.

## Loop patterns

- **Retry loop:** small pass/fail tasks; stop or change strategy after repeated failure.
- **Plan–execute–verify loop:** multi-step implementation or operational workflows.
- **Explore–narrow loop:** debugging and uncertain root-cause work.
- **Human-in-the-loop:** external/risky/ambiguous decisions that need approval.
- **Multi-agent loop:** cross-domain work routed through planner, executor, reviewer, and orchestrator roles.

## HMC task contract

Every non-trivial HMC task should carry:

- Goal;
- Owner;
- Context;
- Allowed actions;
- Approval gates;
- Success condition;
- Failure condition;
- Evidence requirement;
- State: queued, running, blocked, review, done, failed.

## Role-specific loops

- **Melkizac/default:** Classify → Route → Track → Verify → Report.
- **Andrej/dev-ops:** Inspect → Patch → Test → Debug → Verify → Handoff.
- **Enrico/content-ops:** Brief → Draft → Review → Package → Approval-ready handoff → Performance learning.
- **LinkedIn Growth:** Discover target → Verify fit → Draft action → Confirm submit path → Approval → Record outcome.
- **Nexius Lead Agent:** Monitor → Detect delta → Qualify → Report → Create follow-up task → Track outcome.
- **Second Brain:** Capture source → Preserve raw → Synthesize wiki → Cross-link → Update index/log → Retrieve later.
- **Troas:** Collect data → Generate signal/report → Check freshness → Deliver actionable brief → Stay silent or escalate.

## Failure modes to avoid

- One-shot answer when tool-backed verification is needed.
- No exit condition.
- Repeating the same failed action without strategy change.
- Context overload without summarizing attempts.
- Specialist ownership bypassed by broad default-agent capability.
- Invisible handoffs or long-running work without HMC/Kanban state.
- Declaring completion without evidence.
- External side effects without approval.
- Sensitive data printed unnecessarily.

## Operator rule of thumb

If the work matters, it needs a loop. If the loop matters, it needs evidence. If the evidence matters over time, it belongs in HMC/Kanban, the KB, or both.
