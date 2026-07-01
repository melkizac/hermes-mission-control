#!/usr/bin/env python3
"""Search HMC-specific UI guidance before changing Mission Control UI.

This is a curated, local adaptation of the useful concept from
nextlevelbuilder/ui-ux-pro-max-skill: searchable design intelligence.
It intentionally avoids importing the external package or installer.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from dataclasses import dataclass, asdict
from math import log
from typing import Iterable


@dataclass(frozen=True)
class GuidanceRecord:
    key: str
    title: str
    screen: str
    keywords: tuple[str, ...]
    use_when: str
    decision_rule: str
    adopt: tuple[str, ...]
    avoid: tuple[str, ...]
    checklist: tuple[str, ...]
    verify: tuple[str, ...]


RECORDS: tuple[GuidanceRecord, ...] = (
    GuidanceRecord(
        key="operator-dashboard",
        title="Operator dashboard surfaces must be decision-first",
        screen="dashboard",
        keywords=("dashboard", "overview", "home", "status", "metrics", "health", "attention", "ops"),
        use_when="Changing Mission Control overview, home, status, or operations dashboard surfaces.",
        decision_rule="Top-level dashboard content must answer what needs attention, what changed, what is running, what is blocked, and where to click next before showing vanity metrics.",
        adopt=(
            "Group cards by operator decision: attention, active work, produced evidence, system health, cost/usage when actionable.",
            "Use compact status plus counts only when they change the next operator action.",
            "Make primary actions explicit and place secondary diagnostics behind details or admin surfaces.",
        ),
        avoid=(
            "Lifetime totals or duplicate runtime facts in primary dashboard real estate.",
            "Decorative model/provider cards with no route, owner, or action.",
            "Metrics that do not explain whether the operator should inspect, approve, pause, or hand off.",
        ),
        checklist=(
            "Each primary card has a clear next-click or reason to ignore.",
            "Critical state uses icon/text, not color alone.",
            "Empty/loading/error states explain what the operator can do.",
        ),
        verify=("Run frontend build if source changed.", "Browser-check the dashboard at desktop and mobile widths when visual layout changed."),
    ),
    GuidanceRecord(
        key="task-drawer",
        title="Task Detail drawers are the primary proof/evidence cockpit",
        screen="task-detail-drawer",
        keywords=("task", "drawer", "evidence", "cockpit", "result", "blocker", "kanban", "proof", "execution"),
        use_when="Changing Task Board cards, task detail drawers, execution cockpits, result panels, blockers, or evidence tabs.",
        decision_rule="Prefer extending the existing task detail drawer over creating separate pages; the drawer should preserve board context while showing owner, status, blockers, evidence, and next actions.",
        adopt=(
            "Use tabs such as Overview, Actions, Approvals, Evidence, Runs, Rules, Metrics only when they contain actionable data.",
            "Render structured blockers/result verification in normal operator language before raw JSON.",
            "Show task IDs and searchable identifiers on cards and drawers.",
            "Keep task progress compact in the cockpit header; avoid prominent decorative progress rings.",
        ),
        avoid=(
            "Standalone evidence pages for single-task proof.",
            "Raw result blobs that require JSON parsing to understand the status.",
            "Horizontally overflowing pill tabs when drawer sections are numerous.",
        ),
        checklist=(
            "Drawer answers: who owns this, what happened, what blocks it, what evidence proves it, what is next.",
            "Tabs with zero useful data are hidden or demoted.",
            "Counts appear on labels only when counts affect action.",
            "Focus/close behavior works by keyboard.",
        ),
        verify=("Run targeted Task Board/drawer static tests where present.", "Browser-open a representative task drawer if layout changed."),
    ),
    GuidanceRecord(
        key="workflow-drawer",
        title="Workflow and routine drawers use progressive disclosure",
        screen="workflow-routine-drawer",
        keywords=("workflow", "routine", "cron", "automation", "schedule", "run", "website", "monitor", "safety"),
        use_when="Changing workflow library, routines, cron/routine cards, or automation detail drawers.",
        decision_rule="Default workflow/routine views should show schedule, next/last run, binding, evidence, status, and safe actions; prompts, scripts, toolsets, connector internals, and probes belong in Advanced/Admin.",
        adopt=(
            "Label sections in plain operator language, e.g. Websites being monitored, Allowed now, Not allowed unless approved.",
            "Bind routines to workflow/task-board context when possible.",
            "Show evidence-only/no-form-submission safety copy for browser routines.",
        ),
        avoid=(
            "Putting connector setup, dry-run probes, and raw prompt/script internals in default user views.",
            "Implying Browserbase/cloud runtime when the actual check uses local Playwright.",
        ),
        checklist=(
            "Default drawer is understandable without knowing cron, toolset, or script internals.",
            "Dangerous actions are paused/approve-gated.",
            "Advanced sections are clearly labelled and collapsed/demoted.",
        ),
        verify=("Check routine cards and drawer tabs after build.", "Confirm schedule/time labels are in operator timezone when user-facing."),
    ),
    GuidanceRecord(
        key="model-router",
        title="Model Router is governance infrastructure, not a vanity model gallery",
        screen="model-router",
        keywords=("model", "router", "routing", "provider", "gpt", "deepseek", "codex", "openrouter", "fallback", "judge", "cost", "latency"),
        use_when="Changing model routing, provider allow-lists, route previews, model selectors, or model governance UI.",
        decision_rule="Model routing UI must expose why a route is allowed, what it is allowed to do, credential readiness, fallback trigger, cost/risk tier, and approval boundary.",
        adopt=(
            "Show active provider/model and credential source without exposing secrets.",
            "Distinguish static baseline routing, dynamic routing, racing, judging, and no-agent script-only lanes.",
            "Record route reason, task type, risk tier, selected model, fallback, and approval status.",
            "Use current Hermes CLI/auth metadata as evidence; do not invent disconnected model registries.",
        ),
        avoid=(
            "Model cards that only show logos, names, or generic capability claims.",
            "Confusing model cards with Codex labels or agent identities.",
            "Routing actions that silently change production behavior without owner approval.",
        ),
        checklist=(
            "Every route surface answers: task type, model, reason, risk, cost/latency expectation, fallback, approval gate.",
            "DeepSeek/cheap lanes are labelled inactive/isolated unless live config proves otherwise.",
            "Secrets and raw auth files never render in the browser or logs.",
        ),
        verify=("Run model-router static/API tests if touched.", "Inspect rendered route preview/model router with non-secret sample data."),
    ),
    GuidanceRecord(
        key="approval-queue",
        title="Approval queues must preview exact side effects before execution",
        screen="approval-review",
        keywords=("approval", "review", "approve", "human", "email", "calendar", "send", "publish", "external", "write"),
        use_when="Changing human approval queues, review drawers, email/calendar/post previews, or write/publish flows.",
        decision_rule="For high-risk side effects, the UI must follow Draft/Preview → Review → Approve → Execute → Verify with explicit actor/action/target/effect copy.",
        adopt=(
            "Show the exact draft/action body, recipient/target, account used, timing, and verification method.",
            "Keep approval and execution audit events attached to the task/workflow.",
            "Separate approve, reject, edit, and request-more-evidence actions.",
        ),
        avoid=(
            "Generic Approve buttons without explaining the irreversible side effect.",
            "Auto-send/auto-publish behavior for external communications unless explicitly configured and approved.",
            "Burying raw context before a concise approval summary.",
        ),
        checklist=(
            "Approval copy includes actor, action, target, effect, account, and rollback/verification where relevant.",
            "Reject/edit paths are visible.",
            "Execution result is verified and attached after approval.",
        ),
        verify=("Exercise a safe draft-only approval path.", "Confirm no external side effect fires before approval."),
    ),
    GuidanceRecord(
        key="agent-roster",
        title="Agent roster shows identity, readiness, ownership, and current activity",
        screen="agent-workforce-roster",
        keywords=("agent", "roster", "workforce", "identity", "status", "skills", "tools", "plugins", "groups", "profile"),
        use_when="Changing AI Workforce roster, agent detail drawers, capability cards, skill/tool/plugin inventory, or agent status labels.",
        decision_rule="Agent surfaces should distinguish identity, assigned ownership, runtime availability, recent activity, capabilities, profile scope, and credential readiness.",
        adopt=(
            "Use persisted identity names and group labels; avoid generic Hermes Agent labels when specific identity exists.",
            "Separate status, availability, activity state, and evidence.",
            "Classify skills/tools/plugins by source: Hermes, OpenClaw, Shared.",
        ),
        avoid=(
            "Hardcoded agent labels or legacy terms such as Squads/Channels in user-facing UI.",
            "Claiming active when only configuration exists and no recent work/request is active.",
            "False Hermes assignment labels for OpenClaw-only capabilities.",
        ),
        checklist=(
            "Roster card status is evidence-backed.",
            "Agent detail drawer keeps context and does not shrink the main workspace unnecessarily.",
            "Capability inventory shows source and readiness without secrets.",
        ),
        verify=("Check /api/agents response shape if backend changed.", "Browser-check roster and detail drawer labels."),
    ),
    GuidanceRecord(
        key="memory-knowledge",
        title="Memory and knowledge pages prioritize operator-ready context over raw diagnostics",
        screen="memory-second-brain",
        keywords=("memory", "knowledge", "second brain", "kb", "graph", "source", "evidence", "semantic", "chunks"),
        use_when="Changing Memory, Second Brain, sources/evidence, graph, or KB context surfaces.",
        decision_rule="Primary memory UI should help the operator find usable context and evidence; raw graph/health/chunk diagnostics belong in admin/advanced surfaces unless directly useful.",
        adopt=(
            "Keep primary tabs focused on Agent Memory, Second Brain, and Sources & Evidence.",
            "Label graph/chunk metrics by their real backend meaning; do not imply semantic maturity without proof.",
            "Scope filters to the active tab only.",
        ),
        avoid=(
            "Parsing binary evidence files as text.",
            "Persistent side panels that duplicate filters or policy explanations at the cost of memory content width.",
            "Global filter rows that do not apply to every visible tab.",
        ),
        checklist=(
            "Memory entries have enough width to be readable.",
            "Sources/evidence do not expose raw private content unnecessarily.",
            "Diagnostics are demoted unless the user explicitly needs them.",
        ),
        verify=("Run memory/graph regression tests if touched.", "Open each tab and confirm filters affect only active content."),
    ),
    GuidanceRecord(
        key="navigation",
        title="Navigation reflects HMC operating model and avoids duplicate runtime pages",
        screen="navigation-ia",
        keywords=("nav", "navigation", "rail", "admin", "settings", "route", "page", "work", "projects"),
        use_when="Changing left rail, admin/user mode routing, workspace pages, docs links, or route permissions.",
        decision_rule="Primary navigation should map to HMC operator work: Projects, Task Board, Workforce, Approvals, Skills/Tools/Plugins, Docs; raw runtime duplicates belong in Desktop/Admin only when they add governance value.",
        adopt=(
            "Move lower-frequency System/Admin/Setup controls into settings/admin docks.",
            "Keep Project = operating space, Goal = desired result, Task = action, Evidence = proof.",
            "Make admin-only deep links switch into admin mode and bypass mobile chat-only shells where required.",
        ),
        avoid=(
            "A generic Work page duplicating Projects + Task Board.",
            "Top-level Evidence page when task drawers are the proof surface.",
            "Outer Admin nav items that merely duplicate embedded Hermes Desktop runtime pages.",
        ),
        checklist=(
            "Rail labels match operator language.",
            "No duplicate page exposes the same raw runtime function without added governance context.",
            "Desktop and mobile deep links render the intended route.",
        ),
        verify=("Browser-extract nav labels after build/deploy.", "Check admin/user mode deep links where route permissions changed."),
    ),
    GuidanceRecord(
        key="dense-table",
        title="Dense tables, logs, and audit trails must preserve scanability and action",
        screen="dense-data-table",
        keywords=("table", "log", "audit", "filter", "sort", "search", "row", "badge", "history", "runs"),
        use_when="Changing tables, run logs, audit trails, filter/search panels, history lists, or dense evidence rows.",
        decision_rule="Dense data surfaces should show hierarchy, active filters, status semantics, and row-level actions without forcing horizontal overflow or raw payload reading.",
        adopt=(
            "Make active filters visible and reversible.",
            "Use status badges with text plus icon/shape; include timestamps and owners when decisions depend on them.",
            "Keep helper text spanning available grid space instead of wrapping in a narrow column.",
            "Use skeletons for structured loading states.",
        ),
        avoid=(
            "Color-only state indicators.",
            "Unbounded raw logs in primary rows.",
            "Filters whose state is hidden or hard to clear.",
        ),
        checklist=(
            "Rows answer what happened, owner/source, status, evidence, and next action.",
            "Filters/search are keyboard reachable and reversible.",
            "No horizontal overflow at common breakpoints unless explicitly designed for data tables.",
        ),
        verify=("Run relevant static tests for table/filter surfaces.", "Browser-check row wrapping, tab order, and filter active states."),
    ),
    GuidanceRecord(
        key="mobile-chat",
        title="Mobile Mission Control prioritizes chat/voice without desktop chrome leakage",
        screen="mobile-chat-voice",
        keywords=("mobile", "chat", "voice", "composer", "mic", "textarea", "responsive", "viewport"),
        use_when="Changing mobile Mission Control chat, composer, mic/voice mode, or mobile shell routing.",
        decision_rule="Mobile user mode should prioritize the chat function; voice mode may fill the viewport, but admin deep links must bypass chat-only rendering when appropriate.",
        adopt=(
            "Render a scoped mobile chat-only shell for normal user mobile routes.",
            "Keep composer controls visible and above bottom nav; mobile empty composer starts compact and grows with text.",
            "Use full-screen voice surfaces when requested, with an obvious return/tap-send target.",
        ),
        avoid=(
            "Desktop rail/admin chrome mounted and hidden only by CSS in user mobile chat.",
            "Composer hidden behind fixed bottom navigation.",
            "Voice overlays that return prematurely to text mode when the user wanted voice-first flow.",
        ),
        checklist=(
            "No horizontal overflow at mobile width.",
            "Composer send/mic/attachment targets are reachable.",
            "Admin-only routes on mobile render admin page, not Main Chat.",
        ),
        verify=("Use a mobile Playwright viewport for composer geometry when UI changed.", "Check admin-only mobile deep links if shell routing changed."),
    ),
)


def tokenize(text: str) -> list[str]:
    return re.findall(r"[a-z0-9][a-z0-9_-]*", text.lower())


def record_text(record: GuidanceRecord) -> str:
    parts: Iterable[str] = (
        record.key,
        record.title,
        record.screen,
        " ".join(record.keywords),
        record.use_when,
        record.decision_rule,
        " ".join(record.adopt),
        " ".join(record.avoid),
        " ".join(record.checklist),
    )
    return "\n".join(parts)


def score_records(query: str) -> list[tuple[float, GuidanceRecord]]:
    query_tokens = tokenize(query)
    if not query_tokens:
        return []

    docs = [tokenize(record_text(record)) for record in RECORDS]
    doc_freq = Counter(token for doc in docs for token in set(doc))
    total_docs = len(docs)
    results: list[tuple[float, GuidanceRecord]] = []

    for record, doc in zip(RECORDS, docs):
        counts = Counter(doc)
        length_norm = max(len(doc), 1) ** 0.5
        score = 0.0
        exact_bonus = 0.0
        key_blob = " ".join((record.key, record.screen, " ".join(record.keywords))).lower()
        for token in query_tokens:
            idf = log((total_docs + 1) / (doc_freq.get(token, 0) + 1)) + 1
            score += counts.get(token, 0) * idf / length_norm
            if token in key_blob:
                exact_bonus += 1.5
        score += exact_bonus
        if score > 0:
            results.append((score, record))

    return sorted(results, key=lambda item: item[0], reverse=True)


def format_record(record: GuidanceRecord, score: float | None = None) -> str:
    header = f"## {record.key}: {record.title}"
    if score is not None:
        header += f"\nScore: {score:.2f}"
    lines = [
        header,
        f"Screen: {record.screen}",
        f"Use when: {record.use_when}",
        "",
        "Decision rule:",
        f"- {record.decision_rule}",
        "",
        "Adopt:",
        *(f"- {item}" for item in record.adopt),
        "",
        "Avoid:",
        *(f"- {item}" for item in record.avoid),
        "",
        "Acceptance checklist:",
        *(f"- [ ] {item}" for item in record.checklist),
        "",
        "Verification:",
        *(f"- {item}" for item in record.verify),
    ]
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Search curated HMC UI guidance.")
    parser.add_argument("query", nargs="?", help="UI change request or screen description")
    parser.add_argument("--screen", choices=tuple(record.key for record in RECORDS), help="Return one guidance record by key")
    parser.add_argument("--list", action="store_true", help="List available guidance keys")
    parser.add_argument("--json", action="store_true", help="Return JSON")
    parser.add_argument("-n", "--max-results", type=int, default=3, help="Maximum results")
    args = parser.parse_args()

    if args.list:
        payload = [{"key": r.key, "title": r.title, "screen": r.screen} for r in RECORDS]
        if args.json:
            print(json.dumps(payload, indent=2))
        else:
            for item in payload:
                print(f"{item['key']}: {item['title']} ({item['screen']})")
        return 0

    if args.screen:
        record = next(r for r in RECORDS if r.key == args.screen)
        if args.json:
            print(json.dumps(asdict(record), indent=2))
        else:
            print(format_record(record))
        return 0

    if not args.query:
        parser.error("provide a query, --screen, or --list")

    matches = score_records(args.query)[: max(args.max_results, 1)]
    if args.json:
        print(json.dumps([
            {"score": round(score, 4), **asdict(record)} for score, record in matches
        ], indent=2))
    else:
        if not matches:
            print("No HMC UI guidance matched. Try --list to see available keys.")
            return 1
        for idx, (score, record) in enumerate(matches, 1):
            if idx > 1:
                print("\n---\n")
            print(format_record(record, score))
    return 0


if __name__ == "__main__":
    sys.exit(main())
