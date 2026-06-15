import json
from pathlib import Path

ROOT = Path('/opt/hermes-mission-control')
SOURCE = ROOT / 'source'
SPEC_PATH = SOURCE / 'docs' / 'AGENT_OS_INTENT_ROUTER_SPEC.md'
FIXTURE_PATH = SOURCE / 'tests' / 'fixtures' / 'agent_os_intent_router_cases.json'
APP_PATH = ROOT / 'app.py'

REQUIRED_SCHEMA_FIELDS = [
    'intent_type',
    'research_deliverable_intent',
    'confidence',
    'rationale',
    'project_required',
    'suggested_project_id',
    'create_task',
    'create_project',
    'launch_workflow',
    'recommend_routine',
    'one_time_reply',
    'agent_id',
    'tools_required',
    'skills_required',
    'evidence_required',
    'approval_required',
]

RESEARCH_TO_DELIVERABLE_INTENTS = {
    'learn_topic': 'research-learn-topic',
    'ask_sources': 'research-ask-sources',
    'summarize_sources': 'research-summarize-sources',
    'compare_sources': 'research-compare-sources',
    'generate_deck': 'research-generate-deck',
    'generate_report': 'research-generate-report',
    'generate_proposal': 'research-generate-proposal',
    'generate_training_material': 'research-generate-training-material',
    'revise_artifact': 'research-revise-artifact',
    'add_sources_to_project': 'research-add-sources-to-project',
    'check_project_status': 'research-check-project-status',
}

EXPECTED_CASES = {
    'simple-answer': {'intent_type': 'one_time_reply', 'one_time_reply': True, 'create_task': False},
    'status-query': {'intent_type': 'status_query', 'evidence_required': True, 'create_task': False},
    'new-kanban-task': {'intent_type': 'kanban_task', 'create_task': True, 'project_required': True},
    'create-project': {'intent_type': 'project', 'create_project': True, 'project_required': False},
    'launch-workflow': {'intent_type': 'workflow', 'launch_workflow': True, 'approval_required': True},
    'recommend-routine': {'intent_type': 'routine_recommendation', 'recommend_routine': True, 'approval_required': True},
    'approval-response': {'intent_type': 'approval_response', 'approval_required': False, 'create_task': False},
    'external-publish': {'intent_type': 'workflow', 'launch_workflow': True, 'approval_required': True},
    'missing-project': {'intent_type': 'kanban_task', 'project_required': True, 'suggested_project_id': None},
    'evidence-request': {'intent_type': 'evidence_query', 'evidence_required': True, 'create_task': False},
    'ambiguous-pronoun': {'intent_type': 'clarification', 'project_required': True, 'create_task': False},
    'agent-handoff': {'intent_type': 'agent_handoff', 'agent_id': 'content-ops', 'create_task': True},
}


def load_cases():
    assert FIXTURE_PATH.exists(), 'router fixture JSON must exist for acceptance tests'
    cases = json.loads(FIXTURE_PATH.read_text(encoding='utf-8'))
    assert isinstance(cases, list)
    return cases


def test_agent_os_router_spec_documents_required_schema_and_decision_rules():
    assert SPEC_PATH.exists(), 'Agent OS intent router contract must be documented'
    spec = SPEC_PATH.read_text(encoding='utf-8')
    for field in REQUIRED_SCHEMA_FIELDS:
        assert field in spec
    for rule in [
        'Simple one-time answer',
        'Kanban task',
        'Project',
        'Workflow',
        'Routine recommendation',
        'Approval gate',
        'Research-to-deliverable intents',
        'learn_topic',
        'ask_sources',
        'summarize_sources',
        'compare_sources',
        'generate_deck',
        'generate_report',
        'generate_proposal',
        'generate_training_material',
        'revise_artifact',
        'add_sources_to_project',
        'check_project_status',
        'API inspection must be side-effect free',
    ]:
        assert rule in spec


def test_agent_os_router_fixtures_cover_at_least_twelve_representative_prompts():
    cases = load_cases()
    assert len(cases) >= 23
    ids = {case['id'] for case in cases}
    assert set(EXPECTED_CASES).issubset(ids)
    for case in cases:
        assert case.get('prompt')
        expected = case.get('expected_route') or {}
        for field in REQUIRED_SCHEMA_FIELDS:
            assert field in expected, f"{case['id']} missing expected_route.{field}"
        assert 0 <= expected['confidence'] <= 1
        assert isinstance(expected['rationale'], str) and expected['rationale']
        assert isinstance(expected['tools_required'], list)
        assert isinstance(expected['skills_required'], list)


def test_agent_os_router_fixture_decisions_match_acceptance_matrix():
    cases = {case['id']: case['expected_route'] for case in load_cases()}
    for case_id, expected_fields in EXPECTED_CASES.items():
        route = cases[case_id]
        for key, value in expected_fields.items():
            assert route.get(key) == value, f"{case_id} expected {key}={value!r}, got {route.get(key)!r}"


def test_agent_os_router_fixtures_cover_research_to_deliverable_sub_intents():
    cases = {case['id']: case for case in load_cases()}
    for sub_intent, case_id in RESEARCH_TO_DELIVERABLE_INTENTS.items():
        assert case_id in cases, f"missing fixture for research-to-deliverable intent {sub_intent}"
        route = cases[case_id]['expected_route']
        assert route['research_deliverable_intent'] == sub_intent
        assert route['agent_id'] == 'melkizac'
        assert route['evidence_required'] is True
        if sub_intent == 'check_project_status':
            assert route['intent_type'] == 'status_query'
            assert route['create_task'] is False
            assert route['create_project'] is False
            assert route['launch_workflow'] is False
        elif sub_intent in {'ask_sources', 'summarize_sources', 'compare_sources'}:
            assert route['intent_type'] in {'one_time_reply', 'workflow'}
            assert route['create_project'] is False
        else:
            assert route['intent_type'] in {'project', 'workflow'}
            assert route['create_project'] is True or route['launch_workflow'] is True


def test_agent_os_router_low_confidence_routes_are_side_effect_free():
    for case in load_cases():
        route = case['expected_route']
        if route['confidence'] < 0.6:
            assert route['intent_type'] == 'clarification'
            assert route['create_task'] is False
            assert route['create_project'] is False
            assert route['launch_workflow'] is False
            assert route['recommend_routine'] is False
            assert route['approval_required'] is False


def test_agent_os_router_has_side_effect_free_inspection_api_contract():
    app = APP_PATH.read_text(encoding='utf-8')
    assert "'/api/agent-os/intent-router/spec'" in app
    assert 'agent_os_intent_router_spec_payload' in app
    assert 'SPEC_PATH' not in app, 'backend route should not depend on test module globals'
    window = app[app.find('agent_os_intent_router_spec_payload'):app.find('agent_os_intent_router_spec_payload') + 3000]
    assert 'create_task(' not in window
    assert 'create_project(' not in window
