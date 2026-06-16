#!/usr/bin/env python3
"""Mission Control feature preservation audit.

Compares source branches and built assets for known user-visible HMC feature markers.
This is intentionally static: it catches clean Git merges that omit JSX/CSS markers.
"""
from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable

REPO = Path(__file__).resolve().parents[1]

SOURCES = {
    "runtime_base": {"kind": "git", "ref": "origin/feat/agent-runtime-switcher-left-rail"},
    "governed": {"kind": "git", "ref": "project/hmc-governed-software-factory"},
    "recovery_pr": {"kind": "fs", "root": REPO},
    "live_dist": {"kind": "dist", "root": Path("/opt/hermes-mission-control/dist")},
    "pr_dist": {"kind": "dist", "root": REPO / "dist"},
}

@dataclass
class Feature:
    key: str
    description: str
    required: bool
    markers: list[str]
    files: list[str]
    decision: str = ""
    notes: str = ""

FEATURES = [
    Feature(
        "fresh-chat-default",
        "Fresh Mission Control load keeps chat as the default landing surface",
        True,
        ["Global Command Chat", "selectedProjectId", "selectedSessionId"],
        ["src/components/ChatThread.tsx", "src/views/MissionControl.tsx"],
        "preserve",
        "Contract invariant: chat remains default/fresh landing mode.",
    ),
    Feature(
        "collapsible-nav-rail",
        "Left nav rail can collapse/expand and keeps route additions",
        True,
        ["rail.collapsed", "rail-brand-toggle", "hmc-nav-collapsed", "data-tooltip"],
        ["src/components/NavRail.tsx", "src/styles/app.css"],
        "preserve",
        "Runtime branch already restored this; recovery must not regress it.",
    ),
    Feature(
        "hover-help-tooltips",
        "Hover/focus help tooltips are available across capability hubs and pages",
        True,
        ["InfoTooltip", "info-tooltip-popover", "About Capability Registry", "About reflections"],
        ["src/components/InfoTooltip.tsx", "src/styles/app.css", "src/views/CapabilityRegistry.tsx", "src/views/Reflections.tsx"],
        "recover",
        "Valid governed UI affordance; missing from live, present in recovery PR.",
    ),
    Feature(
        "settings-rate-limit-peek",
        "Settings menu includes Rate Limit details outside Admin-only settings",
        True,
        ["settings-usage-peek", "Settings and rate limit details", "Show rate limits details", "UsageRemainingPeek"],
        ["src/components/NavRail.tsx", "src/styles/app.css"],
        "recover",
        "User explicitly flagged; contract says model rate-limit UI stays outside Admin-only settings.",
    ),
    Feature(
        "agent-action-dropdown",
        "Agent three-dot/dropdown menu exposes Worker log, Details, and Rate limits",
        True,
        ["agent-action-dropdown", "Worker log", "Details", "Rate limits"],
        ["src/components/ChatThread.tsx", "src/styles/app.css"],
        "recover",
        "User explicitly flagged; label Worker log intentionally replaces governed Agent Log.",
    ),
    Feature(
        "capability-registry",
        "Admin Capability Registry governs skills, tools, plugins, connectors",
        True,
        ["CapabilityRegistry", "CAPABILITY REGISTRY", "Admin Capabilities", "getCapabilityMatrix"],
        ["src/App.tsx", "src/views/CapabilityRegistry.tsx", "src/services/hermesClient.ts", "src/services/httpHermesClient.ts"],
        "recover",
        "Feature contract invariant.",
    ),
    Feature(
        "reflections-agent-drawer",
        "Reflections has agent list plus per-agent reflection/approval drawer",
        True,
        ["Reflections", "reflection", "approval", "AgentDetailDrawerShell"],
        ["src/views/Reflections.tsx", "src/components/AgentDetailDrawerShell.tsx"],
        "recover",
        "Feature contract invariant.",
    ),
    Feature(
        "task-board-advanced-source-filter",
        "Task Board preserves board/source filtering as advanced/internal capability",
        True,
        ["board", "source", "Task source", "advanced"],
        ["src/views/TaskBoard.tsx", "src/services/httpHermesClient.ts", "src/types.ts"],
        "recover",
        "Feature contract invariant for /tasks.",
    ),
    Feature(
        "task-board-realtime-refresh-status",
        "Task Board exposes live/realtime refresh state in actions/header",
        True,
        ["runtime-refresh-status", "refreshStatusLabel", "useRealtimeRefresh"],
        ["src/views/TaskBoard.tsx", "src/hooks/useRealtimeRefresh.ts"],
        "recover",
        "Valid governed operational affordance.",
    ),
    Feature(
        "agent-runtime-switcher",
        "New per-agent account/model runtime switcher for company/personal ChatGPT accounts",
        True,
        ["Agent runtime switcher", "/api/agent-runtimes", "account_id", "model_id"],
        ["src/views/ModelRouter.tsx", "src/services/httpHermesClient.ts"],
        "keep-newer",
        "New runtime-switcher work supersedes older governed ModelRouter body.",
    ),
    Feature(
        "top-level-deeplink-routes",
        "Top-level paths like /reflections route to the correct view after login",
        True,
        ["parseMissionControlDeepLink", "allowedViewKeys", "pathname"],
        ["src/services/deepLinks.ts"],
        "recover",
        "Known governed branch fix; should be preserved.",
    ),
    Feature(
        "tools-hub-dedicated-api",
        "Tools Hub loads from dedicated tools API rather than capability registry confusion",
        True,
        ["ToolsHub", "getTools", "/api/tools"],
        ["src/views/ToolsHub.tsx", "src/services/httpHermesClient.ts", "src/services/hermesClient.ts"],
        "recover",
        "Valid governed capability separation.",
    ),
]


def git_show(ref: str, file: str) -> str:
    p = subprocess.run(["git", "show", f"{ref}:{file}"], cwd=REPO, text=True, capture_output=True)
    return p.stdout if p.returncode == 0 else ""


def fs_text(root: Path, file: str) -> str:
    p = root / file
    return p.read_text(errors="ignore") if p.exists() else ""


def dist_text(root: Path) -> str:
    if not root.exists():
        return ""
    chunks = []
    for pattern in ("assets/index-*.js", "assets/index-*.css", "index.html"):
        for p in root.glob(pattern):
            chunks.append(p.read_text(errors="ignore"))
    return "\n".join(chunks)


def source_text(source: dict, feature: Feature) -> str:
    kind = source["kind"]
    if kind == "git":
        return "\n".join(git_show(source["ref"], f) for f in feature.files)
    if kind == "fs":
        return "\n".join(fs_text(source["root"], f) for f in feature.files)
    if kind == "dist":
        return dist_text(source["root"])
    raise ValueError(kind)


def marker_status(text: str, markers: Iterable[str]) -> dict[str, bool]:
    return {m: (m in text) for m in markers}


def summarize(status: dict[str, bool]) -> str:
    if all(status.values()):
        return "present"
    if any(status.values()):
        return "partial"
    return "missing"


def main() -> None:
    rows = []
    for feat in FEATURES:
        row = {
            "key": feat.key,
            "description": feat.description,
            "required": feat.required,
            "decision": feat.decision,
            "notes": feat.notes,
            "sources": {},
            "missing_markers": {},
        }
        for name, src in SOURCES.items():
            text = source_text(src, feat)
            st = marker_status(text, feat.markers)
            row["sources"][name] = summarize(st)
            row["missing_markers"][name] = [m for m, ok in st.items() if not ok]
        rows.append(row)
    report = {"features": rows}
    out = REPO / "docs" / "reports" / "hmc-feature-preservation-audit-pr6.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2))

    md = ["# HMC Feature Preservation Audit — PR #6", "", "Generated by `scripts/hmc_feature_preservation_audit.py`.", "", "## Matrix", ""]
    md.append("| Feature | Required | Runtime base | Governed | Recovery PR source | Live dist | PR dist | Decision |")
    md.append("|---|---:|---|---|---|---|---|---|")
    for r in rows:
        md.append(
            f"| `{r['key']}` | {r['required']} | {r['sources']['runtime_base']} | {r['sources']['governed']} | {r['sources']['recovery_pr']} | {r['sources']['live_dist']} | {r['sources']['pr_dist']} | {r['decision']} |"
        )
    md += ["", "## Decisions", ""]
    for r in rows:
        md.append(f"- **{r['key']}** — {r['decision']}: {r['notes']}")
    md += ["", "## Live vs PR observation", "", "Items marked missing in `live_dist` but present in `pr_dist` are recovered in PR #6 but not yet deployed."]
    (REPO / "docs" / "reports" / "hmc-feature-preservation-audit-pr6.md").write_text("\n".join(md) + "\n")
    print(json.dumps(report, indent=2))

if __name__ == "__main__":
    main()
