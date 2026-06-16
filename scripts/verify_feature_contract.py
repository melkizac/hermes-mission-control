#!/usr/bin/env python3
"""Static Mission Control feature-contract gate.

This script intentionally checks user-visible/static affordances that can be
lost during dirty PR cleanup without producing TypeScript conflicts. It is not a
replacement for browser smoke, but it gives every PR a cheap preservation gate.
"""
from __future__ import annotations

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]


def read(rel: str) -> str:
    path = ROOT / rel
    if not path.exists():
        raise AssertionError(f"missing required file: {rel}")
    return path.read_text(encoding="utf-8")


def require(text: str, needle: str, label: str) -> None:
    if needle not in text:
        raise AssertionError(f"missing {label}: {needle!r}")


def require_any(text: str, needles: list[str], label: str) -> None:
    if not any(needle in text for needle in needles):
        joined = ", ".join(repr(n) for n in needles)
        raise AssertionError(f"missing {label}; expected one of {joined}")


def task_board_contract() -> None:
    text = read("src/views/TaskBoard.tsx")
    checks = [
        ('placeholder="Search ID, title, body, owner, project, skill', "Task Board search affordance"),
        ('aria-label="Status selector"', "status filter"),
        ('aria-label="Owner selector"', "owner filter"),
        ('aria-label="Project selector"', "project filter"),
        ('aria-label="Board selector"', "advanced board/source filter"),
        ('setViewMode("cards")', "cards view switch"),
        ('setViewMode("list")', "list view switch"),
        ('Create Spec Intake', "Spec Kit intake action"),
        ('Add Action', "manual task create action"),
        ('parseMissionControlDeepLink', "deep-linked task support"),
    ]
    for needle, label in checks:
        require(text, needle, label)
    require(text, 'startsWith("project-")', "canonical project-id to tenant alias mapping")
    require(text, 'project:${item.id.slice("project-".length)}', "project: tenant alias label parity")
    require_any(text, ['task-lane-group-', 'Not Started'], "Task Board lane grouping")


def projects_contract() -> None:
    text = read("src/views/Projects.tsx")
    checks = [
        ("client.listProjects", "canonical /api/projects data path"),
        ("ProjectCard", "project card surface"),
        ("ProjectWorkflowPanel", "project workflow/detail surface"),
        ("ProjectGuardPolicyPanel", "project guard policy surface"),
    ]
    for needle, label in checks:
        require(text, needle, label)


def runtimes_contract() -> None:
    text = read("src/views/Runtimes.tsx")
    checks = [
        ("native_console_url", "Hermes native console URL"),
        ("gateway URLs", "remote gateway advanced-boundary copy"),
        ("dashboard_auth_mode", "dashboard auth mode"),
        ("runtimeCapabilities", "runtime capability rendering"),
        ("Open Native Hermes Console", "native console action"),
        ('"hermes"', "Hermes runtime token type"),
    ]
    for needle, label in checks:
        require(text, needle, label)


def docs_and_pr_hygiene_contract() -> None:
    contract = read("docs/MISSION_CONTROL_FEATURE_CONTRACT.md")
    pr_template = read(".github/pull_request_template.md")
    pr_hygiene = read("docs/PR_HYGIENE_WORKFLOW.md")
    checks = [
        (contract, "Project filtering using canonical project labels", "project filter parity contract"),
        (contract, "Board/source filtering as an advanced/internal capability", "board/source preservation contract"),
        (contract, "Backend code under `/opt/hermes-mission-control`", "backend source-control boundary"),
        (pr_template, "Feature Contract impact", "PR template feature contract section"),
        (pr_template, "Capabilities intentionally preserved", "PR template preserved capabilities"),
        (pr_template, "Approved removal/replacement", "PR template removal approval block"),
        (pr_hygiene, "Do not build on top of unrelated dirty work", "dirty PR hygiene rule"),
        (pr_hygiene, "Cleanup PRs are high-risk", "cleanup PR high-risk rule"),
    ]
    for text, needle, label in checks:
        require(text, needle, label)


def v016_contract() -> None:
    docs = read("docs/HERMES_V016_COMPATIBILITY_DESIGN.md")
    types = read("src/types.ts")
    tests = read("tests/test_hermes_v016_hmc_compatibility.py")
    for needle in ["HermesRuntimeAdapter", "native_console_url", "runtime-scoped locators", "approval"]:
        require(docs, needle, f"v0.16 design doc item {needle}")
    for needle in ["HermesRuntimeAdapterRecord", "native_console_url", "download_url", "async_status", "hermes_cron_job_id"]:
        require(types, needle, f"v0.16 TypeScript type {needle}")
    for needle in [
        "test_v016_runtime_registration_exposes_native_console_and_adapter_capabilities",
        "test_v016_runtime_artifact_locator_normalizes_remote_and_external_artifacts",
        "test_v016_run_tree_preserves_async_child_status_completion_cause_and_runtime_profile",
        "test_v016_approval_policy_includes_memory_skill_model_provider_governance",
    ]:
        require(tests, needle, f"v0.16 regression test {needle}")


def main() -> int:
    checks = [
        task_board_contract,
        projects_contract,
        runtimes_contract,
        docs_and_pr_hygiene_contract,
        v016_contract,
    ]
    failures: list[str] = []
    for check in checks:
        try:
            check()
        except Exception as exc:  # noqa: BLE001 - command-line gate should collect all failures.
            failures.append(f"{check.__name__}: {exc}")
    if failures:
        print("Mission Control feature contract check FAILED", file=sys.stderr)
        for failure in failures:
            print(f"- {failure}", file=sys.stderr)
        return 1
    print("Mission Control feature contract check passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
