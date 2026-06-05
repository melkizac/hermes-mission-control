from pathlib import Path
import importlib.util
import json
import sys

ROOT = Path('/opt/hermes-mission-control')
SRC = ROOT / 'source' / 'src'
APP = ROOT / 'app.py'


def src(rel):
    return (SRC / rel).read_text()


def load_app(name='hmc_app_phase17'):
    spec = importlib.util.spec_from_file_location(name, APP)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


def make_schedule_binding(app):
    workflow = next(w for w in app.packaged_sme_workflows() if w['id'] == 'website-funnel-check')
    result, status = app.launch_packaged_workflow('website-funnel-check', {
        'targetUrl': 'https://httpbingo.org/forms/post',
        'project': 'phase17-test',
        'expected': 'public lead/order form boundary',
        'runMode': 'schedule',
        'schedule': '0 9 * * 1',
        'title': 'Phase 17 scheduled Website Funnel Check',
    })
    assert status in (200, 201)
    return workflow, result


def test_phase17_enable_requires_explicit_operator_approval(tmp_path):
    app = load_app('hmc_app_phase17_require_approval')
    app.CRON_JOBS = tmp_path / 'jobs.json'
    app.CRON_JOBS.parent.mkdir(parents=True, exist_ok=True)
    app.CRON_JOBS.write_text(json.dumps({'jobs': [], 'updated_at': 0}))
    _, launch = make_schedule_binding(app)

    rejected, status = app.enable_website_funnel_routine(launch['routine'], {'approved': False})
    assert status == 403
    assert rejected['ok'] is False
    assert 'approval' in rejected['error'].lower()
    assert json.loads(app.CRON_JOBS.read_text())['jobs'] == []


def test_phase17_approved_enable_persists_real_cron_job_payload_with_no_submit(tmp_path):
    app = load_app('hmc_app_phase17_enable')
    app.CRON_JOBS = tmp_path / 'jobs.json'
    app.CRON_JOBS.parent.mkdir(parents=True, exist_ok=True)
    app.CRON_JOBS.write_text(json.dumps({'jobs': [], 'updated_at': 0}))
    _, launch = make_schedule_binding(app)

    enabled, status = app.enable_website_funnel_routine(launch['routine'], {
        'approved': True,
        'approvedBy': 'Melverick',
        'note': 'Approved safe recurring demo funnel check.',
    })
    assert status == 201
    assert enabled['ok'] is True
    job = enabled['job']
    assert job['id'] == launch['routine']['id']
    assert job['enabled'] is True
    assert job['state'] == 'scheduled'
    assert job['schedule']['kind'] == 'cron'
    assert job['schedule']['expr'] == '0 9 * * 1'
    assert job['deliver'] == 'local'
    assert job['script'] == 'browser_funnel_check_job.py'
    assert job['no_agent'] is True
    assert job['metadata']['workflow_template_id'] == 'website-funnel-check'
    assert job['metadata']['targetUrl'] == 'https://httpbingo.org/forms/post'
    assert job['metadata']['noSubmit'] is True
    assert job['metadata']['safeTargetRequired'] is True
    assert job['metadata']['enabledBy'] == 'Melverick'
    assert job['metadata']['enableApproval']['approved'] is True
    assert 'NO_SUBMIT' in job['prompt']
    assert '--config' in job['prompt'] or '--config' in job['metadata']['command']

    stored = json.loads(app.CRON_JOBS.read_text())
    assert len(stored['jobs']) == 1
    assert stored['jobs'][0]['id'] == job['id']


def test_phase17_reenable_updates_existing_job_without_duplicate(tmp_path):
    app = load_app('hmc_app_phase17_reenable')
    app.CRON_JOBS = tmp_path / 'jobs.json'
    app.CRON_JOBS.parent.mkdir(parents=True, exist_ok=True)
    app.CRON_JOBS.write_text(json.dumps({'jobs': [], 'updated_at': 0}))
    _, launch = make_schedule_binding(app)

    first, status = app.enable_website_funnel_routine(launch['routine'], {'approved': True, 'approvedBy': 'Melverick'})
    assert status == 201
    second, status = app.enable_website_funnel_routine(launch['routine'], {'approved': True, 'approvedBy': 'Melverick'})
    assert status == 200
    assert second['job']['id'] == first['job']['id']
    stored = json.loads(app.CRON_JOBS.read_text())
    assert len(stored['jobs']) == 1


def test_phase17_automation_action_enable_funnel_routine_uses_approval_payload(tmp_path):
    app = load_app('hmc_app_phase17_action')
    app.CRON_JOBS = tmp_path / 'jobs.json'
    app.CRON_JOBS.parent.mkdir(parents=True, exist_ok=True)
    app.CRON_JOBS.write_text(json.dumps({'jobs': [], 'updated_at': 0}))
    _, launch = make_schedule_binding(app)

    result, status = app.automation_action(launch['routine']['id'], 'enable_funnel_routine', {
        'routine': launch['routine'],
        'approved': True,
        'approvedBy': 'Melverick',
    })
    assert status == 201
    assert result['ok'] is True
    assert result['action'] == 'enable_funnel_routine'
    assert result['job']['metadata']['workflow_template_id'] == 'website-funnel-check'


def test_phase17_run_history_and_evidence_links_are_derived_from_outputs(tmp_path):
    app = load_app('hmc_app_phase17_history')
    output_dir = tmp_path / 'cron' / 'output' / 'website-funnel-check-phase17'
    output_dir.mkdir(parents=True)
    (output_dir / 'run.md').write_text('Browser Activity: /app?view=browser-ops&session=browser-session-17\nScreenshot: /tmp/funnel-phase17.png\nFinal URL: https://httpbingo.org/forms/post\nStatus: blocked_before_submit')
    job = {
        'id': 'website-funnel-check-phase17',
        'name': 'Website Funnel Check · phase17',
        'enabled': True,
        'state': 'scheduled',
        'schedule': {'kind': 'cron', 'expr': '0 9 * * 1', 'display': '0 9 * * 1'},
        'schedule_display': '0 9 * * 1',
        'script': 'browser_funnel_check_job.py',
        'no_agent': True,
        'last_status': 'blocked_before_submit',
        'last_run_at': 1780575000,
        'metadata': {
            'workflow_template_id': 'website-funnel-check',
            'targetUrl': 'https://httpbingo.org/forms/post',
            'noSubmit': True,
            'safeTargetRequired': True,
            'evidenceHistory': [{'title': 'Existing evidence', 'path': '/tmp/existing.png'}],
        },
    }
    app.HERMES_HOME = tmp_path
    row = app.automation_row(job)
    assert row['latestRunStatus']['status'] == 'blocked_before_submit'
    assert row['latestRunStatus']['lastRunAt'] != '—'
    evidence = row['evidenceHistory']
    assert any('Existing evidence' in e['title'] for e in evidence)
    assert any('run.md' in e.get('path', '') for e in evidence)
    assert any('/app?view=browser-ops&session=browser-session-17' in (e.get('url') or e.get('summary') or '') for e in evidence)


def test_phase17_frontend_exposes_enable_controls_and_docs():
    automations_ui = src('views/Automations.tsx')
    types = src('types.ts')
    client = src('services/httpHermesClient.ts')
    docs = (ROOT / 'source' / 'docs' / 'HERMES_MISSION_CONTROL.md').read_text()
    ui_docs = src('views/MissionControlDocs.tsx')

    assert 'enable_funnel_routine' in automations_ui
    assert 'Enable approved routine' in automations_ui
    assert 'approvedBy' in automations_ui
    assert 'enableAutomationRoutine' in client
    assert 'AutomationActionPayload' in types
    assert 'Phase 17' in docs
    assert 'Enable real scheduled funnel routines' in docs
    assert 'Phase 17 · Enable real scheduled funnel routines' in ui_docs


def test_phase17_demo_enable_action_does_not_create_real_cron_job():
    app = load_app('hmc_app_phase17_demo')
    result, status = app.demo_response_for_mutation('/api/automations/website-funnel-check-demo/action', {
        'action': 'enable_funnel_routine',
        'approved': True,
        'approvedBy': 'Melverick',
        'routine': {
            'id': 'website-funnel-check-demo',
            'workflow_template_id': 'website-funnel-check',
            'schedule': '0 9 * * 1',
            'targetUrl': 'https://httpbingo.org/forms/post',
            'noSubmit': True,
            'safeTargetRequired': True,
            'script': 'browser_funnel_check_job.py',
            'command': 'python3 source/scripts/browser_funnel_check_job.py --config /tmp/demo.json',
            'configPath': '/tmp/demo.json',
        },
    }, 'POST')
    assert status == 200
    assert result['ok'] is True
    assert result['demo'] is True
    assert result['action'] == 'enable_funnel_routine'
    assert result['job']['enabled'] is False
    assert result['job']['metadata']['noSubmit'] is True
    assert 'no real cron' in result['message'].lower()
