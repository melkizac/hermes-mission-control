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
    spec = importlib.util.spec_from_file_location('hmc_app_phase21', APP)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def patch_store(app, tmp_path):
    app.FUNNEL_TARGETS = tmp_path / 'website_funnel_targets.json'
    app.CRON_JOBS = tmp_path / 'jobs.json'
    app.CRON_JOBS.write_text(json.dumps({'jobs': []}))
    app.BROWSER_CONNECTORS = tmp_path / 'browser_connectors.json'
    app.BROWSER_RUNTIME_EVENTS = tmp_path / 'browser_runtime_events.json'
    app.UPLOAD_ROOT = tmp_path / 'uploads'


def ready_desktop_connector(app):
    created, status = app.upsert_browser_connector_config({
        'id': 'desktop-local',
        'type': 'desktop-browser',
        'label': 'Desktop browser on Mission Control host',
        'baseUrl': 'local-playwright',
        'approved': True,
    })
    assert status == 201
    probe, probe_status = app.browser_connector_action('desktop-local', {'action': 'dry_run_probe', 'dryRunConfirmed': True})
    assert probe_status == 200
    return probe['connector']


def test_desktop_browser_probe_contract_runs_safe_target_and_records_browser_activity(monkeypatch, tmp_path):
    app = load_app()
    patch_store(app, tmp_path)
    connector = ready_desktop_connector(app)

    captured = {}

    def fake_funnel_check(url, session_id, screenshot_dir, timeout_ms):
        captured['url'] = url
        captured['session_id'] = session_id
        screenshot = Path(screenshot_dir) / 'phase21-safe-form.png'
        screenshot.parent.mkdir(parents=True, exist_ok=True)
        screenshot.write_text('fake screenshot')
        return {
            'ok': True,
            'status': 'blocked_before_submit',
            'url': url,
            'finalUrl': 'https://httpbingo.org/forms/post',
            'domain': 'httpbingo.org',
            'screenshotPath': str(screenshot),
            'formsDetected': 1,
            'submitCandidates': 1,
            'noSubmit': True,
        }

    monkeypatch.setattr(app, 'run_desktop_browser_probe_job', fake_funnel_check)
    result, status = app.browser_connector_probe('desktop-local', {
        'targetUrl': 'https://httpbingo.org/forms/post',
        'dryRunConfirmed': True,
        'noSubmit': True,
    })

    assert status == 200
    assert result['ok'] is True
    assert result['dryRun'] is True
    assert result['connector']['id'] == connector['id']
    assert result['connector']['enabled'] is False
    assert result['summary']['status'] == 'blocked_before_submit'
    assert result['summary']['noSubmit'] is True
    assert result['summary']['formsDetected'] == 1
    assert result['summary']['submitCandidates'] == 1
    assert result['browserActivityUrl'].startswith('/app?view=browser-ops&session=')
    assert result['screenshotPath'].endswith('phase21-safe-form.png')
    assert 'phase21-desktop-probe-' in captured['session_id']

    detail, detail_status = app.browser_connector_detail_payload('desktop-local')
    assert detail_status == 200
    stored = detail['connector']
    assert stored['enabled'] is False
    assert stored['lastProbe']['status'] == 'blocked_before_submit'
    assert stored['lastProbe']['noSubmit'] is True
    assert stored['lastProbe']['browserActivityUrl'] == result['browserActivityUrl']
    assert stored['lastProbe']['screenshotPath'] == result['screenshotPath']
    assert any(item['label'] == 'Desktop-browser dry-run probe' and item['status'] == 'ready' for item in stored['readinessChecklist'])


def test_desktop_browser_probe_blocks_unsafe_or_unapproved_targets(tmp_path):
    app = load_app()
    patch_store(app, tmp_path)
    app.upsert_browser_connector_config({'id': 'desktop-local', 'type': 'desktop-browser', 'label': 'Desktop local', 'approved': False})

    missing_confirm, missing_status = app.browser_connector_probe('desktop-local', {'targetUrl': 'https://httpbingo.org/forms/post'})
    assert missing_status == 403
    assert 'dryRunConfirmed' in missing_confirm['error']

    unapproved, unapproved_status = app.browser_connector_probe('desktop-local', {'targetUrl': 'https://httpbingo.org/forms/post', 'dryRunConfirmed': True})
    assert unapproved_status == 403
    assert 'approved connector config' in unapproved['error']

    app.browser_connector_action('desktop-local', {'action': 'approve', 'approvedBy': 'Melverick'})
    unsafe, unsafe_status = app.browser_connector_probe('desktop-local', {'targetUrl': 'https://linkedin.com', 'dryRunConfirmed': True})
    assert unsafe_status == 400
    assert 'safe public target' in unsafe['error']


def test_browser_connector_probe_routes_demo_and_real_contract(tmp_path):
    app = load_app()
    patch_store(app, tmp_path)

    demo, demo_status = app.demo_response_for_mutation('/api/browser-connectors/demo-browserbase/probe', {
        'targetUrl': 'https://httpbingo.org/forms/post',
        'dryRunConfirmed': True,
    })
    assert demo_status == 200
    assert demo['ok'] is True
    assert demo['demo'] is True
    assert demo['dryRun'] is True
    assert demo['connector']['enabled'] is False
    assert demo['summary']['noSubmit'] is True
    assert demo['browserActivityUrl'].startswith('/app?view=browser-ops&session=')


def test_phase21_frontend_and_docs_surface_probe_status():
    automations = src(Path('views/Automations.tsx'))
    types = src(Path('types.ts'))
    client = src(Path('services/httpHermesClient.ts'))
    docs = src(Path('views/MissionControlDocs.tsx'))

    assert 'Run desktop-browser dry-run probe' in automations
    assert 'Last dry-run probe' in automations
    assert 'NO_SUBMIT probe' in automations
    assert 'browserConnectorProbe' in client
    assert 'BrowserConnectorProbeResponse' in types
    assert 'Phase 21 · Connector dry-run health probe' in docs
