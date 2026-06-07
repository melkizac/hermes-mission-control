from pathlib import Path

SRC = Path('/opt/hermes-mission-control/source/src')


def read(rel):
    return (SRC / rel).read_text(encoding='utf-8')


def test_phase2_admin_agent_platform_has_class_policy_types_and_helpers():
    page = read('views/AdminSetupPage.tsx')

    assert 'agent_class: AgentClass;' in page
    assert 'type AssignmentPolicy' in page
    assert 'assignment_policy: AssignmentPolicy;' in page
    assert 'function agentClassLabel' in page
    assert 'Platform (Admin-only)' in page
    assert 'Workspace (assignable to users/roles)' in page
    assert 'Personal (user-owned/policy template)' in page
    assert 'function AgentClassBadge' in page
    assert 'function AgentAssignmentPolicyNote' in page


def test_phase2_admin_assignment_controls_are_workspace_assignable_only():
    page = read('views/AdminSetupPage.tsx')

    assert 'const assignableAgentTemplates = availableAgentTemplates.filter((agent) => agent.assignment_policy?.assignable_to_users);' in page
    assert 'assignableAgentTemplates.map((agent)' in page
    assert 'Platform agents are Admin-only and do not appear in normal-user assignment controls.' in page
    assert 'Workspace agents can be assigned to users or roles.' in page
    assert 'agent.assignment_policy?.reason' in page
    assert '<AgentClassBadge agent={agent}' in page


def test_phase2_admin_platform_view_renders_agent_class_summary():
    page = read('views/AdminSetupPage.tsx')

    assert 'agent_class_summary' in page
    assert '<h3>Agent classes</h3>' in page
    assert 'Platform agents are internal Mission Control operators' in page
    assert 'Workspace agents are the assignable digital coworkers users see in their own runtime.' in page
