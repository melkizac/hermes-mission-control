import importlib.util
import json
from pathlib import Path

ROOT = Path('/opt/hermes-mission-control')
APP_PATH = ROOT / 'app.py'
FIXTURE_PATH = ROOT / 'source' / 'tests' / 'fixtures' / 'agent_os_intent_router_cases.json'


def load_app():
    spec = importlib.util.spec_from_file_location('mission_control_app_for_intent_router_tests', APP_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def route(prompt, context=None):
    app = load_app()
    result, status = app.agent_os_route_intent({'prompt': prompt, 'context': context or {}})
    assert status == 200
    assert result['ok'] is True
    assert result['side_effect_free'] is True
    assert result['route']['prompt'] == prompt
    return result['route']


def test_intent_route_simple_factual_prompt_returns_one_time_reply():
    decision = route('What does Mission Control do?')
    assert decision['intent_type'] == 'one_time_reply'
    assert decision['research_deliverable_intent'] is None
    assert decision['one_time_reply'] is True
    assert decision['create_task'] is False
    assert decision['create_project'] is False
    assert decision['launch_workflow'] is False
    assert decision['recommend_routine'] is False


def test_intent_route_multi_step_build_request_creates_project_or_task():
    decision = route(
        'Build a new Mission Control project for the Agent OS operating layer with task board integration, API routes, and verification.',
        {'selected_project_id': None},
    )
    assert decision['intent_type'] in ('project', 'kanban_task')
    assert decision['create_project'] is True or decision['create_task'] is True
    assert decision['evidence_required'] is True
    assert decision['one_time_reply'] is False


def test_intent_route_explicit_start_project_command_creates_project_not_chat_reply():
    decision = route(
        'Start a project for tightening Main Chat project kickoff behavior with evidence-backed task graphs.',
        {'selected_project_id': None},
    )
    assert decision['intent_type'] == 'project'
    assert decision['create_project'] is True
    assert decision['create_task'] is False
    assert decision['evidence_required'] is True
    assert decision['one_time_reply'] is False
    assert 'Projects / Context Hub' in decision['mission_control_capabilities']


def test_intent_route_repeated_schedule_request_recommends_routine():
    decision = route(
        'Every Monday morning, prepare a report about open blockers and send it to Telegram.',
        {'selected_project_id': 'project:weekly-ops'},
    )
    assert decision['intent_type'] == 'routine_recommendation'
    assert decision['recommend_routine'] is True
    assert decision['approval_required'] is True
    assert 'cronjob' in decision['tools_required']


def test_intent_route_recommend_routine_includes_installable_recommendation_object():
    decision = route(
        'Every weekday at 8am, check stuck Kanban tasks and send a digest to Telegram.',
        {'selected_project_id': 'project:agent-os-intelligent-operating-layer'},
    )
    routine = decision['routine_recommendation']
    assert routine['name'] == 'Stuck Kanban task digest'
    assert routine['schedule'] == '0 8 * * 1-5'
    assert routine['owner_agent'] == 'devops'
    assert routine['skills'] == ['kanban-worker']
    assert routine['toolsets'] == ['kanban', 'session_search', 'messaging']
    assert routine['approval_policy'] == 'approval_required_before_enablement'
    assert routine['evidence_output'] == 'Task Board digest with stuck task IDs, blockers, last run timestamp, and recommended next action.'
    assert routine['delivery_target'] == 'telegram'
    assert routine['signals'] == {
        'explicit_schedule_language': True,
        'repeated_history_match': True,
        'workflow_template_match': True,
    }


def test_intent_route_known_workflow_fit_returns_launch_workflow_candidate():
    decision = route(
        'Launch the lead-generation workflow for the new Academy funnel.',
        {'selected_project_id': 'project:nexius-academy-funnel'},
    )
    assert decision['intent_type'] == 'workflow'
    assert decision['launch_workflow'] is True
    assert decision['approval_required'] is True
    assert decision['agent_id'] == 'nexius-leads'


def test_intent_route_uses_workflow_library_for_high_fit_template_recommendation():
    decision = route(
        'Run a safe Website Funnel Check for https://example.com and keep no-submit evidence.',
        {'selected_project_id': 'project:browser-funnel-checks'},
    )
    advisor = decision['workflow_advisor']
    assert decision['intent_type'] == 'workflow'
    assert decision['launch_workflow'] is True
    assert advisor['recommendation'] == 'use_existing_workflow'
    assert advisor['matched_workflow']['id'] == 'website-funnel-check'
    assert advisor['matched_workflow']['fit_score'] >= 0.7
    assert decision['workflow_candidate']['id'] == 'website-funnel-check'
    assert decision['workflow_candidate']['source'] == 'workflow_library'


def test_intent_route_generates_workflow_draft_when_no_template_fits():
    decision = route(
        'Every Friday review vendor invoices and prepare an exception report for finance.',
        {'selected_project_id': 'project:finance-ops'},
    )
    advisor = decision['workflow_advisor']
    assert decision['intent_type'] == 'routine_recommendation'
    assert decision['recommend_routine'] is True
    assert advisor['recommendation'] == 'create_workflow_draft'
    draft = advisor['draft_workflow']
    assert draft['id'].startswith('workflow-draft-')
    assert draft['projectId'] == 'project:finance-ops'
    assert draft['agentId'] == 'melkizac'
    assert draft['status'] == 'draft'
    assert draft['approvalRequired'] is True


def test_intent_route_fixture_prompts_match_expected_core_decisions():
    app = load_app()
    cases = {case['id']: case for case in json.loads(FIXTURE_PATH.read_text(encoding='utf-8'))}
    for case_id in ('simple-answer', 'new-kanban-task', 'create-project', 'launch-workflow', 'recommend-routine'):
        result, status = app.agent_os_route_intent({'prompt': cases[case_id]['prompt'], 'context': cases[case_id].get('context') or {}})
        assert status == 200
        decision = result['route']
        expected = cases[case_id]['expected_route']
        for key in ('intent_type', 'create_task', 'create_project', 'launch_workflow', 'recommend_routine', 'one_time_reply', 'agent_id'):
            assert decision[key] == expected[key], f'{case_id} expected {key}={expected[key]!r}, got {decision[key]!r}'


def test_intent_route_research_to_deliverable_fixture_prompts_preserve_sub_intents():
    app = load_app()
    cases = {case['id']: case for case in json.loads(FIXTURE_PATH.read_text(encoding='utf-8'))}
    research_case_ids = [case_id for case_id in cases if case_id.startswith('research-')]
    assert research_case_ids
    for case_id in research_case_ids:
        result, status = app.agent_os_route_intent({'prompt': cases[case_id]['prompt'], 'context': cases[case_id].get('context') or {}})
        assert status == 200
        decision = result['route']
        expected = cases[case_id]['expected_route']
        assert decision['research_deliverable_intent'] == expected['research_deliverable_intent']
        for key in ('intent_type', 'create_task', 'create_project', 'launch_workflow', 'recommend_routine', 'one_time_reply', 'agent_id'):
            assert decision[key] == expected[key], f'{case_id} expected {key}={expected[key]!r}, got {decision[key]!r}'


def test_intent_route_low_confidence_research_request_does_not_mutate_state():
    decision = route(
        'Could you handle these source files somehow?',
        {'selected_project_id': None, 'sources': ['upload:unknown.pdf']},
    )
    assert decision['intent_type'] == 'clarification'
    assert decision['confidence'] < 0.6
    assert decision['research_deliverable_intent'] is None
    assert decision['create_task'] is False
    assert decision['create_project'] is False
    assert decision['launch_workflow'] is False
    assert decision['recommend_routine'] is False
    assert decision['approval_required'] is False


def test_intent_route_rejects_empty_prompt():
    app = load_app()
    result, status = app.agent_os_route_intent({'prompt': '   '})
    assert status == 400
    assert result['ok'] is False
    assert 'prompt' in result['error']



def test_intent_route_approval_policy_internal_drafts_auto_proceed():
    decision = route(
        'Draft a client proposal for the Nexius Academy AI workshop using the uploaded sources.',
        {'selected_project_id': 'project:nexius-academy-funnel'},
    )
    assert decision['research_deliverable_intent'] == 'generate_proposal'
    assert decision['approval_required'] is False
    assert decision['approval_policy']['required'] is False
    assert decision['approval_policy']['internal_draft_auto_proceed'] is True
    assert 'Approval Gates' not in decision['mission_control_capabilities']


def test_intent_route_approval_policy_external_destructive_and_sensitive_cases():
    cases = [
        ('Generate a LinkedIn post from the Academy source notes and publish it publicly.', 'external-facing'),
        ('Delete the obsolete production database table after exporting evidence.', 'destructive'),
        ('Use the live LinkedIn account provider to send this outreach message.', 'account-sensitive'),
    ]
    for prompt, expected_risk in cases:
        decision = route(prompt, {'selected_project_id': 'project:approval-policy'})
        assert decision['approval_required'] is True
        assert decision['approval_policy']['required'] is True
        assert decision['approval_policy']['risk'] == expected_risk
        assert decision['approval_policy']['reasons']
        assert 'Approval Gates' in decision['mission_control_capabilities']


def test_task_mission_result_payload_only_emits_approval_gate_when_policy_requires_it():
    app = load_app()
    base_task = {
        'id': 'task-internal-draft',
        'title': 'Draft proposal',
        'body': 'Draft an internal proposal for review.',
        'result': '',
        'status': 'todo',
        'tenant': 'project:test',
        'assignee': 'devops',
        'created_at': '2026-06-08T09:00:00Z',
        'updated_at': '2026-06-08T09:00:00Z',
        'started_at': None,
        'completed_at': None,
        'session_id': None,
    }
    internal = app.task_mission_result_payload(base_task, details={}, comments=[], events=[], runs=[])
    assert internal['approvalGates'] == []
    assert 'Run the delegated task' in internal['nextActions']

    external_task = dict(base_task, id='task-external-share', title='Send proposal to client', body='Share externally with the client after QA.')
    external = app.task_mission_result_payload(external_task, details={}, comments=[], events=[], runs=[])
    assert len(external['approvalGates']) == 1
    assert external['approvalGates'][0]['status'] == 'pending'
    assert external['approvalGates'][0]['risk'] == 'external-facing'
    assert 'Review Approval Gate' in external['nextActions']


def test_intent_route_approval_fixture_prompts_match_policy_contract():
    app = load_app()
    cases = {case['id']: case for case in json.loads(FIXTURE_PATH.read_text(encoding='utf-8'))}
    for case_id in ('approval-internal-draft-proposal', 'approval-external-publish', 'approval-destructive-delete', 'approval-sensitive-provider'):
        result, status = app.agent_os_route_intent({'prompt': cases[case_id]['prompt'], 'context': cases[case_id].get('context') or {}})
        assert status == 200
        decision = result['route']
        expected = cases[case_id]['expected_route']
        assert decision['approval_required'] == expected['approval_required']
        assert decision['approval_policy']['required'] == expected['approval_required']
        if expected['approval_required']:
            assert decision['approval_policy']['reasons']
        else:
            assert decision['approval_policy']['internal_draft_auto_proceed'] is True
