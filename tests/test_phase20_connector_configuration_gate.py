from pathlib import Path
import importlib.util
import json
import sys

ROOT = Path('/opt/hermes-mission-control')
SRC = ROOT / 'source' / 'src'
APP = ROOT / 'app.py'


def src(rel):
    return (SRC / rel).read_text()


def load_app():
    sys.path.insert(0, str(ROOT))
    spec = importlib.util.spec_from_file_location('hmc_app_phase20', APP)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def patch_store(app, tmp_path):
    app.FUNNEL_TARGETS = tmp_path / 'website_funnel_targets.json'
    app.CRON_JOBS = tmp_path / 'jobs.json'
    app.CRON_JOBS.write_text(json.dumps({'jobs': []}))
    app.BROWSER_CONNECTORS = tmp_path / 'browser_connectors.json'


def test_connector_config_gate_redacts_secrets_and_stays_disabled_until_approved(tmp_path, monkeypatch):
    app = load_app()
    patch_store(app, tmp_path)
    monkeypatch.delenv('BROWSERBASE_API_KEY', raising=False)
    monkeypatch.delenv('WINDOWS_HERMES_GATEWAY_URL', raising=False)
    monkeypatch.delenv('HERMES_BROWSER_CONNECTOR_URL', raising=False)

    created, status = app.upsert_browser_connector_config({
        'id': 'browserbase-prod',
        'type': 'browserbase',
        'label': 'Browserbase production',
        'baseUrl': 'https://api.browserbase.com',
        'apiKey': 'sk_live_super_secret_value',
        'projectId': 'proj_123',
        'approved': False,
    })

    assert status == 201
    connector = created['connector']
    assert connector['enabled'] is False
    assert connector['approvalStatus'] == 'needs-approval'
    assert connector['credentials']['apiKey'] == '[REDACTED]'
    assert 'sk_live_super_secret_value' not in json.dumps(created)
    assert any(item['label'] == 'Explicit operator approval' and item['status'] == 'blocked' for item in connector['readinessChecklist'])
    assert any(item['label'] == 'Dry-run connectivity test' and item['status'] == 'blocked' for item in connector['readinessChecklist'])

    raw = app.BROWSER_CONNECTORS.read_text()
    assert 'sk_live_super_secret_value' not in raw
    assert '[REDACTED]' in raw


def test_connector_dry_run_probe_is_simulated_and_approval_required_before_enable(tmp_path):
    app = load_app()
    patch_store(app, tmp_path)
    app.upsert_browser_connector_config({
        'id': 'desktop-local',
        'type': 'desktop-browser',
        'label': 'Desktop browser connector',
        'baseUrl': 'http://127.0.0.1:32199',
        'approved': False,
    })

    rejected, rejected_status = app.browser_connector_action('desktop-local', {'action': 'enable'})
    assert rejected_status == 403
    assert 'explicit operator approval' in rejected['error']

    probe, probe_status = app.browser_connector_action('desktop-local', {'action': 'dry_run_probe', 'dryRunConfirmed': True})
    assert probe_status == 200
    assert probe['ok'] is True
    assert probe['connector']['enabled'] is False
    assert probe['connector']['dryRun']['status'] in {'simulated', 'blocked'}
    assert probe['connector']['dryRun']['noSubmit'] is True

    approved, approved_status = app.browser_connector_action('desktop-local', {'action': 'approve', 'approvedBy': 'Melverick'})
    assert approved_status == 200
    assert approved['connector']['approvalStatus'] == 'approved'
    assert approved['connector']['enabled'] is False
    assert any(item['label'] == 'Connector enabled' and item['status'] == 'blocked' for item in approved['connector']['readinessChecklist'])


def test_target_readiness_uses_connector_gate_not_environment_secret_alone(tmp_path, monkeypatch):
    app = load_app()
    patch_store(app, tmp_path)
    monkeypatch.setenv('BROWSERBASE_API_KEY', 'should-not-enable-by-env-alone')
    app.write_funnel_targets_data({'targets': [{
        'id': 'safe-target',
        'label': 'Safe target',
        'url': 'https://httpbingo.org/forms/post',
        'targetUrl': 'https://httpbingo.org/forms/post',
        'noSubmit': True,
        'safeTargetRequired': True,
        'approvalStatus': 'approved',
        'approval': {'status': 'approved', 'approvedBy': 'Melverick'},
    }]})

    detail, status = app.funnel_target_detail_payload('safe-target')
    assert status == 200
    readiness = detail['target']['connectorReadiness']
    assert any(item['label'] == 'Production connector approved' and item['status'] == 'blocked' for item in readiness)
    assert any(item['label'] == 'Production connector dry-run verified' and item['status'] == 'blocked' for item in readiness)
    assert any(item['label'] == 'Connector enabled for production' and item['status'] == 'blocked' for item in readiness)


def test_connector_config_routes_and_demo_contract(tmp_path):
    app = load_app()
    patch_store(app, tmp_path)

    demo_list, list_status = app.demo_response_for_get('/api/browser-connectors')
    assert list_status == 200
    assert demo_list['demo'] is True
    assert demo_list['connectors'][0]['credentials']['apiKey'] == '[REDACTED]'
    assert demo_list['connectors'][0]['enabled'] is False

    demo_detail, detail_status = app.demo_response_for_get('/api/browser-connectors/demo-browserbase')
    assert detail_status == 200
    assert demo_detail['connector']['approvalStatus'] in {'needs-approval', 'approved'}
    assert 'apiKey' in demo_detail['connector']['credentials']
    assert demo_detail['connector']['credentials']['apiKey'] == '[REDACTED]'


def test_frontend_connector_gate_ui_and_docs_exist():
    automations = src(Path('views/Automations.tsx'))
    types = src(Path('types.ts'))
    client = src(Path('services/httpHermesClient.ts'))
    docs = src(Path('views/MissionControlDocs.tsx'))

    assert 'Production connector configuration gate' in automations
    assert 'Browserbase' in automations
    assert 'desktop-browser' in automations
    assert 'future Windows gateway' in automations
    assert 'Dry-run connectivity test' in automations
    assert 'Approve connector config' in automations
    assert 'No real connector is enabled yet' in automations
    assert 'BrowserConnectorConfig' in types
    assert 'listBrowserConnectors' in client
    assert 'browserConnectorAction' in client
    assert 'Phase 20 · Production connector configuration gate' in docs
