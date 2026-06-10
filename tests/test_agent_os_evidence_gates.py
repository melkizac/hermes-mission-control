import importlib.util
import json
from pathlib import Path

ROOT = Path('/opt/hermes-mission-control')
APP_PATH = ROOT / 'app.py'


def load_app():
    spec = importlib.util.spec_from_file_location('mission_control_app_agent_os_evidence_gate_tests', APP_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_evidence_gate_checklist_tracks_required_types_and_aliases():
    app = load_app()
    task = {
        'id': 'agent-os-evidence-gate-sample',
        'title': 'Evidence gate sample',
        'body': 'Complete only after command output, build/test log, API response, screenshot, file artifact, approval note, and session link are attached.',
        'status': 'running',
        'assignee': 'devops',
        'tenant': 'project:agent-os',
        'updated_at': '2026-06-08T08:05:00Z',
    }
    details = app.task_result_details(json.dumps({
        'summary': 'Ready to complete',
        'evidence_required': True,
        'evidence_checklist': ['command_output', 'build_test_log', 'api_response', 'screenshot', 'file_artifact', 'approval_note', 'session_link'],
        'evidence': [
            {'type': 'command_output', 'title': 'pytest output', 'summary': '1 passed', 'reference': 'pytest'},
            {'type': 'build_test_log', 'title': 'npm build', 'summary': 'built', 'reference': 'npm-build'},
            {'type': 'api_response', 'title': 'API readback', 'summary': '200 OK', 'reference': 'GET /api/tasks/1'},
            {'type': 'screenshot', 'title': 'Browser screenshot', 'summary': 'page rendered', 'url': '/screenshots/task.png'},
            {'type': 'file_artifact', 'title': 'Report artifact', 'summary': 'file exists', 'reference': '/tmp/report.md'},
            {'type': 'approval_note', 'title': 'Reviewer approval', 'summary': 'approved', 'reference': 'Melverick'},
            {'type': 'session_link', 'title': 'Session link', 'summary': 'linked', 'reference': 'sess_123'},
        ],
    }))

    gate = app.task_evidence_gate_state(task, details, [], [], [])

    assert gate['required'] is True
    assert gate['status'] == 'passed'
    assert gate['completionBlocked'] is False
    assert gate['missingTypes'] == []
    assert [item['type'] for item in gate['checklist']] == [
        'command_output',
        'build_test_log',
        'api_response',
        'screenshot',
        'file_artifact',
        'approval_note',
        'session_link',
    ]
    assert all(item['satisfied'] for item in gate['checklist'])


def test_update_task_blocks_done_when_required_evidence_is_missing(tmp_path, monkeypatch):
    app = load_app()
    monkeypatch.setattr(app, 'KANBAN_DB', tmp_path / 'kanban.db')
    create, create_status = app.create_task({
        'id': 'agent-os-evidence-missing',
        'title': 'Missing evidence gate',
        'body': 'Mark complete only after command output and API response are attached.',
        'status': 'running',
        'result': {
            'summary': 'Claimed done without proof',
            'evidence_required': True,
            'evidence_checklist': ['command_output', 'api_response'],
            'evidence': [{'type': 'command_output', 'title': 'Command', 'summary': 'ran pytest', 'reference': 'pytest'}],
        },
    })
    assert create_status == 201, create

    result, status = app.update_task('agent-os-evidence-missing', {'status': 'done'})

    assert status == 409
    assert result['ok'] is False
    assert result['error'] == 'completion blocked by missing required evidence'
    assert result['evidence_gate']['missingTypes'] == ['api_response']


def test_task_mission_result_payload_exposes_evidence_gate_for_task_drawer():
    app = load_app()
    task = {
        'id': 'agent-os-evidence-drawer',
        'title': 'Evidence drawer',
        'body': 'Needs screenshot and file artifact before completion.',
        'status': 'queued',
        'assignee': 'devops',
        'tenant': 'project:agent-os',
        'created_at': '2026-06-08T08:00:00Z',
        'updated_at': '2026-06-08T08:05:00Z',
    }
    details = app.task_result_details(json.dumps({
        'summary': 'Partial proof',
        'evidence_required': True,
        'evidence_checklist': ['screenshot', 'file_artifact'],
        'evidence': [{'type': 'screenshot', 'title': 'Screenshot', 'summary': 'visible', 'url': '/screenshots/task.png'}],
    }))

    result = app.task_mission_result_payload(task, details, comments=[], events=[], runs=[])

    assert result['evidenceGate']['required'] is True
    assert result['evidenceGate']['status'] == 'blocked'
    assert result['evidenceGate']['missingTypes'] == ['file_artifact']
    assert any('Attach required evidence' in action for action in result['nextActions'])


def test_boolean_false_string_does_not_enable_evidence_gate():
    app = load_app()

    details = app.task_result_details(json.dumps({
        'summary': 'No gate wanted',
        'evidence_required': 'false',
        'evidence_checklist': ['command_output'],
    }))

    assert details['evidence_required'] is False
    gate = app.task_evidence_gate_state({'id': 'task', 'status': 'running'}, details, [], [], [])
    assert gate['required'] is False
    assert gate['completionBlocked'] is False


def test_empty_evidence_summary_does_not_satisfy_gate():
    app = load_app()
    details = app.task_result_details(json.dumps({
        'summary': 'Empty evidence should not count',
        'evidence_required': True,
        'evidence_checklist': ['api_response'],
        'evidence': [{'type': 'api_response', 'title': 'Empty API response', 'summary': '   '}],
    }))

    gate = app.task_evidence_gate_state({'id': 'task', 'status': 'running'}, details, [], [], [])

    assert gate['status'] == 'blocked'
    assert gate['missingTypes'] == ['api_response']


def test_unknown_evidence_checklist_entries_are_filtered_from_required_types():
    app = load_app()
    details = app.task_result_details(json.dumps({
        'summary': 'Typo should not make task impossible to complete',
        'evidence_required': True,
        'evidence_checklist': ['api_response', 'typo_custom_gate'],
        'evidence': [{'type': 'api_response', 'title': 'API', 'summary': '200 OK', 'reference': 'GET /api'}],
    }))

    gate = app.task_evidence_gate_state({'id': 'task', 'status': 'running'}, details, [], [], [])

    assert gate['requiredTypes'] == ['api_response']
    assert gate['status'] == 'passed'


def test_update_task_done_gate_uses_existing_approval_comments(tmp_path, monkeypatch):
    app = load_app()
    monkeypatch.setattr(app, 'KANBAN_DB', tmp_path / 'kanban.db')
    create, create_status = app.create_task({
        'id': 'agent-os-evidence-approval-comment',
        'title': 'Approval note evidence gate',
        'body': 'Mark complete only after approval evidence is attached.',
        'status': 'running',
        'result': {
            'summary': 'Ready after review',
            'evidence_required': True,
            'evidence_checklist': ['approval_note'],
            'evidence': [],
        },
    })
    assert create_status == 201, create
    con = app.ensure_kanban_tables()
    con.execute(
        'INSERT INTO task_comments(task_id,author,body,created_at) VALUES (?,?,?,?)',
        ('agent-os-evidence-approval-comment', 'reviewer', 'Approved after checking the API response and screenshot.', 1800000000),
    )
    con.commit()
    con.close()

    result, status = app.update_task('agent-os-evidence-approval-comment', {'status': 'done'})

    assert status == 200, result
    assert result['ok'] is True
    assert result['task']['status'] == 'done'
