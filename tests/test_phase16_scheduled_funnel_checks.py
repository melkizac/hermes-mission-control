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
    spec = importlib.util.spec_from_file_location('hmc_app_phase16', APP)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


def test_phase16_workflow_exposes_routine_schedule_defaults():
    app = load_app()
    workflow = next(w for w in app.packaged_sme_workflows() if w['id'] == 'website-funnel-check')
    defaults = workflow.get('launchDefaults') or {}
    assert defaults['noSubmit'] is True
    assert defaults['safeTargetRequired'] is True
    assert defaults['runMode'] == 'create-task'
    assert defaults['scheduleMode'] == 'routine'
    assert defaults['schedule'] == '0 9 * * 1'
    assert workflow.get('routineBinding', {}).get('enabled') is True
    assert 'latestRunStatus' in workflow['routineBinding']
    assert 'evidenceHistory' in workflow['routineBinding']


def test_phase16_schedule_launch_creates_routine_binding_payload_without_submit():
    app = load_app()
    workflow = next(w for w in app.packaged_sme_workflows() if w['id'] == 'website-funnel-check')
    result, status = app.launch_packaged_workflow('website-funnel-check', {
        'targetUrl': 'https://httpbingo.org/forms/post',
        'project': 'phase16-test',
        'expected': 'public lead/order form boundary',
        'runMode': 'schedule',
        'schedule': '0 9 * * 1',
        'title': 'Phase 16 scheduled Website Funnel Check',
    })
    assert status in (200, 201)
    assert result['ok'] is True
    assert result['workflow']['id'] == 'website-funnel-check'
    routine = result['routine']
    assert routine['workflow_template_id'] == 'website-funnel-check'
    assert routine['schedule'] == '0 9 * * 1'
    assert routine['enabled'] is False
    assert routine['noSubmit'] is True
    assert routine['safeTargetRequired'] is True
    assert routine['targetUrl'] == 'https://httpbingo.org/forms/post'
    assert routine['latestRunStatus']['status'] == 'not-run'
    assert routine['evidenceHistory'] == []
    assert 'browser_funnel_check_job.py' in routine['script']
    assert 'NO_SUBMIT' in routine['prompt_preview']
    assert result['mission_result']['approvalGates']
    assert result['mission_result']['status'] == 'draft'
    if result.get('task', {}).get('id'):
        app.delete_task(result['task']['id'])


def test_phase16_list_automations_enriches_funnel_routine_metadata():
    app = load_app()
    routine_job = {
        'id': 'website-funnel-check-phase16-demo',
        'name': 'Website Funnel Check · Nexius demo',
        'enabled': False,
        'state': 'paused',
        'schedule_display': 'Mondays 09:00 SGT',
        'schedule': {'kind': 'cron', 'display': 'Mondays 09:00 SGT'},
        'prompt': 'Run Website Funnel Check with NO_SUBMIT. Target: https://httpbingo.org/forms/post',
        'script': 'browser_funnel_check_job.py',
        'no_agent': True,
        'metadata': {
            'workflow_template_id': 'website-funnel-check',
            'targetUrl': 'https://httpbingo.org/forms/post',
            'noSubmit': True,
            'safeTargetRequired': True,
            'latestRunStatus': {'status': 'blocked', 'lastRunAt': '2026-06-04T09:00:00+08:00'},
            'evidenceHistory': [{'title': 'Screenshot evidence', 'path': '/tmp/funnel.png'}],
        },
    }
    row = app.automation_row(routine_job)
    assert row['workflow_template_id'] == 'website-funnel-check'
    assert row['targetUrl'] == 'https://httpbingo.org/forms/post'
    assert row['noSubmit'] is True
    assert row['safeTargetRequired'] is True
    assert row['latestRunStatus']['status'] == 'blocked'
    assert len(row['evidenceHistory']) == 1


def test_phase16_frontend_surfaces_schedule_mode_and_latest_run_history():
    workflow_ui = src('views/WorkflowLibrary.tsx')
    automations_ui = src('views/Automations.tsx')
    types = src('types.ts')
    docs = (ROOT / 'source' / 'docs' / 'HERMES_MISSION_CONTROL.md').read_text()
    ui_docs = src('views/MissionControlDocs.tsx')

    assert 'scheduleMode' in types
    assert 'latestRunStatus' in types
    assert 'evidenceHistory' in types
    assert 'Schedule recurring check' in workflow_ui
    assert 'runMode: "schedule"' in workflow_ui
    assert 'NO_SUBMIT routine' in automations_ui
    assert 'Latest funnel run' in automations_ui
    assert 'Evidence history' in automations_ui
    assert 'Phase 16' in docs
    assert 'Scheduled Funnel Checks' in docs
    assert 'Phase 16 · Scheduled Funnel Checks' in ui_docs


def test_phase16_demo_schedule_launch_preserves_contract():
    app = load_app()
    result, status = app.demo_response_for_mutation('/api/workflows/website-funnel-check/launch', {
        'targetUrl': 'https://httpbingo.org/forms/post',
        'project': 'demo-phase16',
        'title': 'Demo scheduled Website Funnel Check',
        'runMode': 'schedule',
        'schedule': '0 9 * * 1',
    })
    assert status == 200
    assert result['ok'] is True
    assert result['demo'] is True
    assert result['routine']['workflow_template_id'] == 'website-funnel-check'
    assert result['routine']['enabled'] is False
    assert result['routine']['noSubmit'] is True
    assert result['routine']['latestRunStatus']['status'] == 'not-run'
