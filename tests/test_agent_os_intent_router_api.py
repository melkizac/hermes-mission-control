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


def test_intent_route_repeated_schedule_request_recommends_routine():
    decision = route(
        'Every Monday morning, prepare a report about open blockers and send it to Telegram.',
        {'selected_project_id': 'project:weekly-ops'},
    )
    assert decision['intent_type'] == 'routine_recommendation'
    assert decision['recommend_routine'] is True
    assert decision['approval_required'] is True
    assert 'cronjob' in decision['tools_required']


def test_intent_route_known_workflow_fit_returns_launch_workflow_candidate():
    decision = route(
        'Launch the lead-generation workflow for the new Academy funnel.',
        {'selected_project_id': 'project:nexius-academy-funnel'},
    )
    assert decision['intent_type'] == 'workflow'
    assert decision['launch_workflow'] is True
    assert decision['approval_required'] is True
    assert decision['agent_id'] == 'nexius-leads'


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
