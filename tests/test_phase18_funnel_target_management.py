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
    spec = importlib.util.spec_from_file_location('hmc_app_phase18', APP)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def patch_store(module, tmp_path):
    module.FUNNEL_TARGETS = tmp_path / 'website_funnel_targets.json'
    module.CRON_JOBS = tmp_path / 'jobs.json'
    module.CRON_JOBS.write_text(json.dumps({'jobs': []}))


def test_target_registry_crud_validates_safe_no_submit_targets(tmp_path):
    app = load_app()
    patch_store(app, tmp_path)

    created, status = app.upsert_funnel_target({
        'label': 'Nexius contact form',
        'url': 'https://httpbingo.org/forms/post',
        'project': 'nexius-labs',
        'expected': 'lead capture form',
        'schedule': '0 9 * * 1',
        'approved': True,
        'approvedBy': 'Melverick',
    })
    assert status == 201
    assert created['target']['id'].startswith('nexius-contact-form')
    assert created['target']['noSubmit'] is True
    assert created['target']['safeTargetRequired'] is True
    assert created['target']['approval']['status'] == 'approved'
    assert created['target']['routineId'].startswith('website-funnel-check-')

    listed = app.funnel_targets_payload()
    assert listed['summary']['total'] == 1
    assert listed['summary']['approved'] == 1
    assert listed['targets'][0]['latestRunStatus']['status'] == 'not-run'
    assert listed['targets'][0]['evidenceHistory'] == []

    bad, bad_status = app.upsert_funnel_target({'label': 'LinkedIn', 'url': 'https://linkedin.com/feed', 'approved': True})
    assert bad_status == 400
    assert 'account-sensitive' in bad['error']

    bad_local, local_status = app.upsert_funnel_target({'label': 'Localhost', 'url': 'http://127.0.0.1:3000', 'approved': True})
    assert local_status == 400
    assert 'private/local' in bad_local['error']


def test_target_registry_enable_pause_run_now_routes_to_cron_safely(tmp_path):
    app = load_app()
    patch_store(app, tmp_path)
    result, _ = app.upsert_funnel_target({
        'id': 'demo-target',
        'label': 'Demo form',
        'url': 'https://httpbingo.org/forms/post',
        'project': 'browser-funnel-checks',
        'schedule': '0 9 * * 1',
        'approved': True,
        'approvedBy': 'Melverick',
    })
    target = result['target']

    enable, enable_status = app.funnel_target_action('demo-target', {'action': 'enable', 'approved': True, 'approvedBy': 'Melverick'})
    assert enable_status in (200, 201)
    assert enable['ok'] is True
    assert enable['target']['routineEnabled'] is True
    assert enable['job']['metadata']['targetRegistryId'] == 'demo-target'
    assert enable['job']['metadata']['noSubmit'] is True
    assert enable['job']['metadata']['safeTargetRequired'] is True

    data = json.loads(app.CRON_JOBS.read_text())
    assert len(data['jobs']) == 1
    assert data['jobs'][0]['id'] == target['routineId']
    assert data['jobs'][0]['enabled'] is True

    paused, paused_status = app.funnel_target_action('demo-target', {'action': 'pause'})
    assert paused_status == 200
    assert paused['target']['routineEnabled'] is False
    assert json.loads(app.CRON_JOBS.read_text())['jobs'][0]['enabled'] is False

    run_now, run_status = app.funnel_target_action('demo-target', {'action': 'run_now', 'dryRunConfirmed': True})
    assert run_status == 200
    assert run_now['ok'] is True
    assert run_now['target']['latestRunStatus']['status'] == 'queued-manual-run'
    assert run_now['target']['noSubmit'] is True


def test_targets_payload_merges_cron_history_by_target_registry_id(tmp_path):
    app = load_app()
    patch_store(app, tmp_path)
    created, _ = app.upsert_funnel_target({
        'id': 'history-target',
        'label': 'History form',
        'url': 'https://httpbingo.org/forms/post',
        'approved': True,
        'approvedBy': 'Melverick',
    })
    routine = created['target']
    app.enable_website_funnel_routine(app.funnel_target_to_routine_binding(routine), {'approved': True, 'approvedBy': 'Melverick'})
    data = json.loads(app.CRON_JOBS.read_text())
    data['jobs'][0]['last_status'] = 'blocked_before_submit'
    data['jobs'][0]['last_run_at'] = 1780000000
    data['jobs'][0]['metadata']['evidenceHistory'] = [{
        'title': 'Browser Activity evidence',
        'url': '/app?view=browser-ops&session=abc123',
        'summary': 'Screenshot and final URL captured',
        'createdAt': '2026-06-04T00:00:00+08:00',
    }]
    app.CRON_JOBS.write_text(json.dumps(data))

    payload = app.funnel_targets_payload()
    target = payload['targets'][0]
    assert target['latestRunStatus']['status'] == 'blocked_before_submit'
    assert target['evidenceHistory'][0]['url'] == '/app?view=browser-ops&session=abc123'
    assert target['routineEnabled'] is True


def test_funnel_targets_api_routes_and_demo_do_not_mutate_real_cron(tmp_path):
    app = load_app()
    patch_store(app, tmp_path)

    create_payload, create_status = app.demo_response_for_mutation('/api/funnel-targets', {'label': 'Demo target', 'url': 'https://httpbingo.org/forms/post', 'approved': True, 'approvedBy': 'Demo'})
    assert create_status == 200
    assert create_payload['ok'] is True
    assert create_payload['demo'] is True
    assert create_payload['target']['noSubmit'] is True

    action_payload, action_status = app.demo_response_for_mutation('/api/funnel-targets/demo-target/action', {'action': 'enable', 'approved': True, 'approvedBy': 'Demo'})
    assert action_status == 200
    assert action_payload['ok'] is True
    assert action_payload['demo'] is True
    assert action_payload['target']['routineEnabled'] is False
    assert json.loads(app.CRON_JOBS.read_text())['jobs'] == []


def test_frontend_exposes_target_registry_and_per_target_controls():
    automations = src(Path('views/Automations.tsx'))
    types = src(Path('types.ts'))
    client = src(Path('services/httpHermesClient.ts'))
    docs = src(Path('views/MissionControlDocs.tsx'))

    assert 'Website Funnel Check targets' in automations
    assert 'Add target' in automations
    assert 'Enable target routine' in automations
    assert 'Pause target routine' in automations
    assert 'Run target now' in automations
    assert 'Target approval' in automations
    assert 'FunnelTarget' in types
    assert 'listFunnelTargets' in client
    assert 'createFunnelTarget' in client
    assert 'funnelTargetAction' in client
    assert 'Phase 18 · Configured target management' in docs
