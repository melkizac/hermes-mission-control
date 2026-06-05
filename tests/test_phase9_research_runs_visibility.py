from pathlib import Path
import importlib.util

ROOT = Path('/opt/hermes-mission-control')
SRC = ROOT / 'source' / 'src'
APP_PATH = ROOT / 'app.py'


def read(path):
    return Path(path).read_text(encoding='utf-8')


def load_app():
    spec = importlib.util.spec_from_file_location('hmc_phase9_app', APP_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_phase9_research_runs_api_payload_has_parallel_lanes_and_synthesis_evidence():
    app = load_app()
    payload = app.research_runs_payload()
    assert payload['summary']['total'] >= 1
    assert payload['summary']['active_lanes'] >= 2
    assert payload['summary']['source_coverage'] >= 4
    run = payload['runs'][0]
    assert run['id'] == 'research-parallel-visibility-demo'
    assert 'parallel lanes' in run['summary'].lower()
    assert len(run['lanes']) >= 3
    assert {lane['status'] for lane in run['lanes']} >= {'running', 'completed', 'blocked'}
    assert len(run['sourceCoverage']) >= 4
    assert run['synthesis']['status'] in {'drafting', 'ready', 'blocked'}
    assert run['evidence']
    assert run['finalArtifact']['title'] == 'Final synthesis / recommendation evidence'


def test_phase9_frontend_contract_client_and_mock_support_research_runs():
    types = read(SRC / 'types.ts')
    client = read(SRC / 'services' / 'hermesClient.ts')
    http = read(SRC / 'services' / 'httpHermesClient.ts')
    mock = read(SRC / 'services' / 'mockHermesClient.ts')
    for needle in ['ResearchRunLane', 'ResearchRun', 'ResearchRunsResponse', 'sourceCoverage', 'finalArtifact']:
        assert needle in types
    assert 'listResearchRuns(): Promise<ResearchRunsResponse>' in client
    assert 'request<ResearchRunsResponse>("/api/research-runs")' in http
    assert 'async listResearchRuns(): Promise<ResearchRunsResponse>' in mock
    assert 'research-parallel-visibility-demo' in mock


def test_phase9_research_runs_view_and_navigation_are_wired():
    view = SRC / 'views' / 'ResearchRuns.tsx'
    assert view.exists()
    text = read(view)
    for needle in [
        'export function ResearchRuns',
        'Research command center',
        'Parallel research lanes',
        'Source coverage',
        'Synthesis progress',
        'Final synthesis / recommendation evidence',
        'data-testid="research-run-card"',
        'data-testid="research-lane-card"',
        'data-testid="research-detail-drawer"',
        'Close research run details',
        'setDetailOpen(false)',
    ]:
        assert needle in text
    assert 'className="research-detail"' not in text
    app = read(SRC / 'App.tsx')
    nav = read(SRC / 'components' / 'NavRail.tsx')
    perms = read(SRC / 'services' / 'uiPermissions.ts')
    assert 'view === "research-runs" && <ResearchRuns />' in app
    assert '{ key: "research-runs", label: "Research Runs"' in nav
    assert '"research-runs"' in perms


def test_phase9_research_runs_styles_and_live_probe_exist():
    styles = read(SRC / 'styles' / 'app.css')
    for needle in ['.research-page', '.research-grid', '.research-detail-drawer', '.research-detail-scrim', '.research-lane-card', '.source-coverage-grid', '.synthesis-panel', '.research-evidence']:
        assert needle in styles
    assert 'grid-template-columns: minmax(280px, 360px) minmax(0, 1fr)' not in styles
    probe = ROOT / 'source' / 'scripts' / 'phase9-research-runs-probe.cjs'
    assert probe.exists()
    probe_text = probe.read_text(encoding='utf-8')
    for needle in ['research-runs', 'research-run-card', 'research-lane-card', 'Source coverage', 'Synthesis progress', 'consoleErrors']:
        assert needle in probe_text
