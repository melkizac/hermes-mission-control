import importlib.util
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest

WRAPPER_PATH = Path(__file__).resolve().parents[1] / "scripts" / "open_notebook_wrapper.py"
spec = importlib.util.spec_from_file_location("open_notebook_wrapper", WRAPPER_PATH)
assert spec is not None and spec.loader is not None
open_notebook_wrapper = importlib.util.module_from_spec(spec)
import sys
sys.modules["open_notebook_wrapper"] = open_notebook_wrapper
spec.loader.exec_module(open_notebook_wrapper)


class FakeOpenNotebookHandler(BaseHTTPRequestHandler):
    requests = []

    def _read_json(self):
        raw = self.rfile.read(int(self.headers.get("Content-Length", "0") or 0))
        if not raw:
            return None
        if self.headers.get("Content-Type", "").startswith("application/json"):
            return json.loads(raw.decode("utf-8"))
        return {"rawPrefix": raw[:80].decode("utf-8", "replace"), "contentType": self.headers.get("Content-Type")}

    def _send(self, payload, status=200):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        self.__class__.requests.append({"method": "GET", "path": self.path, "auth": self.headers.get("Authorization")})
        if self.path.startswith("/health"):
            self._send({"status": "ok"})
        elif self.path.startswith("/sources"):
            self._send([{"id": "source:alpha", "title": "Alpha Brief", "status": "completed", "embedded": True, "updated": "now"}])
        elif self.path.startswith("/notes"):
            self._send([{"id": "note:one", "title": "Note", "content": "source:alpha", "note_type": "human"}])
        elif self.path.startswith("/notebooks"):
            self._send([{"id": "notebook:demo", "name": "Demo"}])
        else:
            self._send({"detail": "missing"}, 404)

    def do_POST(self):
        body = self._read_json()
        self.__class__.requests.append({"method": "POST", "path": self.path, "auth": self.headers.get("Authorization"), "body": body})
        if self.path == "/sources/json":
            assert isinstance(body, dict)
            self._send({"id": "source:new", "title": body.get("title"), "type": body.get("type"), "content": body.get("content")})
        elif self.path == "/search":
            assert isinstance(body, dict)
            self._send({"results": [{"source_id": "source:new", "text": "hit"}], "total_count": 1, "search_type": body.get("type")})
        elif self.path == "/notes":
            assert isinstance(body, dict)
            self._send({"id": "note:new", "title": body.get("title"), "content": body.get("content"), "note_type": "human"})
        elif self.path == "/sources":
            self._send({"id": "source:file", "title": "uploaded"})
        else:
            self._send({"ok": True, "echo": body})

    def log_message(self, *args, **kwargs):
        return


def run_server():
    FakeOpenNotebookHandler.requests = []
    server = ThreadingHTTPServer(("127.0.0.1", 0), FakeOpenNotebookHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server


def test_wrapper_health_uses_bearer_without_leaking_secret(monkeypatch):
    server = run_server()
    monkeypatch.setenv("HMC_OPEN_NOTEBOOK_BASE_URL", f"http://127.0.0.1:{server.server_port}")
    monkeypatch.setenv("HMC_OPEN_NOTEBOOK_PASSWORD", "secret-password")

    try:
        result = open_notebook_wrapper.run_action(open_notebook_wrapper.build_parser().parse_args(["health"]))
    finally:
        server.shutdown()

    assert result["ok"] is True
    assert result["data"]["status"] == "ok"
    assert FakeOpenNotebookHandler.requests[-1]["auth"] == "Bearer secret-password"
    redacted = open_notebook_wrapper.redact(result)
    assert "secret-password" not in json.dumps(redacted)


def test_ingest_text_posts_to_json_endpoint_with_safe_defaults(monkeypatch):
    server = run_server()
    monkeypatch.setenv("HMC_OPEN_NOTEBOOK_BASE_URL", f"http://127.0.0.1:{server.server_port}")
    monkeypatch.delenv("HMC_OPEN_NOTEBOOK_PASSWORD", raising=False)

    try:
        args = open_notebook_wrapper.build_parser().parse_args([
            "ingest-text",
            "--notebook-id", "notebook:demo",
            "--title", "Harmless dev source",
            "--content", "This is a harmless fixture source for wrapper verification.",
        ])
        result = open_notebook_wrapper.run_action(args)
    finally:
        server.shutdown()

    assert result["ok"] is True
    request = FakeOpenNotebookHandler.requests[-1]
    assert request["path"] == "/sources/json"
    assert request["body"]["type"] == "text"
    assert request["body"]["delete_source"] is False
    assert request["body"]["notebooks"] == ["notebook:demo"]
    assert result["evidence"]["contentChars"] > 0


def test_search_and_citation_map_return_structured_evidence(monkeypatch):
    server = run_server()
    monkeypatch.setenv("HMC_OPEN_NOTEBOOK_BASE_URL", f"http://127.0.0.1:{server.server_port}")

    try:
        search = open_notebook_wrapper.run_action(open_notebook_wrapper.build_parser().parse_args(["search", "--query", "alpha", "--limit", "5"]))
        citation = open_notebook_wrapper.run_action(open_notebook_wrapper.build_parser().parse_args(["citation-map", "--notebook-id", "notebook:demo"]))
    finally:
        server.shutdown()

    assert search["ok"] is True
    assert search["data"]["total_count"] == 1
    assert citation["ok"] is True
    assert citation["data"]["citations"][0]["sourceId"] == "source:alpha"
    assert citation["data"]["notes"][0]["id"] == "note:one"


def test_wrapper_rejects_unsafe_urls_and_outside_files(tmp_path, monkeypatch):
    with pytest.raises(ValueError, match="http"):
        open_notebook_wrapper.validate_http_url("file:///etc/passwd")
    with pytest.raises(ValueError, match="credentials"):
        open_notebook_wrapper.validate_http_url("https://user:pass@example.com/source")

    secret_file = tmp_path / "secret.txt"
    secret_file.write_text("nope", encoding="utf-8")
    monkeypatch.setenv("HMC_OPEN_NOTEBOOK_ALLOWED_FILE_ROOTS", str(tmp_path / "allowed"))
    with pytest.raises(ValueError, match="outside"):
        open_notebook_wrapper.validate_file_path(str(secret_file))
