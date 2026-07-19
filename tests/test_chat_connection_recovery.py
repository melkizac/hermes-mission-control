from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HTTP_CLIENT = (ROOT / "src/services/httpHermesClient.ts").read_text(encoding="utf-8")
APP_TSX = (ROOT / "src/App.tsx").read_text(encoding="utf-8")
BACKEND = (ROOT / "backend/app.py").read_text(encoding="utf-8")


def test_safe_get_requests_retry_transient_connection_failures():
    assert "class HttpRequestError" in HTTP_CLIENT
    assert "isRetryableConnectionError" in HTTP_CLIENT
    assert "retryingJsonRequest" in HTTP_CLIENT
    assert "attempts: 3" in HTTP_CLIENT
    assert "timeoutMs: 20_000" in HTTP_CLIENT


def test_chat_submission_recovers_by_request_id_without_resubmitting():
    assert "submissionUncertain" in HTTP_CLIENT
    assert "Do not repeat the POST" in HTTP_CLIENT
    assert "consecutivePollFailures" in HTTP_CLIENT
    assert "continue;" in HTTP_CLIENT
    assert "Could not confirm that the message reached Mission Control" in HTTP_CLIENT


def test_status_polling_remains_abortable_and_has_a_bounded_request_timeout():
    assert "options.signal" in HTTP_CLIENT
    assert "timeoutMs: 10_000" in HTTP_CLIENT
    assert "if (options.signal?.aborted) throw err" in HTTP_CLIENT


def test_global_approval_badge_uses_summary_instead_of_one_megabyte_inbox():
    assert "/api/inbox?mode=summary" in APP_TSX
    assert "summary_only = mode == 'summary'" in BACKEND
    assert "'items': [] if summary_only" in BACKEND


def test_chat_project_picker_avoids_the_full_project_aggregation_path():
    assert '"/api/projects?mode=picker"' in (ROOT / "src/views/MissionControl.tsx").read_text(encoding="utf-8")
    assert "def project_picker_payload" in BACKEND
    assert "if project_mode == 'picker'" in BACKEND
