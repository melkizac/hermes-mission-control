from pathlib import Path

ROOT = Path('/opt/hermes-mission-control')
SRC = ROOT / 'source' / 'src'
APP = ROOT / 'app.py'


def src(rel):
    return (SRC / rel).read_text(encoding='utf-8')


def app_py():
    return APP.read_text(encoding='utf-8')


def test_phase5_types_and_client_define_browser_operation_contracts():
    types = src('types.ts')
    contract = src('services/hermesClient.ts')
    http = src('services/httpHermesClient.ts')
    mock = src('services/mockHermesClient.ts')

    for needle in [
        'export interface BrowserActionEvent',
        'export interface BrowserSession',
        'export interface BrowserSessionsResponse',
        'risk: RiskLevel;',
        'approvalRequired: boolean;',
        'screenshot',
        'currentDomain',
        'listBrowserSessions(): Promise<BrowserSessionsResponse>;',
        'getBrowserSession(id: string): Promise<BrowserSession | undefined>;',
        'stopBrowserSession(id: string): Promise<',
    ]:
        assert needle in types or needle in contract

    assert 'async listBrowserSessions' in http
    assert 'async getBrowserSession' in http
    assert 'async stopBrowserSession' in http
    assert 'async listBrowserSessions' in mock


def test_phase5_backend_exposes_browser_sessions_without_overstating_windows_readiness():
    app = app_py()

    for needle in [
        'def browser_sessions_payload',
        'def browser_session_detail',
        'def stop_browser_session',
        "'/api/browser-sessions'",
        "'/api/browser-sessions/'",
        "'currentDomain'",
        "'approvalRequired'",
        "'accountSensitive'",
        "'screenshot'",
        "'actionLog'",
        "'executionTarget'",
        "'WINDOWS_HERMES_GATEWAY_URL is not configured",
    ]:
        assert needle in app

    assert "'windowsReady': windows_ready" in app
    assert "'Windows-local execution is blocked until WINDOWS_HERMES_GATEWAY_URL is configured.'" in app


def test_phase5_frontend_renders_browser_activity_page_and_navigation():
    view = src('views/BrowserOperations.tsx')
    app = src('App.tsx')
    nav = src('components/NavRail.tsx')
    permissions = src('services/uiPermissions.ts')
    styles = src('styles/app.css')

    for needle in [
        'Browser operation visibility',
        'client.listBrowserSessions',
        'client.getBrowserSession',
        'client.stopBrowserSession',
        'Current domain',
        'Latest screenshot',
        'Action log',
        'Approval gate',
        'Windows-local execution is blocked',
    ]:
        assert needle in view

    assert 'view === "browser-ops"' in app
    assert 'Browser Activity' in nav
    assert '"browser-ops"' in permissions
    assert '.browser-ops-page' in styles
    assert '.browser-session-card' in styles
