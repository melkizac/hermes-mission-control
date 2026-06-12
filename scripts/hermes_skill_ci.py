#!/usr/bin/env python3
"""Lightweight Hermes skill/workflow CI pilot.

Checks selected Hermes skills without loading secrets or executing arbitrary skill
commands. The pilot is intentionally read-only: it parses SKILL.md files, verifies
linked support files, validates declared required commands, and flags obvious
stale references.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import pwd
import re
import shutil
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

DEFAULT_SKILLS = [
    "agent-mission-control-ui",
    "kanban-orchestrator",
    "webapp-operations",
    "agency-security-division",
    "agency-testing-division",
]

SUPPORT_DIRS = ("references", "templates", "scripts", "assets")
LINK_RE = re.compile(r"\[[^\]]+\]\(([^)]+)\)")
BACKTICK_RE = re.compile(r"`([^`]+)`")
PATH_TOKEN_RE = re.compile(
    r"(?<![\w./-])((?:references|templates|scripts|assets)/[^\s`'\")\],;]+|/opt/agency-agents/[^\s`'\")\],;]+)"
)
SECRETISH_RE = re.compile(r"(?i)(api[_-]?key|token|secret|password|bearer|sk-[A-Za-z0-9])")


@dataclass
class Issue:
    severity: str
    check: str
    message: str


@dataclass
class SkillResult:
    name: str
    status: str = "PASS"
    path: str | None = None
    declared_commands: list[str] = field(default_factory=list)
    checked_links: int = 0
    checked_globs: int = 0
    issues: list[Issue] = field(default_factory=list)

    def add(self, severity: str, check: str, message: str) -> None:
        self.issues.append(Issue(severity, check, message))
        if severity == "FAIL":
            self.status = "FAIL"
        elif severity == "WARN" and self.status != "FAIL":
            self.status = "WARN"


def load_yaml_frontmatter(content: str) -> dict[str, Any]:
    if not content.startswith("---\n"):
        raise ValueError("SKILL.md must start with YAML frontmatter")
    end = content.find("\n---\n", 4)
    if end == -1:
        raise ValueError("SKILL.md frontmatter must close with ---")
    raw = content[4:end]
    try:
        import yaml  # type: ignore

        parsed = yaml.safe_load(raw) or {}
        if not isinstance(parsed, dict):
            raise ValueError("frontmatter is not a mapping")
        return parsed
    except ModuleNotFoundError:
        # Tiny fallback for this CI pilot; enough for common scalar/list fields.
        parsed: dict[str, Any] = {}
        for line in raw.splitlines():
            if not line or line.startswith(" ") or ":" not in line:
                continue
            key, val = line.split(":", 1)
            val = val.strip().strip('"\'')
            if val.startswith("[") and val.endswith("]"):
                parsed[key.strip()] = [x.strip().strip('"\'') for x in val[1:-1].split(",") if x.strip()]
            elif val:
                parsed[key.strip()] = val
        return parsed


def real_user_home() -> Path:
    """Return the OS account home, not a profile-scoped $HOME override."""
    try:
        return Path(pwd.getpwuid(os.getuid()).pw_dir)
    except Exception:
        return Path.home()


def skill_roots(profile: str | None) -> list[Path]:
    roots: list[Path] = []
    env_roots = os.environ.get("HERMES_SKILL_ROOTS")
    if env_roots:
        roots.extend(Path(p).expanduser() for p in env_roots.split(os.pathsep) if p)

    configured_home = Path(os.environ.get("HERMES_HOME", str(real_user_home() / ".hermes"))).expanduser()
    global_home = real_user_home() / ".hermes"

    # HERMES_HOME may point either at the global home or at an active profile home.
    if configured_home.name == profile and configured_home.parent.name == "profiles":
        roots.append(configured_home / "skills")
        global_home = configured_home.parent.parent
    else:
        if profile:
            roots.append(configured_home / "profiles" / profile / "skills")
        roots.append(configured_home / "skills")

    if profile:
        roots.append(global_home / "profiles" / profile / "skills")
    roots.append(global_home / "skills")
    # De-duplicate while preserving order.
    seen: set[str] = set()
    unique: list[Path] = []
    for root in roots:
        key = str(root.resolve()) if root.exists() else str(root)
        if key not in seen:
            seen.add(key)
            unique.append(root)
    return unique


def locate_skill(name: str, roots: list[Path]) -> Path | None:
    # Fast path: directory basename matches skill name.
    for root in roots:
        if not root.exists():
            continue
        matches = list(root.rglob(f"{name}/SKILL.md"))
        if matches:
            return sorted(matches, key=lambda p: len(str(p)))[0]
    # Fallback: frontmatter name match.
    for root in roots:
        if not root.exists():
            continue
        for candidate in root.rglob("SKILL.md"):
            try:
                fm = load_yaml_frontmatter(candidate.read_text(encoding="utf-8"))
            except Exception:
                continue
            if fm.get("name") == name:
                return candidate
    return None


def coerce_str_list(value: Any) -> list[str]:
    if not value:
        return []
    if isinstance(value, str):
        return [value]
    if isinstance(value, (list, tuple, set)):
        out: list[str] = []
        for item in value:
            if isinstance(item, str):
                out.append(item)
            elif isinstance(item, dict) and isinstance(item.get("command"), str):
                out.append(item["command"])
        return out
    return []


def get_nested(d: dict[str, Any], path: list[str]) -> Any:
    cur: Any = d
    for key in path:
        if not isinstance(cur, dict):
            return None
        cur = cur.get(key)
    return cur


def declared_commands(frontmatter: dict[str, Any]) -> list[str]:
    commands: list[str] = []
    for path in (
        ["required_commands"],
        ["commands"],
        ["metadata", "required_commands"],
        ["metadata", "hermes", "required_commands"],
        ["metadata", "hermes", "commands"],
    ):
        commands.extend(coerce_str_list(get_nested(frontmatter, path)))
    clean: list[str] = []
    for command in commands:
        # Treat a declared command line as the executable token.
        token = command.strip().split()[0] if command.strip() else ""
        if token and token not in clean:
            clean.append(token)
    return clean


def related_skills(frontmatter: dict[str, Any]) -> list[str]:
    values: list[str] = []
    for path in (["related_skills"], ["metadata", "hermes", "related_skills"]):
        values.extend(coerce_str_list(get_nested(frontmatter, path)))
    return sorted(set(values))


def extract_reference_tokens(content: str) -> set[str]:
    tokens: set[str] = set()
    for match in LINK_RE.findall(content):
        if match.startswith(("http://", "https://", "mailto:")):
            continue
        tokens.add(match.split("#", 1)[0])
    for match in BACKTICK_RE.findall(content):
        for path_match in PATH_TOKEN_RE.findall(match):
            tokens.add(path_match)
    for path_match in PATH_TOKEN_RE.findall(content):
        tokens.add(path_match)
    cleaned: set[str] = set()
    for token in tokens:
        token = token.strip().strip(".,:;)\"]")
        if token and not SECRETISH_RE.search(token):
            cleaned.add(token)
    return cleaned


def check_reference(skill_path: Path, token: str, result: SkillResult) -> None:
    if token.startswith("/"):
        base = Path("/")
        path_text = token
        exists_base = Path(token)
    else:
        base = skill_path.parent
        path_text = token
        exists_base = base / token

    if any(ch in path_text for ch in "*?["):
        matches = list(base.glob(path_text)) if not token.startswith("/") else list(Path("/").glob(path_text.lstrip("/")))
        result.checked_globs += 1
        if not matches:
            result.add("FAIL", "linked-files", f"Glob reference has no matches: {token}")
        return

    result.checked_links += 1
    if not exists_base.exists():
        # Avoid failing on prose such as "templates/capabilities/preferences";
        # only concrete files, globs, references, and absolute source paths are
        # treated as required linked artifacts by this pilot.
        if not token.startswith(("references/", "/")) and not Path(token).suffix:
            return
        result.add("FAIL", "linked-files", f"Missing linked reference: {token}")


def scan_skill(name: str, roots: list[Path], strict_related: bool) -> SkillResult:
    result = SkillResult(name=name)
    path = locate_skill(name, roots)
    if not path:
        result.add("FAIL", "smoke-load", "Skill not found in configured Hermes skill roots")
        return result
    result.path = str(path)
    try:
        content = path.read_text(encoding="utf-8")
        frontmatter = load_yaml_frontmatter(content)
    except Exception as exc:
        result.add("FAIL", "smoke-load", f"Could not parse SKILL.md: {exc}")
        return result

    if frontmatter.get("name") != name:
        result.add("FAIL", "smoke-load", f"Frontmatter name mismatch: expected {name!r}, got {frontmatter.get('name')!r}")
    if not frontmatter.get("description"):
        result.add("FAIL", "smoke-load", "Missing description in frontmatter")
    if not content.split("---\n", 2)[-1].strip():
        result.add("FAIL", "smoke-load", "SKILL.md body is empty")

    for command in declared_commands(frontmatter):
        result.declared_commands.append(command)
        if shutil.which(command) is None:
            result.add("FAIL", "required-commands", f"Declared command is not available on PATH: {command}")

    for token in sorted(extract_reference_tokens(content)):
        # Only validate skill support files and explicit agency source paths in this pilot.
        if token.startswith(SUPPORT_DIRS) or token.startswith("/opt/agency-agents/"):
            check_reference(path, token, result)

    for rel in related_skills(frontmatter):
        if not locate_skill(rel, roots):
            severity = "FAIL" if strict_related else "WARN"
            result.add(severity, "stale-references", f"Related skill not found in configured roots: {rel}")

    return result


def render_report(results: list[SkillResult], roots: list[Path]) -> str:
    now = dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).isoformat(timespec="seconds")
    passed = sum(1 for r in results if r.status == "PASS")
    warned = sum(1 for r in results if r.status == "WARN")
    failed = sum(1 for r in results if r.status == "FAIL")
    lines = [
        "# Hermes Skill/Workflow CI Pilot Report",
        "",
        f"Generated: {now}",
        f"Skill roots: {', '.join(str(r) for r in roots)}",
        f"Summary: {passed} passed, {warned} warned, {failed} failed, {len(results)} total.",
        "",
        "## Checks",
        "",
        "- Smoke-load selected skills by parsing `SKILL.md` frontmatter and body.",
        "- Verify linked support files under `references/`, `templates/`, `scripts/`, and `assets/` exist.",
        "- Verify declared required commands are available on `PATH` when skills declare them.",
        "- Detect obvious stale references: missing support paths, empty globs, missing related skills, and missing explicit `/opt/agency-agents/...` source paths.",
        "",
        "## Results",
        "",
    ]
    for result in results:
        lines.extend([
            f"### {result.status}: {result.name}",
            "",
            f"- Path: `{result.path or 'not found'}`",
            f"- Declared commands checked: {', '.join(result.declared_commands) if result.declared_commands else 'none declared'}",
            f"- Linked files checked: {result.checked_links}; glob references checked: {result.checked_globs}",
        ])
        if result.issues:
            lines.append("- Issues:")
            for issue in result.issues:
                lines.append(f"  - [{issue.severity}] {issue.check}: {issue.message}")
        else:
            lines.append("- Issues: none")
        lines.append("")
    lines.extend([
        "## Exit Criteria",
        "",
        "This pilot exits non-zero when any FAIL issue is present. WARN issues are actionable but do not fail the run unless `--strict-related` promotes missing related skills to failures.",
        "",
    ])
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Run a lightweight CI check over selected Hermes skills.")
    parser.add_argument("--profile", default=os.environ.get("HERMES_PROFILE", "dev-ops"))
    parser.add_argument("--skill", action="append", dest="skills", help="Skill name to check; repeatable. Defaults to HMC pilot set.")
    parser.add_argument("--output", default="docs/reports/hermes-skill-ci-pilot.md", help="Markdown report path.")
    parser.add_argument("--json", dest="json_output", default=None, help="Optional machine-readable JSON report path.")
    parser.add_argument("--strict-related", action="store_true", help="Treat missing related_skills as failures instead of warnings.")
    args = parser.parse_args(argv)

    roots = skill_roots(args.profile)
    skills = args.skills or DEFAULT_SKILLS
    results = [scan_skill(name, roots, args.strict_related) for name in skills]

    report = render_report(results, roots)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(report, encoding="utf-8")

    if args.json_output:
        payload = {
            "skills": [
                {
                    "name": r.name,
                    "status": r.status,
                    "path": r.path,
                    "declared_commands": r.declared_commands,
                    "checked_links": r.checked_links,
                    "checked_globs": r.checked_globs,
                    "issues": [issue.__dict__ for issue in r.issues],
                }
                for r in results
            ],
            "summary": {
                "passed": sum(1 for r in results if r.status == "PASS"),
                "warned": sum(1 for r in results if r.status == "WARN"),
                "failed": sum(1 for r in results if r.status == "FAIL"),
            },
        }
        json_path = Path(args.json_output)
        json_path.parent.mkdir(parents=True, exist_ok=True)
        json_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    print(report)
    print(f"Report written to {output_path}")
    if any(r.status == "FAIL" for r in results):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
