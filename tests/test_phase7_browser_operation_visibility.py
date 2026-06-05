from pathlib import Path

ROOT = Path('/opt/hermes-mission-control')
SRC = ROOT / 'source' / 'src'
APP = ROOT / 'app.py'


def read(path):
    return Path(path).read_text(encoding='utf-8')


def test_browser_session_contract_covers_operator_visibility_fields():
    types = read(SRC / 'types.ts')
    for field in [
        'currentDomain: string',
        'screenshot?: MissionArtifact | null',
        'evidence: EvidenceRecord[]',
        'actionLog: BrowserActionEvent[]',
        'accountSensitive: boolean',
        'approvalRequired: boolean',
        'stopAvailable: boolean',
        'takeoverAvailable: boolean',
    ]:
        assert field in types


def test_backend_browser_visibility_payload_has_required_runtime_controls_and_evidence():
    app = read(APP)
    assert "def browser_sessions_payload" in app
    assert "'currentDomain':" in app
    assert "'accountSensitive': True" in app
    assert "'approvalRequired': True" in app
    assert "submit/post/send/purchase" in app
    assert "'actionLog':" in app
    assert "'screenshot':" in app
    assert "final screenshot" in app.lower() or "finalScreenshot" in app
    assert "def takeover_browser_session" in app
    assert "/api/browser-sessions/" in app and "/takeover" in app
    assert "WINDOWS_HERMES_GATEWAY_URL" in app


def test_frontend_browser_activity_surface_exposes_takeover_approval_and_final_evidence():
    view = read(SRC / 'views' / 'BrowserOperations.tsx')
    nav = read(SRC / 'components' / 'NavRail.tsx')
    permissions = read(SRC / 'services' / 'uiPermissions.ts')
    for label in [
        'Current domain',
        'Latest screenshot',
        'Action log',
        'Approval gate',
        'account-sensitive',
        'Stop',
        'Takeover',
        'Final screenshot/link evidence',
    ]:
        assert label in view
    assert 'selected.evidence.map' in view
    assert 'takeoverSelected' in view
    assert 'data-testid="browser-session-card"' in view
    assert 'browser-session-card-top' in view
    assert 'browser-session-icon' in view
    assert 'browser-card-body' in view
    assert 'browser-card-meta' in view
    assert 'browser-card-footer' in view
    assert 'browser-card-open' in view
    assert 'data-testid="browser-operation-detail"' in view
    assert 'data-testid="browser-session-drawer"' in view
    assert 'Close browser session details' in view
    assert 'setSelected(null)' in view
    assert 'if (!selected && next.sessions[0]) setSelected(next.sessions[0])' not in view
    assert 'className="browser-session-detail"' not in view
    assert '{ key: "browser-ops", label: "Browser Activity"' in nav
    assert '"browser-ops",\n  "audit"' in permissions


def test_frontend_client_supports_browser_stop_and_takeover_actions():
    iface = read(SRC / 'services' / 'hermesClient.ts')
    http = read(SRC / 'services' / 'httpHermesClient.ts')
    mock = read(SRC / 'services' / 'mockHermesClient.ts')
    assert 'stopBrowserSession' in iface
    assert 'takeoverBrowserSession' in iface
    assert '/api/browser-sessions/${encodeURIComponent(id)}/stop' in http
    assert '/api/browser-sessions/${encodeURIComponent(id)}/takeover' in http
    assert 'async takeoverBrowserSession' in mock


def test_browser_activity_layout_prevents_long_url_metric_cards_from_stretching():
    view = read(SRC / 'views' / 'BrowserOperations.tsx')
    styles = read(SRC / 'styles' / 'app.css')
    assert 'browser-detail-grid' in view
    assert 'browser-url-kv' in view
    assert '.browser-detail-grid' in styles
    assert '.browser-url-kv' in styles
    assert '.browser-session-drawer' in styles
    assert '.browser-session-scrim' in styles
    assert 'repeat(auto-fill, minmax(360px, 460px))' in styles
    assert 'max-width: 460px' in styles
    assert '.browser-session-icon' in styles
    assert '.browser-card-body' in styles
    assert '.browser-card-footer' in styles
    assert 'repeat(auto-fill, minmax(320px, 420px))' not in styles
    assert 'repeat(auto-fit, minmax(300px, 1fr))' not in styles
    assert 'grid-template-columns: minmax(280px, 0.8fr) minmax(0, 1.2fr)' not in styles
    assert 'grid-column: 1 / -1' in styles
    assert 'white-space: nowrap' in styles
    assert 'text-overflow: ellipsis' in styles
