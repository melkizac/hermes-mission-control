#!/usr/bin/env python3
"""Production-safe browser funnel-check job wrapper for Mission Control.

Phase 14 turns the Phase 13 one-off no-submit probe into a repeatable job:
- load one or more target URLs from JSON config;
- create/update operator-visible Task Board items;
- run the real Playwright funnel probe via BrowserRuntimeProducer;
- attach screenshot/final URL/browser-session evidence to task results;
- poll stop/takeover controls before and after the browser action path;
- preserve NO_SUBMIT safety and leave detected submit boundaries blocked.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping
from urllib.parse import quote
from urllib.request import HTTPCookieProcessor, Request, build_opener
import http.cookiejar

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from browser_funnel_check_probe import DEFAULT_SCREENSHOT_DIR, NO_SUBMIT, build_producer, ensure_safe_target, run_funnel_check, safe_domain
from browser_runtime_producer import DEFAULT_BASE_URL, DEFAULT_PASSWORD_FILE, DEFAULT_USER


@dataclass
class FunnelCheckTarget:
    label: str
    url: str
    project: str = "Browser funnel checks"
    expected: str = "lead capture form"
    task_id: str | None = None

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "FunnelCheckTarget":
        url = str(data.get("url") or "").strip()
        if not url:
            raise ValueError("target url required")
        return cls(
            label=str(data.get("label") or data.get("name") or safe_domain(url) or "Website funnel check")[:180],
            url=ensure_safe_target(url),
            project=str(data.get("project") or data.get("tenant") or "Browser funnel checks")[:180],
            expected=str(data.get("expected") or data.get("purpose") or "lead capture form")[:500],
            task_id=str(data.get("task_id") or data.get("taskId") or "").strip() or None,
        )


def slug(value: str) -> str:
    safe = "".join(ch.lower() if ch.isalnum() else "-" for ch in str(value or ""))
    while "--" in safe:
        safe = safe.replace("--", "-")
    return safe.strip("-")[:80] or "target"


class MissionControlTaskClient:
    """Authenticated Task Board client for creating/updating funnel-check tasks."""

    def __init__(self, base_url: str = DEFAULT_BASE_URL, username: str = DEFAULT_USER, password: str | None = None, password_file: Path = DEFAULT_PASSWORD_FILE):
        self.base_url = base_url.rstrip("/")
        self.username = username
        self.password = password if password is not None else os.environ.get("HMC_PASSWORD")
        if not self.password and password_file.exists():
            self.password = password_file.read_text(encoding="utf-8", errors="ignore").strip()
        self.cookiejar = http.cookiejar.CookieJar()
        self.opener = build_opener(HTTPCookieProcessor(self.cookiejar))
        self._authenticated = False

    def _request(self, path: str, method: str = "GET", payload: Mapping[str, Any] | None = None) -> Dict[str, Any]:
        data = None
        headers: Dict[str, str] = {}
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"
        with self.opener.open(Request(f"{self.base_url}{path}", data=data, headers=headers, method=method), timeout=20) as response:
            return json.loads(response.read().decode("utf-8") or "{}")

    def authenticate(self) -> None:
        if self._authenticated:
            return
        if not self.password:
            raise RuntimeError("Mission Control password unavailable; set HMC_PASSWORD or HMC_PASSWORD_FILE")
        result = self._request("/api/login", "POST", {"username": self.username, "password": self.password})
        if not result.get("ok"):
            raise RuntimeError("Mission Control authentication failed")
        self._authenticated = True

    def create_task(self, payload: Mapping[str, Any]) -> Dict[str, Any]:
        self.authenticate()
        return self._request("/api/tasks", "POST", dict(payload))

    def update_task(self, task_id: str, payload: Mapping[str, Any]) -> Dict[str, Any]:
        self.authenticate()
        return self._request(f"/api/tasks/{quote(task_id)}", "PUT", dict(payload))


def load_targets(path: Path) -> List[FunnelCheckTarget]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    raw_items = data.get("targets") if isinstance(data, dict) and isinstance(data.get("targets"), list) else data
    if isinstance(raw_items, dict):
        raw_items = [raw_items]
    if not isinstance(raw_items, list):
        raise ValueError("target config must be a JSON object, list, or {targets: [...]} object")
    targets = [FunnelCheckTarget.from_dict(item) for item in raw_items if isinstance(item, dict)]
    if not targets:
        raise ValueError("no valid targets in config")
    return targets


def poll_for_operator_command(producer: Any) -> Dict[str, Any] | None:
    controls = producer.poll_controls()
    commands = controls.get("commands") if isinstance(controls, dict) else []
    if isinstance(commands, list):
        for command in commands:
            if isinstance(command, dict) and command.get("type") in {"stop", "takeover"}:
                return command
    return None


def task_result_payload(target: FunnelCheckTarget, summary: Mapping[str, Any], session_id: str) -> Dict[str, Any]:
    blocked = summary.get("status") == "blocked_before_submit" or bool(summary.get("formsDetected") or summary.get("submitCandidates"))
    final_url = str(summary.get("finalUrl") or target.url)
    screenshot_path = summary.get("screenshotPath")
    evidence: List[Dict[str, Any]] = [
        {
            "id": f"{session_id}-browser-session",
            "kind": "browser-session",
            "title": "Browser Activity session",
            "summary": "Live browser runtime session published by the production funnel-check job.",
            "source": "/api/browser-sessions",
            "sourceId": session_id,
            "url": f"/app?view=browser-ops&session={quote(session_id)}",
            "confidence": "high",
        },
        {
            "id": f"{session_id}-final-url",
            "kind": "link",
            "title": "Final checked URL",
            "summary": "Final URL reached by the safe no-submit browser check.",
            "source": "playwright-funnel-check",
            "url": final_url,
            "confidence": "high",
        },
    ]
    if screenshot_path:
        evidence.append({
            "id": f"{session_id}-screenshot",
            "kind": "screenshot",
            "title": "Funnel check screenshot",
            "summary": "Screenshot captured before any form submission.",
            "source": "playwright-funnel-check",
            "path": screenshot_path,
            "confidence": "high",
        })
    status = "blocked" if blocked else "done"
    return {
        "status": status,
        "summary": f"Safe browser funnel check for {target.label}: {summary.get('formsDetected', 0)} form(s), {summary.get('submitCandidates', 0)} submit candidate(s), NO_SUBMIT={str(bool(summary.get('noSubmit'))).lower()}.",
        "verification": {
            "NO_SUBMIT": str(bool(summary.get("noSubmit", True)) and NO_SUBMIT).lower(),
            "domain": str(summary.get("domain") or safe_domain(final_url)),
            "expected": target.expected,
            "runtime_session_id": session_id,
        },
        "artifacts": [
            {
                "id": f"{session_id}-artifact",
                "kind": "browser-evidence",
                "title": f"Funnel check evidence · {target.label}",
                "summary": "Browser Activity session, final URL, and screenshot evidence for this production funnel check.",
                "path": screenshot_path,
            }
        ],
        "evidence": evidence,
        "approval_gates": [
            {
                "id": f"{session_id}-submit-approval",
                "title": "Review before form submit",
                "risk": "external-facing" if blocked else "safe",
                "status": "pending" if blocked else "not-required",
                "reason": "Detected form/submit controls. The job stopped before submit and requires operator approval before any real submission." if blocked else "No form submit boundary detected.",
                "requestedBy": "playwright-funnel-check",
            }
        ],
        "next_actions": [
            "Review Browser Activity session and screenshot evidence.",
            "Approve/reject the submit boundary if a real form submission is required.",
            "Attach client-specific follow-up notes or schedule another funnel check.",
        ],
    }


def stopped_result_payload(target: FunnelCheckTarget, session_id: str, command: Mapping[str, Any]) -> Dict[str, Any]:
    return {
        "status": "blocked",
        "summary": f"Operator stop/takeover command halted safe browser funnel check for {target.label} before browser execution.",
        "verification": {"NO_SUBMIT": "true", "runtime_session_id": session_id, "operator_command": str(command.get("type") or "stop")},
        "evidence": [{"id": f"{session_id}-operator-command", "kind": "operator-control", "title": "Operator stop/takeover command", "summary": json.dumps(command, default=str), "source": "/api/browser-sessions", "sourceId": session_id, "confidence": "high"}],
        "approval_gates": [{"id": f"{session_id}-operator-review", "title": "Operator intervention review", "risk": "operator-control", "status": "pending", "reason": "Operator requested stop/takeover before the browser job completed.", "requestedBy": "mission-control"}],
        "next_actions": ["Review why the browser job was stopped or taken over.", "Rerun the funnel check only if still needed."],
    }


def create_task_payload(target: FunnelCheckTarget, task_id: str, session_id: str, batch_id: str) -> Dict[str, Any]:
    return {
        "id": task_id,
        "title": f"Funnel check: {target.label}",
        "body": f"Production safe browser funnel check for {target.url}\nExpected: {target.expected}\nSafety: NO_SUBMIT; stop before any real submit.",
        "assignee": "Melkizac",
        "status": "running",
        "priority": 40,
        "created_by": "browser-funnel-check-job",
        "tenant": target.project,
        "session_id": session_id,
        "skills": ["agent-mission-control-ui"],
        "result": {"status": "running", "summary": "Safe browser funnel check started.", "verification": {"NO_SUBMIT": "true", "batch_id": batch_id, "runtime_session_id": session_id}},
    }


def run_target(target: FunnelCheckTarget, task_client: MissionControlTaskClient, screenshot_dir: Path = DEFAULT_SCREENSHOT_DIR, batch_id: str | None = None, timeout_ms: int = 20000) -> Dict[str, Any]:
    batch_id = batch_id or f"funnel-batch-{int(time.time())}"
    task_id = target.task_id or f"funnel-{slug(target.project)}-{slug(target.label)}-{int(time.time())}"
    session_id = f"browser-funnel-{slug(target.label)}-{int(time.time())}"
    task_client.create_task(create_task_payload(target, task_id, session_id, batch_id))
    producer = build_producer(session_id, task_id=task_id)
    command = poll_for_operator_command(producer)
    if command:
        payload = stopped_result_payload(target, session_id, command)
        task_client.update_task(task_id, {"status": "blocked", "result": json.dumps(payload)})
        return {"ok": True, "label": target.label, "taskId": task_id, "sessionId": session_id, "status": "stopped_by_operator", "command": command}
    try:
        summary = run_funnel_check(target.url, producer, screenshot_dir / slug(target.label), timeout_ms)
        # Poll again after the browser job has published screenshot/final evidence and before task result handoff.
        post_command = poll_for_operator_command(producer)
        if post_command:
            payload = stopped_result_payload(target, session_id, post_command)
            task_client.update_task(task_id, {"status": "blocked", "result": json.dumps(payload)})
            return {"ok": True, "label": target.label, "taskId": task_id, "sessionId": session_id, "status": "stopped_by_operator", "command": post_command}
        payload = task_result_payload(target, summary, session_id)
        task_client.update_task(task_id, {"status": payload["status"], "result": json.dumps(payload)})
        return {"ok": True, "label": target.label, "taskId": task_id, "sessionId": session_id, **summary}
    except Exception as exc:
        error_payload = {"status": "error", "summary": f"Safe browser funnel check failed for {target.label}: {str(exc)[:900]}", "verification": {"NO_SUBMIT": "true", "runtime_session_id": session_id}, "blockers": [str(exc)[:900]], "next_actions": ["Inspect browser runtime logs and rerun when network/dependency issue is resolved."]}
        try:
            producer.failed(str(exc), target.url)
        except Exception:
            pass
        task_client.update_task(task_id, {"status": "error", "result": json.dumps(error_payload)})
        return {"ok": False, "label": target.label, "taskId": task_id, "sessionId": session_id, "status": "error", "error": str(exc)[:900]}


def run_batch(targets: Iterable[FunnelCheckTarget], task_client: MissionControlTaskClient | None = None, screenshot_dir: Path = DEFAULT_SCREENSHOT_DIR, batch_id: str | None = None, timeout_ms: int = 20000) -> Dict[str, Any]:
    batch_id = batch_id or f"funnel-batch-{int(time.time())}"
    task_client = task_client or MissionControlTaskClient()
    results = [run_target(target, task_client=task_client, screenshot_dir=screenshot_dir, batch_id=batch_id, timeout_ms=timeout_ms) for target in targets]
    successful = all(item.get("ok", item.get("status") != "error") for item in results)
    return {"ok": successful, "batchId": batch_id, "total": len(results), "results": results}


def _main() -> int:
    parser = argparse.ArgumentParser(description="Run production safe no-submit browser funnel checks from JSON target config.")
    parser.add_argument("--config", required=True, help="JSON target object/list or {targets:[...]} config")
    parser.add_argument("--batch-id")
    parser.add_argument("--screenshot-dir", default=str(DEFAULT_SCREENSHOT_DIR))
    parser.add_argument("--timeout-ms", type=int, default=20000)
    args = parser.parse_args()
    targets = load_targets(Path(args.config))
    result = run_batch(targets, screenshot_dir=Path(args.screenshot_dir), batch_id=args.batch_id, timeout_ms=args.timeout_ms)
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if result.get("ok") else 2


if __name__ == "__main__":
    raise SystemExit(_main())
