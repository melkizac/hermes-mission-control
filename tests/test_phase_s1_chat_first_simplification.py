from pathlib import Path

SRC = Path('/opt/hermes-mission-control/source/src')


def read(rel):
    return (SRC / rel).read_text(encoding='utf-8')


def test_workspace_nav_is_chat_first_five_section_ia_and_preserves_advanced_access():
    nav = read('components/NavRail.tsx')
    perms = read('services/uiPermissions.ts')
    app = read('App.tsx')
    deep_links = read('services/deepLinks.ts')

    assert 'const simplifiedWorkspaceGroups' in nav
    for label in ['label: "Chat"', 'label: "Dashboard"', 'label: "Projects"', 'label: "Task Board"', 'label: "Agents"', 'label: "AI Workforce"', 'label: "Approvals"', 'label: "Settings"']:
        assert label in nav

    # Internal/technical primitives should not be top-level workspace nav labels anymore.
    # User-requested operational shortcuts remain visible: Task Board, Agents, Agent Org.
    workspace_block = nav.split('const simplifiedWorkspaceGroups', 1)[1].split('const adminConsoleGroups', 1)[0]
    for legacy_label in [
        'Delegate Work',
        'Workflow Library',
        'Work',
        'Evidence',
        'My Projects',
        'My Task Board',
        'My Agents',
        'My Agent Org',
        'Routines',
        'Browser Activity',
        'Research Runs',
        'Workspace Knowledge',
        'My Audit / Evidence',
    ]:
        assert f'label: "{legacy_label}"' not in workspace_block

    # Advanced capabilities remain routable/deep-linkable when they have a distinct job.
    for view in ['"delegate-work"', '"workflow-library"', '"projects"', '"board"', '"agents"', '"automations"', '"browser-ops"', '"research-runs"', '"audit"']:
        assert view in perms
        assert view in deep_links
        assert f'view === {view}' in app

    # Top-level page links such as /reflections should render their named view,
    # not fall back to the chat surface after login.
    assert 'const topLevelView = normalizedPath.startsWith("/") ? normalizedPath.slice(1) as ViewKey : null;' in deep_links
    assert 'if (topLevelView && allowedViews.has(topLevelView)) target.view = topLevelView;' in deep_links


def test_mode_toggle_defaults_land_on_home_and_admin_overview():
    app = read('App.tsx')
    store = read('services/store.tsx')

    assert 'function switchToUser()' in app
    assert 'setUiMode("workspace")' in app
    assert 'setView("mission")' in app
    assert 'function switchToAdmin()' in app
    assert 'setUiMode("admin")' in app
    assert 'setView("settings")' in app

    assert 'const defaultViewForUiMode = (mode: UiMode): ViewKey => mode === "admin" ? "settings" : "mission";' in store
    assert 'setRawView(defaultViewForUiMode(mode));' in store


def test_home_is_chat_first_with_suggested_business_prompts_and_action_cards():
    home = read('views/MissionControl.tsx')
    app = read('App.tsx')
    card = read('components/ChatActionCard.tsx')

    assert 'clean-chat-page' in home
    assert 'main-chat-surface' in home
    assert 'Melkizac — All Groups Agent' in home
    assert 'Send a task or message to Melkizac...' in home
    assert 'Full access' in home
    assert '5.5 Medium' in home
    assert 'No Project selected' in home
    assert 'sendToAgent("default", composeInstructionContext(instruction)' in home

    for card_type in ['task_created', 'workflow_suggested', 'approval_required', 'browser_running', 'evidence_ready', 'connection_needed', 'human_action_needed']:
        assert card_type in card

    assert 'ChatActionCard' not in home
    assert 'import { ChatActionCard' not in home
    assert 'view === "mission"' in app
    assert 'view === "dashboard"' in app


def test_project_task_model_uses_task_detail_evidence_instead_of_evidence_page():
    types = read('types.ts')
    app = read('App.tsx')
    nav = read('components/NavRail.tsx')
    task_board = read('views/TaskBoard.tsx')
    settings = read('views/SettingsDesktop.tsx')
    css = read('styles/app.css')

    assert 'import { WorkHub }' not in app
    assert 'view === "work"' not in app
    assert 'import { EvidenceHub }' not in app
    assert 'view === "evidence"' not in app
    assert 'label: "Work"' not in nav.split('const simplifiedWorkspaceGroups', 1)[1].split('const adminConsoleGroups', 1)[0]
    assert 'label: "Evidence"' not in nav.split('const simplifiedWorkspaceGroups', 1)[1].split('const adminConsoleGroups', 1)[0]

    for view in ['"projects"', '"board"', '"workflow-library"', '"research-runs"']:
        assert view in types
        assert view in app
    assert '"evidence"' not in types

    for label in ['Workflow Library', 'Research Runs']:
        assert label in settings
    for phrase in ['Reusable playbooks', 'Structured investigations', 'instead of a generic Work page']:
        assert phrase in settings

    for label in ['"overview", "evidence", "activity", "execution"', 'Evidence & Proof', 'Task evidence and proof', 'Proof attached to this task']:
        assert label in task_board

    assert '.simplified-hub' in css
    assert '.ask-mission-control' in css
    assert '.chat-action-card' in css
