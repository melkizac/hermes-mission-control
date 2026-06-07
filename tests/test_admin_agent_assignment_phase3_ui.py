from pathlib import Path

SRC = Path('/opt/hermes-mission-control/source/src')


def read(rel):
    return (SRC / rel).read_text(encoding='utf-8')


def test_phase3_user_access_types_include_effective_agent_sources():
    page = read('views/AdminSetupPage.tsx')

    assert 'access_sources: AgentAccessSource[];' in page
    assert 'access_source_label: string;' in page
    assert 'assigned_by_role?: string | null;' in page
    assert 'effective_agent_ids: string[];' in page
    assert 'Role assignment: user' in page


def test_phase3_user_access_ui_renders_effective_agent_source_copy():
    page = read('views/AdminSetupPage.tsx')

    assert 'Effective Workspace agents' in page
    assert 'Direct user assignment' in page
    assert 'Role assignment' in page
    assert 'agent.access_source_label' in page
    assert 'effective access source' in page.lower()


def test_phase3_user_access_ui_has_role_assignment_controls():
    page = read('views/AdminSetupPage.tsx')

    assert 'roleAgentAssignments' in page
    assert '/api/admin/roles/' in page
    assert 'Workspace role assignments' in page
    assert 'saveRoleAgents' in page
