from pathlib import Path

SRC = Path('/opt/hermes-mission-control/source/src')


def read(rel):
    return (SRC / rel).read_text(encoding='utf-8')


def test_step1_user_mode_nav_groups_and_labels_are_canonical():
    nav = read('components/NavRail.tsx')

    expected = [
        'const simplifiedWorkspaceGroups',
        'label: "Workspace"',
        'label: "Chat"',
        'label: "Projects"',
        'label: "Task Board"',
        'label: "Agents"',
        'label: "AI Workforce"',
        'label: "Approvals"',
        'label: "Settings"',
        'label: "Logout"',
    ]
    for needle in expected:
        assert needle in nav

    workspace_block = nav.split('const simplifiedWorkspaceGroups', 1)[1].split('const adminConsoleGroups', 1)[0]
    for legacy_label in [
        'Mission Control',
        'My Projects',
        'My Task Board',
        'Needs Attention',
        'My AI Workforce',
        'My Agents',
        'My Agent Org',
        'Routines',
        'Knowledge & Evidence',
        'Workspace Knowledge',
        'My Audit / Evidence',
        'Account',
        'Profile',
    ]:
        assert f'label: "{legacy_label}"' not in workspace_block

    assert 'label: "Operate"' not in nav
    assert 'label: "Work"' not in workspace_block
    assert 'label: "Evidence"' not in workspace_block
    assert 'settings-dock' not in nav


def test_step1_user_workspace_permissions_allow_user_mode_pages():
    perms = read('services/uiPermissions.ts')

    workspace_block = perms.split('export const workspaceViews = new Set<ViewKey>([', 1)[1].split(']);', 1)[0]
    for view in ['"mission"', '"profile"', '"agents"', '"agent-org"', '"projects"', '"second-brain"', '"board"', '"approvals"', '"automations"', '"audit"']:
        assert view in workspace_block


def test_step2_admin_mode_nav_groups_and_labels_are_canonical():
    nav = read('components/NavRail.tsx')

    assert 'const adminConsoleGroups' in nav
    expected = [
        'label: "Platform"',
        'label: "Admin Overview"',
        'label: "Users & Workspaces"',
        'label: "Platform Agent Org"',
        'label: "Shared Agent Templates"',
        'label: "Runtime"',
        'label: "Runtime Connectors"',
        'label: "Desktop Gateway"',
        'label: "Workflow Library"',
        'label: "Research Runs"',
        'label: "Model Router"',
        'label: "Tools"',
        'label: "Skills"',
        'label: "Governance"',
        'label: "Global Audit Log"',
        'label: "Costs / Usage"',
        'label: "Approval Policy"',
        'label: "Quota"',
    ]
    for needle in expected:
        assert needle in nav

    admin_block = nav.split('const adminConsoleGroups', 1)[1].split('// S1 route preservation note', 1)[0]
    assert 'label: "Admin Console"' not in admin_block
    assert 'label: "Platform Setup"' not in admin_block
    assert 'label: "Agent Org"' not in admin_block
    assert 'label: "Costs"' not in admin_block
    assert 'label: "Audit Log"' not in admin_block


def test_step2_placeholder_admin_routes_are_admin_only_and_rendered():
    types = read('types.ts')
    perms = read('services/uiPermissions.ts')
    app = read('App.tsx')

    for view in ['"users-workspaces"', '"shared-agent-templates"', '"desktop-gateway"', '"approval-policy"', '"quota"']:
        assert view in types
        assert view in perms
        assert f'view === {view}' in app
