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
    spec = importlib.util.spec_from_file_location('hmc_app_phase19', APP)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def patch_store(app, tmp_path):
    app.FUNNEL_TARGETS = tmp_path / 'website_funnel_targets.json'
    app.BROWSER_CONNECTORS = tmp_path / 'browser_connectors.json'
    app.BROWSER_CONNECTORS.write_text(json.dumps({'connectors': []}))
    app.CRON_JOBS = tmp_path / 'jobs.json'
    app.CRON_JOBS.write_text(json.dumps({'jobs': []}))


def test_target_detail_payload_surfaces_evidence_links_and_readiness(tmp_path):
    app = load_app()
    patch_store(app, tmp_path)
    app.write_funnel_targets_data({
        'targets': [{
            'id': 'demo-target',
            'label': 'Demo public form',
            'url': 'https://httpbingo.org/forms/post',
            'targetUrl': 'https://httpbingo.org/forms/post',
            'project': 'browser-funnel-checks',
            'expected': 'lead capture form',
            'schedule': '0 9 * * 1',
            'noSubmit': True,
            'safeTargetRequired': True,
            'approvalStatus': 'approved',
            'approval': {'status': 'approved', 'approvedBy': 'Melverick', 'approvedAt': '2026-06-04T10:00:00'},
            'routineId': 'website-funnel-check-browser-funnel-checks-demo-target',
            'routineEnabled': False,
            'latestRunStatus': {'status': 'blocked_before_submit', 'lastRunAt': '2026-06-04T10:05:00', 'summary': 'Submit boundary detected; blocked.'},
            'evidenceHistory': [
                {'title': 'Screenshot evidence', 'path': '/tmp/funnel.png', 'createdAt': '2026-06-04T10:05:01'},
                {'title': 'Browser Activity session', 'url': '/app?view=browser-ops&session=funnel-demo-target', 'createdAt': '2026-06-04T10:05:02'},
                {'title': 'Task result evidence', 'url': '/app?view=board&task=123', 'createdAt': '2026-06-04T10:05:03'},
                {'title': 'Final URL', 'url': 'https://httpbingo.org/forms/post', 'createdAt': '2026-06-04T10:05:04'},
            ],
        }]
    })

    payload, status = app.funnel_target_detail_payload('demo-target')
    assert status == 200
    target = payload['target']
    assert target['id'] == 'demo-target'
    assert target['latestScreenshot']['path'] == '/tmp/funnel.png'
    assert target['browserActivityUrl'] == '/app?view=browser-ops&session=funnel-demo-target'
    assert target['taskResultUrl'] == '/app?view=board&task=123'
    assert target['finalUrl'] == 'https://httpbingo.org/forms/post'
    assert target['approvalHistory'][0]['status'] == 'approved'
    assert any(item['label'] == 'NO_SUBMIT locked' and item['status'] == 'ready' for item in target['connectorReadiness'])
    assert any(item['label'] == 'Production connector approved' and item['status'] == 'blocked' for item in target['connectorReadiness'])
    assert any(item['label'] == 'Production connector dry-run verified' and item['status'] == 'blocked' for item in target['connectorReadiness'])
    assert any(item['label'] == 'Connector enabled for production' and item['status'] == 'blocked' for item in target['connectorReadiness'])


def test_target_run_now_requires_dry_run_confirmation_and_preserves_no_submit(tmp_path):
    app = load_app()
    patch_store(app, tmp_path)
    created, _ = app.upsert_funnel_target({
        'id': 'demo-target',
        'label': 'Demo public form',
        'url': 'https://httpbingo.org/forms/post',
        'approved': True,
        'approvedBy': 'Melverick',
    })
    assert created['target']['noSubmit'] is True

    rejected, rejected_status = app.funnel_target_action('demo-target', {'action': 'run_now'})
    assert rejected_status == 403
    assert 'dry-run confirmation' in rejected['error']

    accepted, status = app.funnel_target_action('demo-target', {'action': 'run_now', 'dryRunConfirmed': True})
    assert status == 200
    assert accepted['target']['latestRunStatus']['status'] == 'queued-manual-run'
    assert accepted['target']['noSubmit'] is True
    assert accepted['target']['safeTargetRequired'] is True
    assert accepted['target']['runNowConfirmation']['dryRunConfirmed'] is True


def test_funnel_target_detail_route_and_demo_contract(tmp_path):
    app = load_app()
    patch_store(app, tmp_path)
    demo_payload, demo_status = app.demo_response_for_get('/api/funnel-targets/demo-target')
    assert demo_status == 200
    assert demo_payload['demo'] is True
    assert demo_payload['target']['browserActivityUrl'].startswith('/app?view=browser-ops&session=')
    assert demo_payload['target']['connectorReadiness']
    assert demo_payload['target']['noSubmit'] is True


def test_frontend_target_drawer_and_connector_readiness_controls_exist():
    automations = src(Path('views/Automations.tsx'))
    types = src(Path('types.ts'))
    client = src(Path('services/httpHermesClient.ts'))
    docs = src(Path('views/MissionControlDocs.tsx'))

    assert 'Target evidence detail' in automations
    assert 'Latest screenshot' in automations
    assert 'Browser Activity session' in automations
    assert 'Task result evidence' in automations
    assert 'Approval history' in automations
    assert 'Production connector readiness' in automations
    assert 'Dry-run only / NO_SUBMIT' in automations
    assert 'dryRunConfirmed' in automations
    assert 'getFunnelTarget' in client
    assert 'latestScreenshot' in types
    assert 'connectorReadiness' in types
    assert 'Phase 19 · Target evidence drill-down + production connector readiness' in docs
