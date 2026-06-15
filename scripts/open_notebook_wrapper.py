#!/usr/bin/env python3
"""Controlled Mission Control wrapper for lfnovo/open-notebook REST API.

The wrapper intentionally exposes narrow, auditable actions instead of giving
agents arbitrary API access. It supports safe source ingestion, search, notes,
citations/readback, and health checks for Research-to-Deliverable workflows.

Configuration:
  HMC_OPEN_NOTEBOOK_BASE_URL=http://127.0.0.1:5055
  HMC_OPEN_NOTEBOOK_PASSWORD or HMC_OPEN_NOTEBOOK_PASSWORD_FILE=<secret file>

All output is compact JSON. Secrets are never printed.
"""
from __future__ import annotations

import argparse
import json
import mimetypes
import os
import pathlib
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any

DEFAULT_BASE_URL = "http://127.0.0.1:5055"
MAX_TEXT_CHARS = int(os.environ.get("HMC_OPEN_NOTEBOOK_MAX_TEXT_CHARS", "200000"))
MAX_FILE_BYTES = int(os.environ.get("HMC_OPEN_NOTEBOOK_MAX_FILE_BYTES", str(25 * 1024 * 1024)))
REQUEST_TIMEOUT = float(os.environ.get("HMC_OPEN_NOTEBOOK_TIMEOUT_SECONDS", "20"))
SAFE_URL_SCHEMES = {"http", "https"}
ALLOWED_ACTIONS = {
    "health",
    "list-notebooks",
    "create-notebook",
    "list-sources",
    "ingest-text",
    "ingest-url",
    "upload-file",
    "source-status",
    "search",
    "ask",
    "list-notes",
    "create-note",
    "citation-map",
}
SECRET_RE = re.compile(r"(?i)(bearer\s+|password=|token=|api[_-]?key=|secret=)([^\s&]+)")


def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def redact(value: Any) -> Any:
    if isinstance(value, str):
        return SECRET_RE.sub(lambda m: m.group(1) + "[REDACTED]", value)
    if isinstance(value, list):
        return [redact(v) for v in value]
    if isinstance(value, dict):
        safe: dict[str, Any] = {}
        for k, v in value.items():
            if re.search(r"(?i)(password|token|secret|api[_-]?key|authorization|credential)", str(k)):
                safe[k] = "[REDACTED]"
            else:
                safe[k] = redact(v)
        return safe
    return value


def emit(payload: dict[str, Any], exit_code: int = 0) -> int:
    print(json.dumps(redact(payload), sort_keys=True, separators=(",", ":")))
    return exit_code


def read_secret_from_env(name: str) -> str | None:
    direct = os.environ.get(name)
    if direct:
        return direct.strip()
    file_path = os.environ.get(f"{name}_FILE")
    if file_path:
        try:
            p = pathlib.Path(file_path).expanduser().resolve()
            if not p.exists():
                raise FileNotFoundError(str(p))
            return p.read_text(encoding="utf-8").strip()
        except Exception as exc:  # do not print secret content
            raise RuntimeError(f"failed to read {name}_FILE: {exc}") from exc
    return None


@dataclass
class OpenNotebookConfig:
    base_url: str
    password: str | None

    @classmethod
    def from_env(cls) -> "OpenNotebookConfig":
        raw = os.environ.get("HMC_OPEN_NOTEBOOK_BASE_URL") or os.environ.get("OPEN_NOTEBOOK_API_BASE_URL") or DEFAULT_BASE_URL
        base_url = raw.rstrip("/")
        parsed = urllib.parse.urlparse(base_url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("HMC_OPEN_NOTEBOOK_BASE_URL must be an http(s) URL")
        password = read_secret_from_env("HMC_OPEN_NOTEBOOK_PASSWORD") or read_secret_from_env("OPEN_NOTEBOOK_PASSWORD")
        return cls(base_url=base_url, password=password)


class OpenNotebookClient:
    def __init__(self, config: OpenNotebookConfig, timeout: float = REQUEST_TIMEOUT):
        self.config = config
        self.timeout = timeout

    def request(self, method: str, path: str, payload: Any = None, query: dict[str, Any] | None = None, *, raw_body: bytes | None = None, content_type: str = "application/json") -> Any:
        path = path if path.startswith("/") else f"/{path}"
        url = self.config.base_url + path
        if query:
            clean_query = {k: v for k, v in query.items() if v is not None}
            if clean_query:
                url += "?" + urllib.parse.urlencode(clean_query)
        headers = {"User-Agent": "hmc-open-notebook-wrapper/1.0"}
        data = None
        if raw_body is not None:
            data = raw_body
            headers["Content-Type"] = content_type
        elif payload is not None:
            data = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"
        if self.config.password:
            headers["Authorization"] = f"Bearer {self.config.password}"
        req = urllib.request.Request(url, data=data, headers=headers, method=method.upper())
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                body = resp.read()
                if not body:
                    return {"status": resp.status}
                ctype = resp.headers.get("Content-Type", "")
                if "json" in ctype:
                    return json.loads(body.decode("utf-8"))
                return {"status": resp.status, "body": body.decode("utf-8", "replace")[:2000]}
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", "replace")[:2000]
            raise RuntimeError(f"Open Notebook HTTP {exc.code}: {body}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Open Notebook connection failed: {exc.reason}") from exc

    def health(self) -> Any:
        return self.request("GET", "/health")


def validate_notebook_id(value: str | None) -> str | None:
    if value is None or value == "":
        return None
    if not re.fullmatch(r"[A-Za-z0-9_:\-.]{1,160}", value):
        raise ValueError("notebook_id contains unsupported characters")
    return value


def validate_source_id(value: str | None) -> str:
    if not value:
        raise ValueError("source_id is required")
    if not re.fullmatch(r"[A-Za-z0-9_:\-.]{1,180}", value):
        raise ValueError("source_id contains unsupported characters")
    return value


def validate_http_url(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in SAFE_URL_SCHEMES or not parsed.netloc:
        raise ValueError("source URL must be http(s) with a host")
    if parsed.username or parsed.password:
        raise ValueError("source URL must not embed credentials")
    return url


def allowed_file_roots() -> list[pathlib.Path]:
    raw = os.environ.get("HMC_OPEN_NOTEBOOK_ALLOWED_FILE_ROOTS") or os.environ.get("HMC_UPLOAD_DIR") or "/opt/hermes-mission-control/uploads"
    roots = []
    for part in raw.split(os.pathsep):
        if part.strip():
            roots.append(pathlib.Path(part).expanduser().resolve())
    return roots


def validate_file_path(path: str) -> pathlib.Path:
    candidate = pathlib.Path(path).expanduser().resolve()
    if not candidate.exists() or not candidate.is_file():
        raise ValueError("file path does not exist or is not a regular file")
    size = candidate.stat().st_size
    if size > MAX_FILE_BYTES:
        raise ValueError(f"file exceeds wrapper limit of {MAX_FILE_BYTES} bytes")
    roots = allowed_file_roots()
    if not any(candidate == root or root in candidate.parents for root in roots):
        raise ValueError("file path is outside HMC_OPEN_NOTEBOOK_ALLOWED_FILE_ROOTS")
    return candidate


def bounded_text(text: str) -> str:
    if not text.strip():
        raise ValueError("content is empty")
    if len(text) > MAX_TEXT_CHARS:
        raise ValueError(f"content exceeds wrapper limit of {MAX_TEXT_CHARS} characters")
    return text


def source_payload(args: argparse.Namespace, source_type: str) -> dict[str, Any]:
    notebooks = [validate_notebook_id(args.notebook_id)] if args.notebook_id else []
    payload: dict[str, Any] = {
        "type": source_type,
        "notebooks": notebooks,
        "title": args.title,
        "transformations": [],
        "embed": bool(args.embed),
        "delete_source": False,
        "async_processing": bool(args.async_processing),
    }
    return {k: v for k, v in payload.items() if v is not None}


def multipart_upload_body(fields: dict[str, str], file_path: pathlib.Path) -> tuple[bytes, str]:
    boundary = f"hmc-open-notebook-{time.time_ns()}"
    parts: list[bytes] = []
    for key, value in fields.items():
        parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{key}\"\r\n\r\n{value}\r\n".encode())
    filename = file_path.name.replace('"', '')
    mime = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
    parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\nContent-Type: {mime}\r\n\r\n".encode())
    parts.append(file_path.read_bytes())
    parts.append(f"\r\n--{boundary}--\r\n".encode())
    return b"".join(parts), f"multipart/form-data; boundary={boundary}"


def run_action(args: argparse.Namespace) -> dict[str, Any]:
    if args.action not in ALLOWED_ACTIONS:
        raise ValueError(f"unsupported action: {args.action}")
    cfg = OpenNotebookConfig.from_env()
    client = OpenNotebookClient(cfg, timeout=args.timeout)

    evidence: dict[str, Any] = {
        "wrapper": "hmc-open-notebook-wrapper",
        "action": args.action,
        "baseUrl": cfg.base_url,
        "authConfigured": bool(cfg.password),
        "checkedAt": now_iso(),
    }

    if args.action == "health":
        data = client.health()
        return {"ok": True, "summary": "Open Notebook health endpoint responded.", "data": data, "evidence": evidence}

    if args.action == "list-notebooks":
        data = client.request("GET", "/notebooks", query={"archived": args.archived, "order_by": args.order_by})
        return {"ok": True, "summary": f"Fetched {len(data) if isinstance(data, list) else 0} notebooks.", "data": data, "evidence": evidence}

    if args.action == "create-notebook":
        if not args.title:
            raise ValueError("--title is required")
        payload = {"name": args.title, "description": args.description or "Created by Mission Control Open Notebook wrapper"}
        data = client.request("POST", "/notebooks", payload=payload)
        return {"ok": True, "summary": "Notebook created.", "data": data, "evidence": evidence}

    if args.action == "list-sources":
        data = client.request("GET", "/sources", query={"notebook_id": validate_notebook_id(args.notebook_id), "limit": args.limit, "offset": args.offset})
        return {"ok": True, "summary": f"Fetched {len(data) if isinstance(data, list) else 0} sources.", "data": data, "evidence": evidence}

    if args.action == "ingest-text":
        content = bounded_text(args.content if args.content is not None else pathlib.Path(args.content_file).read_text(encoding="utf-8"))
        payload = source_payload(args, "text")
        payload["content"] = content
        data = client.request("POST", "/sources/json", payload=payload)
        return {"ok": True, "summary": "Text source submitted to Open Notebook.", "data": data, "evidence": {**evidence, "contentChars": len(content)}}

    if args.action == "ingest-url":
        payload = source_payload(args, "link")
        payload["url"] = validate_http_url(args.url)
        data = client.request("POST", "/sources/json", payload=payload)
        return {"ok": True, "summary": "URL source submitted to Open Notebook.", "data": data, "evidence": {**evidence, "sourceUrl": payload["url"]}}

    if args.action == "upload-file":
        file_path = validate_file_path(args.file)
        fields = {
            "type": "upload",
            "notebooks": json.dumps([args.notebook_id] if args.notebook_id else []),
            "title": args.title or file_path.name,
            "transformations": "[]",
            "embed": "true" if args.embed else "false",
            "delete_source": "false",
            "async_processing": "true" if args.async_processing else "false",
        }
        body, ctype = multipart_upload_body(fields, file_path)
        data = client.request("POST", "/sources", raw_body=body, content_type=ctype)
        return {"ok": True, "summary": "File source uploaded to Open Notebook.", "data": data, "evidence": {**evidence, "fileName": file_path.name, "fileBytes": file_path.stat().st_size}}

    if args.action == "source-status":
        sid = validate_source_id(args.source_id)
        data = client.request("GET", f"/sources/{urllib.parse.quote(sid, safe=':')}/status")
        return {"ok": True, "summary": "Source status fetched.", "data": data, "evidence": evidence}

    if args.action == "search":
        if not args.query:
            raise ValueError("--query is required")
        payload = {"query": args.query, "type": args.search_type, "limit": args.limit, "search_sources": True, "search_notes": True, "minimum_score": args.minimum_score}
        data = client.request("POST", "/search", payload=payload)
        return {"ok": True, "summary": "Search completed.", "data": data, "evidence": evidence}

    if args.action == "ask":
        required = [args.query, args.strategy_model, args.answer_model, args.final_answer_model]
        if not all(required):
            raise ValueError("--query, --strategy-model, --answer-model, and --final-answer-model are required")
        payload = {"question": args.query, "strategy_model": args.strategy_model, "answer_model": args.answer_model, "final_answer_model": args.final_answer_model}
        data = client.request("POST", "/search/ask", payload=payload)
        return {"ok": True, "summary": "Ask request submitted.", "data": data, "evidence": evidence}

    if args.action == "list-notes":
        data = client.request("GET", "/notes", query={"notebook_id": validate_notebook_id(args.notebook_id)})
        return {"ok": True, "summary": f"Fetched {len(data) if isinstance(data, list) else 0} notes.", "data": data, "evidence": evidence}

    if args.action == "create-note":
        content = bounded_text(args.content if args.content is not None else pathlib.Path(args.content_file).read_text(encoding="utf-8"))
        payload = {"title": args.title, "content": content, "note_type": "human", "notebook_id": validate_notebook_id(args.notebook_id)}
        data = client.request("POST", "/notes", payload=payload)
        return {"ok": True, "summary": "Human note created.", "data": data, "evidence": {**evidence, "contentChars": len(content)}}

    if args.action == "citation-map":
        sources = client.request("GET", "/sources", query={"notebook_id": validate_notebook_id(args.notebook_id), "limit": args.limit, "offset": args.offset})
        notes = client.request("GET", "/notes", query={"notebook_id": validate_notebook_id(args.notebook_id)})
        citations = []
        for idx, src in enumerate(sources if isinstance(sources, list) else [], start=1):
            citations.append({
                "citationId": f"src-{idx}",
                "sourceId": src.get("id"),
                "title": src.get("title") or src.get("id"),
                "status": src.get("status"),
                "embedded": src.get("embedded"),
                "updated": src.get("updated"),
            })
        return {"ok": True, "summary": f"Built citation map with {len(citations)} sources and {len(notes) if isinstance(notes, list) else 0} notes.", "data": {"citations": citations, "notes": notes}, "evidence": evidence}

    raise ValueError("unreachable action")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Controlled Open Notebook REST API wrapper for Mission Control")
    parser.add_argument("action", choices=sorted(ALLOWED_ACTIONS))
    parser.add_argument("--timeout", type=float, default=REQUEST_TIMEOUT)
    parser.add_argument("--notebook-id")
    parser.add_argument("--source-id")
    parser.add_argument("--title")
    parser.add_argument("--description")
    parser.add_argument("--content")
    parser.add_argument("--content-file")
    parser.add_argument("--url")
    parser.add_argument("--file")
    parser.add_argument("--query")
    parser.add_argument("--search-type", choices=["text", "vector"], default="text")
    parser.add_argument("--strategy-model")
    parser.add_argument("--answer-model")
    parser.add_argument("--final-answer-model")
    parser.add_argument("--limit", type=int, default=50)
    parser.add_argument("--offset", type=int, default=0)
    parser.add_argument("--minimum-score", type=float, default=0.2)
    parser.add_argument("--order-by", default="updated desc")
    parser.add_argument("--archived", choices=["true", "false"])
    parser.add_argument("--embed", action="store_true")
    parser.add_argument("--async-processing", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.limit < 1 or args.limit > 1000:
        return emit({"ok": False, "error": "--limit must be between 1 and 1000"}, 2)
    if args.archived is not None:
        args.archived = args.archived == "true"
    try:
        return emit(run_action(args), 0)
    except Exception as exc:
        return emit({"ok": False, "error": str(exc), "action": args.action, "evidence": {"wrapper": "hmc-open-notebook-wrapper", "checkedAt": now_iso()}}, 1)


if __name__ == "__main__":
    raise SystemExit(main())
