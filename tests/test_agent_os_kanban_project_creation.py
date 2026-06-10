import importlib.util
import json
from pathlib import Path

ROOT = Path('/opt/hermes-mission-control')
APP_PATH = ROOT / 'app.py'


def load_app(tmp_path):
    spec = importlib.util.spec_from_file_location('mission_control_app_for_agent_os_kanban_tests', APP_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.KANBAN_DB = tmp_path / 'kanban.db'
    return module


def test_agent_os_project_decision_creates_project_container_with_structured_body(tmp_path):
    app = load_app(tmp_path)
    route = app.agent_os_route_decision(
        'project',
        0.87,
        'Large multi-step Agent OS build needs durable project tracking.',
        create_project=True,
        agent_id='devops',
        tools_required=['kanban', 'terminal'],
        skills_required=['agent-mission-control-ui'],
        prompt='Build the Agent OS operating layer with task board integration and verification.',
        context={'assumptions': ['Use existing Mission Control Kanban database.']},
    )

    result, status = app.agent_os_create_kanban_from_intent({'route': route})

    assert status == 201
    assert result['ok'] is True
    assert result['mode'] == 'project'
    assert result['project_id'].startswith('project:')
    assert len(result['tasks']) == 5
    task = result['tasks'][0]
    assert task['tenant'] == result['project_id']
    assert task['assignee'] == 'devops'
    assert task['status'] == 'scheduled'
    assert task['skills'] == ['agent-mission-control-ui']
    for required_section in [
        '## Objective',
        '## Assumptions',
        '## Execution steps',
        '## Tools required',
        '## Skills required',
        '## Data required',
        '## Access required',
        '## Mission Control capabilities',
        '## Evidence required',
        '## Owner / status',
        '## Router decision',
    ]:
        assert required_section in task['body']
    assert 'Build the Agent OS operating layer' in task['body']
    assert 'Use existing Mission Control Kanban database.' in task['body']


def test_agent_os_generic_project_decision_creates_visible_kickoff_graph(tmp_path):
    app = load_app(tmp_path)
    route = app.agent_os_route_decision(
        'project',
        0.88,
        'Explicit project-start command needs a visible project container plus executable task graph.',
        create_project=True,
        agent_id='devops',
        tools_required=['kanban', 'terminal'],
        skills_required=['agent-mission-control-ui'],
        prompt='Start a project for tightening Main Chat project kickoff behavior with evidence-backed task graphs.',
        context={'selected_project_name': None},
    )

    result, status = app.agent_os_create_kanban_from_intent({'route': route})

    assert status == 201
    assert result['ok'] is True
    assert result['mode'] == 'project'
    assert result['workflow_type'] == 'project_kickoff'
    assert result['graph_template'] == 'project_kickoff_v1'
    assert result['chat_card']['kind'] == 'project_kickoff'
    assert result['chat_card']['status'] == 'Project task graph ready'
    assert {'project_kickoff', 'current_state', 'implementation', 'verification', 'handoff'} <= set(result['task_ids'])
    assert len(result['tasks']) == 5

    board = app.list_task_board({'project': [result['project_id']]})
    assert board['summary']['total'] == 5
    by_id = {task['id']: task for task in board['tasks']}
    assert by_id[result['task_ids']['current_state']]['parents'] == [result['task_ids']['project_kickoff']]
    assert by_id[result['task_ids']['implementation']]['parents'] == [result['task_ids']['current_state']]
    assert by_id[result['task_ids']['verification']]['parents'] == [result['task_ids']['implementation']]
    assert by_id[result['task_ids']['handoff']]['parents'] == [result['task_ids']['verification']]
    assert by_id[result['task_ids']['project_kickoff']]['status'] == 'scheduled'
    assert by_id[result['task_ids']['current_state']]['status'] == 'todo'
    assert 'Project Kickoff task graph' in by_id[result['task_ids']['implementation']]['body']
    assert 'Evidence required' in by_id[result['task_ids']['verification']]['body']


def test_agent_os_task_decision_creates_single_task_under_selected_project(tmp_path):
    app = load_app(tmp_path)
    route = app.agent_os_route_decision(
        'kanban_task',
        0.83,
        'Trackable one-off implementation request.',
        create_task=True,
        suggested_project_id='project:agent-os-intelligent-operating-layer',
        agent_id='devops',
        tools_required=['kanban'],
        skills_required=['agent-mission-control-ui'],
        prompt='Add the safe Kanban creation bridge.',
        context={'selected_project_name': 'Agent OS Intelligent Operating Layer'},
    )

    result, status = app.agent_os_create_kanban_from_intent({'route': route})

    assert status == 201
    assert result['ok'] is True
    assert result['mode'] == 'task'
    assert result['project_id'] == 'project:agent-os-intelligent-operating-layer'
    assert len(result['tasks']) == 1
    task = result['tasks'][0]
    assert task['tenant'] == 'project:agent-os-intelligent-operating-layer'
    assert task['assignee'] == 'devops'
    assert task['status'] == 'todo'
    assert task['priority'] >= 50
    assert 'Add the safe Kanban creation bridge.' in task['body']
    assert 'Selected Project context' in task['body']
    assert 'Normal workspace permissions' in task['body']
    assert 'Projects / Context Hub' in task['body']
    assert 'Return Task Board task ID and run evidence' in task['body']


def test_agent_os_kanban_creation_rejects_low_confidence_or_missing_project(tmp_path):
    app = load_app(tmp_path)
    low_confidence = app.agent_os_route_decision(
        'clarification',
        0.42,
        'Ambiguous target.',
        create_task=False,
        prompt='Do something with this.',
    )
    result, status = app.agent_os_create_kanban_from_intent({'route': low_confidence})
    assert status == 400
    assert result['ok'] is False
    assert 'confidence' in result['error']

    missing_project = app.agent_os_route_decision(
        'kanban_task',
        0.81,
        'Trackable task but no project was selected.',
        create_task=True,
        suggested_project_id=None,
        prompt='Fix the dashboard copy.',
    )
    result, status = app.agent_os_create_kanban_from_intent({'route': missing_project})
    assert status == 400
    assert result['ok'] is False
    assert 'project' in result['error'].lower()

    board = app.list_task_board()
    assert board['summary']['total'] == 0


def test_agent_os_research_project_creates_dependency_linked_task_graph(tmp_path):
    app = load_app(tmp_path)
    route = app.agent_os_route_decision(
        'project',
        0.91,
        'Editable deck generation from sources needs a durable Research-to-Deliverable Project.',
        research_deliverable_intent='generate_deck',
        create_project=True,
        agent_id='devops',
        tools_required=['kanban', 'pptx'],
        skills_required=['agent-mission-control-ui', 'pptx'],
        prompt='Create an editable PPTX deck from the uploaded source documents.',
        context={'selected_project_name': 'AI Workforce Training Deck'},
    )

    result, status = app.agent_os_create_kanban_from_intent({'route': route})

    assert status == 201
    assert result['ok'] is True
    assert result['mode'] == 'project'
    assert result['workflow_type'] == 'research_to_deliverable'
    assert result['graph_template'] == 'research_to_deliverable_v1'
    assert result['chat_card']['kind'] == 'research_to_deliverable_project'
    assert {'project_kickoff', 'process_sources', 'synthesize_notes', 'draft_outline', 'generate_pptx', 'qa_artifacts', 'deliver_to_chat'} <= set(result['task_ids'])
    assert len(result['tasks']) == 7

    board = app.list_task_board({'project': [result['project_id']]})
    assert board['summary']['total'] == 7
    by_id = {task['id']: task for task in board['tasks']}
    assert by_id[result['task_ids']['synthesize_notes']]['parents'] == [result['task_ids']['process_sources']]
    assert by_id[result['task_ids']['draft_outline']]['parents'] == [result['task_ids']['synthesize_notes']]
    assert by_id[result['task_ids']['generate_pptx']]['parents'] == [result['task_ids']['draft_outline']]
    assert by_id[result['task_ids']['qa_artifacts']]['parents'] == [result['task_ids']['generate_pptx']]
    assert by_id[result['task_ids']['deliver_to_chat']]['parents'] == [result['task_ids']['qa_artifacts']]
    assert 'Research-to-Deliverable task graph' in by_id[result['task_ids']['process_sources']]['body']
    assert 'Requested outputs: pptx' in by_id[result['task_ids']['generate_pptx']]['body']


def test_agent_os_research_project_adds_approval_gate_for_external_or_costly_actions(tmp_path):
    app = load_app(tmp_path)
    route = app.agent_os_route_decision(
        'project',
        0.89,
        'Client-facing proposal generation requires approval before external sharing.',
        research_deliverable_intent='generate_proposal',
        create_project=True,
        approval_required=True,
        agent_id='devops',
        tools_required=['kanban', 'docx'],
        skills_required=['agent-mission-control-ui', 'docx'],
        prompt='Prepare a client proposal and send to the client after approval.',
    )

    result, status = app.agent_os_create_kanban_from_intent({'route': route})

    assert status == 201
    assert 'approval_gate' in result['task_ids']
    board = app.list_task_board({'project': [result['project_id']]})
    by_id = {task['id']: task for task in board['tasks']}
    approval_task = by_id[result['task_ids']['approval_gate']]
    delivery_task = by_id[result['task_ids']['deliver_to_chat']]
    assert approval_task['status'] == 'blocked'
    assert approval_task['parents'] == [result['task_ids']['draft_outline']]
    assert set(delivery_task['parents']) == {result['task_ids']['qa_artifacts'], result['task_ids']['approval_gate']}
    assert 'Approval state: approval_required' in approval_task['body']


def test_agent_os_kanban_creation_is_idempotent_for_same_decision(tmp_path):
    app = load_app(tmp_path)
    route = app.agent_os_route_decision(
        'project',
        0.86,
        'Durable work needs a project container.',
        create_project=True,
        agent_id='devops',
        prompt='Create a project for Agent OS Kanban automation.',
    )

    first, first_status = app.agent_os_create_kanban_from_intent({'route': route})
    second, second_status = app.agent_os_create_kanban_from_intent({'route': route})

    assert first_status == 201
    assert second_status == 200
    assert first['tasks'][0]['id'] == second['tasks'][0]['id']
    assert second['idempotent'] is True
    board = app.list_task_board()
    assert board['summary']['total'] == 5
    assert first['task_ids'] == second['task_ids']
