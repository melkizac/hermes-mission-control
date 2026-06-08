from pathlib import Path
from uuid import uuid4

from test_multi_user_phase1 import load_app
from test_multi_user_phase2_phase3 import make_user

ROOT = Path('/opt/hermes-mission-control')
SRC = ROOT / 'source' / 'src'


def _fake_agent(agent_id='devops'):
    return {
        'id': agent_id,
        'name': 'DevOps Builder',
        'squad': 'Builders',
        'status': 'idle',
        'profilePath': f'/profiles/{agent_id}',
        'skills': [{'id': 'kanban-worker', 'name': 'kanban-worker', 'source': 'Hermes'}],
        'tools': [{'id': 'browser', 'name': 'Browser automation', 'kind': 'mcp-server', 'enabled': True, 'toolCount': 4, 'sampleTools': ['click', 'type']}],
        'profile_details': {
            'profile_id': agent_id,
            'plugins': {
                'enabled': 1,
                'total': 1,
                'items': [{'id': 'platforms/telegram', 'name': 'Telegram gateway', 'enabled': True, 'status': 'enabled', 'source': 'bundled'}],
            },
        },
    }


def test_capability_matrix_combines_skills_plugins_tools_and_registry_records(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    admin = app.authenticate_user('melverick', 'admin-secret')
    monkeypatch.setattr(app, 'list_agents_payload', lambda identity=None: [_fake_agent('devops')])

    cap_id = f'cap-docling-{uuid4().hex}'
    created, status = app.capability_registry_register_payload(admin, cap_id, {
        'id': cap_id,
        'type': 'cli-tool',
        'name': 'docling',
        'displayName': 'Docling document parser',
        'visibility': 'workspace',
        'workspaceId': 'ws_melverick',
        'ownerKind': 'workspace',
        'governance': {'riskLevels': ['read-only'], 'approvalStatus': 'not-required'},
        'assignment': {'assignmentUnit': 'cli-wrapper', 'assignedAgents': [{'id': 'devops', 'name': 'DevOps Builder'}]},
    })
    assert status == 201, created

    payload, matrix_status = app.capability_registry_matrix_payload({'agent': ['devops']}, admin)

    assert matrix_status == 200
    row = payload['matrix'][0]
    types = {cap['type'] for cap in row['capabilities']}
    assert {'skill', 'mcp-server', 'plugin', 'cli-tool'} <= types
    assert any(cap['source'] == 'profile-plugin' and cap['displayName'] == 'Telegram gateway' for cap in row['capabilities'])
    assert any(cap['source'] == 'registry' and cap['assigned'] is True and cap['id'] == cap_id for cap in row['capabilities'])
    assert row['summary']['skills'] >= 1
    assert row['summary']['tools'] >= 3
    assert row['summary']['registry'] >= 1


def test_capability_assignment_flow_enforces_governance_then_assigns_and_unassigns(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    admin = app.authenticate_user('melverick', 'admin-secret')
    monkeypatch.setattr(app, 'list_agents_payload', lambda identity=None: [_fake_agent('devops')])

    cap_id = f'cap-publisher-{uuid4().hex}'
    created, status = app.capability_registry_register_payload(admin, cap_id, {
        'id': cap_id,
        'type': 'api-connector',
        'name': 'publisher',
        'displayName': 'Publisher',
        'visibility': 'workspace',
        'workspaceId': 'ws_melverick',
        'ownerKind': 'workspace',
        'governance': {'riskLevels': ['external-publish']},
    })
    assert status == 201, created

    blocked, blocked_status = app.capability_registry_assignment_payload(admin, cap_id, {'agentId': 'devops', 'agent': {'id': 'devops', 'name': 'DevOps Builder'}})
    assert blocked_status == 409
    assert blocked['status'] == 'blocked'
    assert blocked['blockedCapability']['blocker']['requiredApprover'] == 'melverick'

    approved, approve_status = app.capability_registry_status_payload(admin, cap_id, 'approve', {'decisionNote': 'approved for controlled test'})
    assert approve_status == 200, approved

    assigned, assign_status = app.capability_registry_assignment_payload(admin, cap_id, {'agentId': 'devops', 'agent': {'id': 'devops', 'name': 'DevOps Builder'}, 'reason': 'test assignment'})
    assert assign_status == 200, assigned
    refs = assigned['capability']['assignment']['assignedAgents']
    assert refs == [{'id': 'devops', 'name': 'DevOps Builder', 'enabled': True, 'reason': 'test assignment'}]

    unassigned, unassign_status = app.capability_registry_assignment_payload(admin, cap_id, {'action': 'unassign', 'agentId': 'devops'})
    assert unassign_status == 200, unassigned
    assert unassigned['capability']['assignment']['assignedAgents'] == []


def test_agent_profile_surface_exposes_capability_matrix_without_admin_redirect():
    panel = (SRC / 'components' / 'ContextPanel.tsx').read_text(encoding='utf-8')
    perms = (SRC / 'services' / 'uiPermissions.ts').read_text(encoding='utf-8')

    assert 'getCapabilityMatrix({ agent: agent.id })' in panel
    assert 'Workspace capability matrix' in panel
    assert 'Agent/Profile surface · no Admin redirect required' in panel
    assert 'Assignable registry capabilities' in panel
    assert 'assignCapability(capability.id' in panel
    assert 'unassignCapability(capability.id' in panel
    assert 'Capability Registry' in perms  # Admin registry can stay admin-only while Agent/Profile shows the matrix.
