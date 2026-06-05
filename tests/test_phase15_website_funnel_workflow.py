from pathlib import Path
import importlib.util
import sys

ROOT = Path('/opt/hermes-mission-control')
SRC = ROOT / 'source' / 'src'
APP = ROOT / 'app.py'


def src(rel):
    return (SRC / rel).read_text(encoding='utf-8')


def app_text():
    return APP.read_text(encoding='utf-8')


def load_app():
    spec = importlib.util.spec_from_file_location('hmc_app_phase15', APP)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_phase15_catalog_includes_website_funnel_check_packaged_workflow():
    app = load_app()
    workflows = app.packaged_sme_workflows()
    funnel = next((w for w in workflows if w.get('id') == 'website-funnel-check'), None)
    assert funnel, 'Phase 15 should expose a Website Funnel Check packaged workflow'
    assert funnel['name'] == 'Website Funnel Check'
    assert funnel['category'] == 'Browser operations'
    assert funnel['risk'] == 'external-facing'
    assert 'browser_funnel_check_job.py' in funnel['launchPrompt']
    assert 'NO_SUBMIT' in funnel['launchPrompt']
    assert funnel.get('launchDefaults', {}).get('noSubmit') is True
    assert funnel.get('launchDefaults', {}).get('safeTargetRequired') is True
    assert any(step.get('id') == 'run-safe-browser-check' for step in funnel['steps'])
    assert any(gate.get('title') == 'Review before form submit' for gate in funnel['approvalGates'])
    assert 'browser-funnel-check-job' in funnel['skills']


def test_phase15_website_funnel_launch_creates_task_with_job_config_and_no_submit(monkeypatch):
    app = load_app()
    created = {}

    def fake_create_task(payload):
        created.update(payload)
        task = {
            'id': 'phase15-task-1',
            'title': payload['title'],
            'status': payload['status'],
            'tenant': payload.get('tenant'),
            'result_details': payload.get('result'),
            'workflow_template_id': payload.get('workflow_template_id'),
            'skills': payload.get('skills') or [],
            'updated_at': 'now',
            'created_at': 'now',
            'assignee': payload.get('assignee'),
        }
        return {'ok': True, 'task': task}, 201

    monkeypatch.setattr(app, 'create_task', fake_create_task)
    monkeypatch.setattr(app, 'delegate_work_plan_payload', lambda payload, identity=None: ({'ok': True, 'plan': {'agentId': 'melkizac', 'projectId': payload.get('projectId') or 'browser-funnel-checks', 'taskBody': 'plan body', 'evidence': []}}, 200))

    result, status = app.launch_packaged_workflow('website-funnel-check', {
        'targetUrl': 'https://httpbingo.org/forms/post',
        'project': 'phase15-verification',
        'expected': 'public lead/order form submit boundary',
        'runMode': 'create-task',
    })

    assert status == 201
    assert result['ok'] is True
    assert result['workflow']['id'] == 'website-funnel-check'
    assert result['funnel_job']['runMode'] == 'create-task'
    assert result['funnel_job']['noSubmit'] is True
    assert result['funnel_job']['config']['targets'][0]['url'] == 'https://httpbingo.org/forms/post'
    assert created['status'] == 'queued'
    assert created['tenant'] == 'phase15-verification'
    assert created['workflow_template_id'] == 'website-funnel-check'
    assert 'python3 source/scripts/browser_funnel_check_job.py --config' in created['body']
    assert 'NO_SUBMIT' in created['body']
    mission = result['mission_result']
    assert mission['status'] in {'draft', 'blocked'}
    assert any(item['kind'] == 'file' and 'target config' in item['title'].lower() for item in mission['artifacts'])
    assert any(gate['status'] == 'pending' and 'submit' in gate['title'].lower() for gate in mission['approvalGates'])
    assert any('Launch/run the Phase 14 browser funnel job' in action for action in mission['nextActions'])


def test_phase15_frontend_and_docs_surface_website_funnel_workflow():
    app = app_text()
    view = src('views/WorkflowLibrary.tsx')
    docs = (ROOT / 'source' / 'docs' / 'HERMES_MISSION_CONTROL.md').read_text(encoding='utf-8')
    ui_docs = src('views/MissionControlDocs.tsx')

    for needle in [
        "'website-funnel-check'",
        "'Website Funnel Check'",
        'browser_funnel_check_job.py',
        'NO_SUBMIT',
        'launchDefaults',
        'funnel_job',
    ]:
        assert needle in app
    assert 'targetUrl' in view or 'Website Funnel Check' in view
    assert 'Phase 15' in docs
    assert 'Website Funnel Check packaged workflow' in docs
    assert 'Phase 15 · Website Funnel Check Workflow' in ui_docs


def test_phase15_demo_launch_response_preserves_funnel_job_contract():
    app = load_app()
    result, status = app.demo_response_for_mutation('/api/workflows/website-funnel-check/launch', {
        'targetUrl': 'https://httpbingo.org/forms/post',
        'project': 'demo-phase15',
        'title': 'Demo Website Funnel Check',
    })
    assert status == 200
    assert result['ok'] is True
    assert result['demo'] is True
    assert result['workflow']['id'] == 'website-funnel-check'
    assert result['funnel_job']['noSubmit'] is True
    assert result['task']['workflow_template_id'] == 'website-funnel-check'
    assert result['mission_result']['approvalGates']
