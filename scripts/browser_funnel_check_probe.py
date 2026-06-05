#!/usr/bin/env python3
"""Safe website funnel-check probe wired to Mission Control Browser Activity.

Phase 13 connects a real Playwright browser job to the Phase 12 producer client.
The probe opens a safe public page, captures a screenshot, detects lead/contact
forms, and emits an approval-gated submit boundary without submitting anything.

Safety invariant: NO_SUBMIT. The helper only inspects forms/buttons; it never
clicks submit, post, send, purchase, or upload controls.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict
from urllib.parse import urlparse

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from browser_runtime_producer import BrowserRuntimeProducer, MissionControlEventClient

NO_SUBMIT = True
HELPER = SCRIPT_DIR / "browser_funnel_check_playwright.cjs"
DEFAULT_SCREENSHOT_DIR = Path("/opt/hermes-mission-control/uploads/browser-funnel-checks")
BLOCKED_HOST_PARTS = {
    "linkedin.com",
    "accounts.google.com",
    "google.com",
    "gmail.com",
    "facebook.com",
    "x.com",
    "twitter.com",
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
}


def safe_domain(url: str) -> str:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if host.startswith("www."):
        host = host[4:]
    return host


def ensure_safe_target(url: str) -> str:
    """Allow only public http(s) targets for a safe public website funnel check."""
    parsed = urlparse(str(url or ""))
    host = (parsed.hostname or "").lower()
    scheme = parsed.scheme.lower()
    blocked = (
        scheme not in {"http", "https"}
        or not host
        or any(host == item or host.endswith("." + item) for item in BLOCKED_HOST_PARTS)
        or re.match(r"^(10\.|172\.(1[6-9]|2\d|3[0-1])\.|192\.168\.)", host)
    )
    if blocked:
        raise ValueError("Target is not allowed for a safe public website funnel check. Use a public non-account-sensitive website URL.")
    return url


def run_playwright_probe(url: str, screenshot_dir: Path, timeout_ms: int = 20000) -> Dict[str, Any]:
    if not HELPER.exists():
        raise RuntimeError(f"Playwright helper not found: {HELPER}")
    screenshot_dir.mkdir(parents=True, exist_ok=True)
    proc = subprocess.run(
        ["node", str(HELPER), url, str(screenshot_dir), str(timeout_ms)],
        cwd=str(SCRIPT_DIR.parent),
        text=True,
        capture_output=True,
        timeout=max(10, int(timeout_ms / 1000) + 15),
    )
    raw = (proc.stdout or "").strip().splitlines()[-1] if proc.stdout.strip() else "{}"
    try:
        result = json.loads(raw)
    except Exception as exc:
        raise RuntimeError(f"Playwright helper returned non-JSON output: {proc.stdout or proc.stderr}") from exc
    if proc.returncode != 0 or not result.get("ok"):
        raise RuntimeError(result.get("error") or proc.stderr or "Playwright funnel probe failed")
    return result


def run_funnel_check(url: str, producer: BrowserRuntimeProducer, screenshot_dir: Path = DEFAULT_SCREENSHOT_DIR, timeout_ms: int = 20000) -> Dict[str, Any]:
    url = ensure_safe_target(url)
    producer.session_started("Website funnel check", url)
    producer.poll_controls()
    result = run_playwright_probe(url, screenshot_dir, timeout_ms)
    final_url = result.get("finalUrl") or url
    forms_value = result.get("forms")
    forms = forms_value if isinstance(forms_value, list) else []
    submit_candidates = int(result.get("submitCandidates") or 0)
    screenshot_path = result.get("screenshotPath")

    producer.navigated(final_url, title=f"Opened {safe_domain(final_url)}", summary=f"Loaded page title: {result.get('title') or 'Untitled'}")
    if screenshot_path:
        producer.screenshot_captured(path=screenshot_path, title="Funnel check screenshot", summary="Real Playwright screenshot captured without submitting the form.")
    producer.final_evidence(final_url, title="Funnel check final URL", summary="Real browser probe reached final URL and captured form evidence without submitting.")

    if forms or submit_candidates:
        producer.before_external_action("submit", final_url, title="Lead form submit boundary detected", summary="A form/submit control was detected. Probe stopped before submit and requires operator approval before any real submission.")
        status = "blocked_before_submit"
    else:
        status = "completed_no_form_submit_boundary"

    return {
        "ok": True,
        "status": status,
        "url": url,
        "finalUrl": final_url,
        "domain": safe_domain(final_url),
        "title": result.get("title"),
        "screenshotPath": screenshot_path,
        "formsDetected": len(forms),
        "submitCandidates": submit_candidates,
        "noSubmit": bool(result.get("noSubmit", True)) and NO_SUBMIT,
    }


def build_producer(session_id: str, task_id: str | None = None) -> BrowserRuntimeProducer:
    client = MissionControlEventClient()
    return BrowserRuntimeProducer(
        client=client,
        session_id=session_id,
        runtime_id="playwright-funnel-check",
        runtime_label="Playwright safe website funnel check",
        agent_id="melkizac",
        agent_name="Melkizac",
        task_id=task_id,
        metadata={"phase": "13", "safety": "NO_SUBMIT"},
    )


def _main() -> int:
    parser = argparse.ArgumentParser(description="Run a safe no-submit website funnel check and publish browser events to Mission Control.")
    parser.add_argument("--url", required=True)
    parser.add_argument("--session-id", required=True)
    parser.add_argument("--task-id")
    parser.add_argument("--screenshot-dir", default=str(DEFAULT_SCREENSHOT_DIR))
    parser.add_argument("--timeout-ms", type=int, default=20000)
    args = parser.parse_args()
    producer = build_producer(args.session_id, args.task_id)
    summary = run_funnel_check(args.url, producer, Path(args.screenshot_dir), args.timeout_ms)
    print(json.dumps(summary, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
