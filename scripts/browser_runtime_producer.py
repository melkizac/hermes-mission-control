#!/usr/bin/env python3
"""Mission Control browser runtime producer client.

Publishes browser-worker events to POST /api/browser-sessions/events so Browser Activity
can supervise real browser sessions. This module is intentionally runtime-agnostic:
Browserbase, Playwright, desktop browser agents, or Hermes tool wrappers can import
BrowserRuntimeProducer and call the hook methods around browser actions.

Secrets are read from environment/password files by MissionControlEventClient; callers
should not hardcode credentials in browser scripts.
"""

from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional
from urllib.parse import urlparse
from urllib.request import HTTPCookieProcessor, Request, build_opener
import http.cookiejar

EXTERNAL_ACTIONS = {"submit", "post", "send", "purchase", "upload", "account_change"}
DEFAULT_BASE_URL = os.environ.get("HMC_BASE_URL", "http://127.0.0.1:19080")
DEFAULT_USER = os.environ.get("HMC_USER", "admin")
DEFAULT_PASSWORD_FILE = Path(os.environ.get("HMC_PASSWORD_FILE", "/opt/hermes-mission-control/.basic-password"))


def current_domain(url: str | None) -> str:
    if not url:
        return "unknown"
    try:
        host = urlparse(str(url)).netloc.lower()
        if host.startswith("www."):
            host = host[4:]
        return host or "unknown"
    except Exception:
        return "unknown"


def action_requires_approval(action_type: str) -> bool:
    return str(action_type or "").strip().lower().replace("-", "_") in EXTERNAL_ACTIONS


class MissionControlEventClient:
    """Authenticated HTTP client for POST /api/browser-sessions/events.

    Authentication prefers HMC_PASSWORD, then HMC_PASSWORD_FILE. Passwords and cookies
    are never returned by public methods.
    """

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
        request = Request(f"{self.base_url}{path}", data=data, headers=headers, method=method)
        with self.opener.open(request, timeout=20) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw or "{}")

    def authenticate(self) -> None:
        if self._authenticated:
            return
        if not self.password:
            raise RuntimeError("Mission Control password unavailable; set HMC_PASSWORD or HMC_PASSWORD_FILE")
        result = self._request("/api/login", "POST", {"username": self.username, "password": self.password})
        if not result.get("ok"):
            raise RuntimeError("Mission Control authentication failed")
        self._authenticated = True

    def post_event(self, event: Mapping[str, Any]) -> Dict[str, Any]:
        self.authenticate()
        return self._request("/api/browser-sessions/events", "POST", dict(event))

    def poll_control(self, session_id: str) -> Dict[str, Any]:
        """Poll the read model for stop/takeover control events.

        Phase 12 does not claim a browser process was killed. The producer reads the
        latest Mission Control actionLog and lets the browser runtime decide how to
        honor stop/takeover requests. A brand-new producer may poll before its first
        event has created a read-model session; a 404 means no controls yet.
        """
        self.authenticate()
        try:
            detail = self._request(f"/api/browser-sessions/{session_id}", "GET")
        except Exception as exc:
            code = getattr(exc, "code", None)
            if code == 404:
                return {"sessionId": session_id, "commands": [], "status": "not-found"}
            raise
        commands: List[Dict[str, Any]] = []
        for action in detail.get("actionLog", []) if isinstance(detail.get("actionLog"), list) else []:
            if isinstance(action, dict) and action.get("type") in {"stop", "takeover"}:
                commands.append({
                    "type": action.get("type"),
                    "status": "requested",
                    "title": action.get("title"),
                    "summary": action.get("summary"),
                    "ts": action.get("ts"),
                })
        return {"sessionId": session_id, "commands": commands, "status": detail.get("status")}


@dataclass
class BrowserRuntimeProducer:
    """Runtime-agnostic browser event producer.

    Browser workers should call these methods at browser lifecycle boundaries:
    session_started -> navigated -> screenshot_captured -> before_external_action
    -> final_evidence/completed/failed. Each method posts a small event to Mission
    Control; Mission Control owns persistence and operator rendering.
    """

    client: Any
    session_id: str
    runtime_id: str = "browser-runtime"
    runtime_label: str = "Browser runtime"
    agent_id: str | None = None
    agent_name: str | None = None
    task_id: str | None = None
    task_url: str | None = None
    title: str = "Live browser runtime session"
    metadata: Dict[str, Any] = field(default_factory=dict)

    def base_event(self, url: str | None = None, status: str | None = None, extra: Mapping[str, Any] | None = None) -> Dict[str, Any]:
        event: Dict[str, Any] = {
            "sessionId": self.session_id,
            "title": self.title,
            "runtimeId": self.runtime_id,
            "runtimeLabel": self.runtime_label,
        }
        if status:
            event["status"] = status
        if self.agent_id:
            event["agentId"] = self.agent_id
        if self.agent_name:
            event["agentName"] = self.agent_name
        if self.task_id:
            event["taskId"] = self.task_id
        if self.task_url:
            event["taskUrl"] = self.task_url
        if url:
            event["currentUrl"] = url
            event["currentDomain"] = current_domain(url)
            event["accountSensitive"] = current_domain(url) in {"linkedin.com", "facebook.com", "x.com", "twitter.com", "gmail.com"}
        if self.metadata:
            event["metadata"] = dict(self.metadata)
        if extra:
            event.update(dict(extra))
        return event

    def emit(self, event: Mapping[str, Any]) -> Dict[str, Any]:
        return self.client.post_event(dict(event))

    def session_started(self, title: str | None = None, url: str | None = None) -> Dict[str, Any]:
        if title:
            self.title = title
        return self.emit(self.base_event(url=url, status="active", extra={
            "action": {"type": "session_started", "title": "Browser session started", "summary": self.title, "approvalRequired": False}
        }))

    def navigated(self, url: str, title: str | None = None, summary: str | None = None) -> Dict[str, Any]:
        return self.emit(self.base_event(url=url, status="active", extra={
            "action": {"type": "navigation", "title": title or f"Navigated to {current_domain(url)}", "summary": summary or url, "approvalRequired": False}
        }))

    def screenshot_captured(self, url: str | None = None, path: str | None = None, title: str = "Browser screenshot", summary: str | None = None) -> Dict[str, Any]:
        screenshot = {"title": title, "summary": summary or "Screenshot captured by browser runtime."}
        if url:
            screenshot["url"] = url
        if path:
            screenshot["path"] = path
        return self.emit(self.base_event(status="active", extra={
            "screenshot": screenshot,
            "action": {"type": "screenshot", "title": title, "summary": screenshot["summary"], "approvalRequired": False},
        }))

    def before_external_action(self, action_type: str, url: str | None = None, title: str | None = None, summary: str | None = None) -> Dict[str, Any]:
        requires = action_requires_approval(action_type)
        event = self.base_event(url=url, status="blocked" if requires else "active", extra={
            "approvalRequired": requires,
            "approvalReason": "Approval required before browser runtime may submit/post/send/purchase or perform another external-facing action." if requires else "No external-facing approval gate required.",
            "action": {
                "type": action_type,
                "title": title or f"Attempted {action_type}",
                "summary": summary or "Browser runtime reached an external-action boundary.",
                "risk": "external-facing" if requires else "safe",
                "approvalRequired": requires,
            },
        })
        response = self.emit(event)
        return {"requiresApproval": requires, "response": response}

    def final_evidence(self, url: str | None = None, title: str = "Final browser evidence", summary: str | None = None) -> Dict[str, Any]:
        final = {"kind": "link", "title": title, "summary": summary or "Final browser URL/evidence captured by runtime.", "url": url}
        return self.emit(self.base_event(url=url, status="completed", extra={
            "finalEvidence": final,
            "evidence": [final],
            "action": {"type": "completed", "title": title, "summary": final["summary"], "approvalRequired": False},
        }))

    def failed(self, error: str, url: str | None = None) -> Dict[str, Any]:
        return self.emit(self.base_event(url=url, status="failed", extra={
            "action": {"type": "failed", "title": "Browser runtime failed", "summary": str(error)[:1000], "risk": "runtime-error", "approvalRequired": False},
            "notes": ["Browser runtime producer reported a failure.", str(error)[:1000]],
        }))

    def poll_controls(self) -> Dict[str, Any]:
        return self.client.poll_control(self.session_id)


def _main() -> int:
    parser = argparse.ArgumentParser(description="Publish browser runtime events to Mission Control.")
    parser.add_argument("--session-id", required=True)
    parser.add_argument("--event", choices=["started", "navigation", "screenshot", "approval", "final", "failed", "poll-controls"], required=True)
    parser.add_argument("--url")
    parser.add_argument("--title")
    parser.add_argument("--summary")
    parser.add_argument("--action-type", default="submit")
    parser.add_argument("--runtime-id", default="browserbase")
    parser.add_argument("--runtime-label", default="Browserbase / browser runtime")
    parser.add_argument("--agent-id")
    parser.add_argument("--agent-name")
    parser.add_argument("--task-id")
    args = parser.parse_args()

    client = MissionControlEventClient()
    producer = BrowserRuntimeProducer(
        client=client,
        session_id=args.session_id,
        runtime_id=args.runtime_id,
        runtime_label=args.runtime_label,
        agent_id=args.agent_id,
        agent_name=args.agent_name,
        task_id=args.task_id,
    )
    if args.event == "started":
        result = producer.session_started(args.title, args.url)
    elif args.event == "navigation":
        result = producer.navigated(args.url or "", args.title, args.summary)
    elif args.event == "screenshot":
        result = producer.screenshot_captured(url=args.url, title=args.title or "Browser screenshot", summary=args.summary)
    elif args.event == "approval":
        result = producer.before_external_action(args.action_type, args.url, args.title, args.summary)
    elif args.event == "final":
        result = producer.final_evidence(args.url, args.title or "Final browser evidence", args.summary)
    elif args.event == "failed":
        result = producer.failed(args.summary or "Browser runtime failed", args.url)
    else:
        result = producer.poll_controls()
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
