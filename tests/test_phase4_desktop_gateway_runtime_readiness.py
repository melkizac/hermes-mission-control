from pathlib import Path

ROOT = Path('/opt/hermes-mission-control')
SRC = ROOT / 'source' / 'src'
APP = ROOT / 'app.py'


def src(rel):
    return (SRC / rel).read_text(encoding='utf-8')


def app_py():
    return APP.read_text(encoding='utf-8')


def test_phase4_types_define_desktop_gateway_readiness_contracts():
    types = src('types.ts')

    for needle in [
        'export interface GatewayHealthProbe',
        'export interface DesktopGatewayExecutionTarget',
        'export interface DesktopGatewayStatus',
        'export interface WindowsGatewayConfigResponse',
        'executionBoundary',
        'readinessSummary',
        'approvalRequired: boolean;',
        'getDesktopGateway(): Promise<DesktopGatewayStatus>;',
        'saveWindowsGatewayConfig(input:',
    ]:
        assert needle in types or needle in src('services/hermesClient.ts')


def test_phase4_backend_desktop_gateway_is_readiness_first_and_secret_safe():
    app = app_py()

    for needle in [
        'def desktop_gateway_status',
        'def windows_gateway_status',
        'def save_windows_gateway_config',
        "'/api/desktop-gateway'",
        "'/api/windows-gateway/config'",
        "'executionBoundary'",
        "'readinessSummary'",
        "'approvalRequired'",
        "'probe'",
    ]:
        assert needle in app

    # Neither live nor demo status endpoints must expose a full dashboard session token.
    assert "'sessionToken': token" not in app
    assert "'sessionToken':'[REDACTED]'" not in app
    assert 'sessionTokenPreview' in app
    assert "'executionBoundary'" in app


def test_phase4_frontend_desktop_gateway_uses_live_api_and_execution_boundaries():
    page = src('views/AdminSetupPage.tsx')
    client = src('services/httpHermesClient.ts')
    contract = src('services/hermesClient.ts')
    mock = src('services/mockHermesClient.ts')
    styles = src('styles/app.css')

    for needle in [
        'client.getDesktopGateway',
        'client.saveWindowsGatewayConfig',
        'Execution boundary',
        'Readiness summary',
        'Run on VPS',
        'Run on Windows Desktop',
        'Approved folders',
        'Test connection',
        'WINDOWS_HERMES_GATEWAY_URL',
    ]:
        assert needle in page

    assert 'async getDesktopGateway' in client
    assert 'async saveWindowsGatewayConfig' in client
    assert 'getDesktopGateway(): Promise<DesktopGatewayStatus>;' in contract
    assert 'saveWindowsGatewayConfig(input:' in contract
    assert 'async getDesktopGateway' in mock
    assert '.desktop-gateway-live' in styles
    assert '.desktop-target-card' in styles
