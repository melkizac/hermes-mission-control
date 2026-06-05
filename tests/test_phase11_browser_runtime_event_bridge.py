from pathlib import Path
import importlib.util

ROOT = Path('/opt/hermes-mission-control')
SRC = ROOT / 'source' / 'src'
APP_PATH = ROOT / 'app.py'


def read(path):
    return Path(path).read_text(encoding='utf-8')


def load_app():
    spec = importlib.util.spec_from_file_location('hmc_phase11_app', APP_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_phase11_runtime_event_ingest_persists_live_browser_session(tmp_path):
    app = load_app()
    app.BROWSER_EVENTS_FILE = tmp_path / 'browser-events.json'

    result, status = app.ingest_browser_runtime_event({
        'sessionId': 'browser-live-linkedin-1',
        'title': 'LinkedIn ICP research',
        'status': 'active',
        'agentId': 'linkedin-growth',
        'agentName': 'LinkedIn Growth',
        'runtimeId': 'browserbase',
        'runtimeLabel': 'Browserbase cloud browser',
        'currentUrl': 'https://www.linkedin.com/feed/update/urn:li:activity:123',
        'action': {'type': 'navigation', 'title': 'Opened LinkedIn feed', 'summary': 'Agent opened a public feed item.'},
        'screenshot': {'url': 'https://evidence.example/shot-1.png', 'title': 'LinkedIn feed screenshot'},
        'accountSensitive': True,
        'taskId': 'linkedin-task-123',
    })

    assert status == 202
    assert result['ok'] is True
    payload = app.browser_sessions_payload()
    session = next(item for item in payload['sessions'] if item['id'] == 'browser-live-linkedin-1')
    assert session['status'] == 'active'
    assert session['source'] == 'runtime-event-bridge'
    assert session['currentDomain'] == 'linkedin.com'
    assert session['currentUrl'].startswith('https://www.linkedin.com/')
    assert session['accountSensitive'] is True
    assert session['screenshot']['url'] == 'https://evidence.example/shot-1.png'
    assert session['actionLog'][-1]['title'] == 'Opened LinkedIn feed'
    assert any(item.get('sourceId') == 'linkedin-task-123' for item in session['evidence'])
    assert payload['summary']['liveRuntimeEvents'] >= 1


def test_phase11_submit_post_send_purchase_events_are_approval_gated(tmp_path):
    app = load_app()
    app.BROWSER_EVENTS_FILE = tmp_path / 'browser-events.json'

    result, status = app.ingest_browser_runtime_event({
        'sessionId': 'browser-live-submit-1',
        'title': 'Website funnel test',
        'currentUrl': 'https://client.example/contact',
        'action': {'type': 'submit', 'title': 'Attempted lead form submit', 'summary': 'Agent reached submit boundary.'},
        'approvalRequired': False,
    })

    assert status == 202
    session, detail_status = app.browser_session_detail('browser-live-submit-1')
    assert detail_status == 200
    assert session['approvalRequired'] is True
    assert 'submit/post/send/purchase' in session['approvalReason']
    assert session['actionLog'][-1]['approvalRequired'] is True
    assert session['actionLog'][-1]['risk'] == 'external-facing'
    assert session['status'] == 'blocked'


def test_phase11_runtime_stop_and_takeover_are_persisted_as_control_events(tmp_path):
    app = load_app()
    app.BROWSER_EVENTS_FILE = tmp_path / 'browser-events.json'
    app.ingest_browser_runtime_event({'sessionId': 'browser-live-control-1', 'currentUrl': 'https://example.com', 'status': 'active'})

    stopped, stop_status = app.stop_browser_session('browser-live-control-1')
    assert stop_status == 200
    assert stopped['status'] == 'stopped'
    session, _ = app.browser_session_detail('browser-live-control-1')
    assert session['status'] == 'stopped'
    assert session['stopAvailable'] is False
    assert session['actionLog'][-1]['type'] == 'stop'

    app.ingest_browser_runtime_event({'sessionId': 'browser-live-control-2', 'currentUrl': 'https://example.com', 'status': 'active'})
    takeover, takeover_status = app.takeover_browser_session('browser-live-control-2')
    assert takeover_status == 200
    assert takeover['status'] == 'takeover_ready'
    session, _ = app.browser_session_detail('browser-live-control-2')
    assert session['status'] == 'blocked'
    assert session['takeoverAvailable'] is False
    assert session['actionLog'][-1]['type'] == 'takeover'


def test_phase11_api_and_frontend_contracts_expose_event_bridge():
    app_text = read(APP_PATH)
    types = read(SRC / 'types.ts')
    client = read(SRC / 'services' / 'hermesClient.ts')
    http = read(SRC / 'services' / 'httpHermesClient.ts')
    view = read(SRC / 'views' / 'BrowserOperations.tsx')

    for needle in [
        'BROWSER_EVENTS_FILE',
        'def ingest_browser_runtime_event',
        "if parsed.path == '/api/browser-sessions/events'",
        "method: \"POST\"",
    ]:
        assert needle in app_text or needle in http
    assert 'source?: "simulated" | "runtime-event-bridge" | string' in types
    assert 'liveRuntimeEvents: number' in types
    assert 'ingestBrowserRuntimeEvent' in client
    assert 'request<BrowserRuntimeEventIngestResponse>("/api/browser-sessions/events"' in http
    assert 'Runtime event bridge' in view
    assert 'liveRuntimeEvents' in view
