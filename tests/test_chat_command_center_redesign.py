from pathlib import Path

SRC = Path('/opt/hermes-mission-control/source/src')
DOCS = Path('/opt/hermes-mission-control/source/docs/HERMES_MISSION_CONTROL.md')


def read(rel):
    return (SRC / rel).read_text(encoding='utf-8')


def test_nav_has_clean_chat_and_separate_dashboard_routes():
    nav = read('components/NavRail.tsx')
    types = read('types.ts')
    app = read('App.tsx')
    perms = read('services/uiPermissions.ts')
    deep_links = read('services/deepLinks.ts')

    workspace_block = nav.split('const simplifiedWorkspaceGroups', 1)[1].split('const adminConsoleGroups', 1)[0]
    chat_group = workspace_block.split('label: "Workspace"', 1)[0]
    workspace_group = workspace_block.split('label: "Workspace"', 1)[1]
    assert 'key: "mission", label: "Chat", icon: "chat"' in chat_group
    assert 'key: "mission", label: "Chat"' not in workspace_group
    assert 'key: "mission", label: "Chat", icon: "mission"' not in workspace_block
    assert '| "chat"' in read('components/Icon.tsx')
    assert 'key: "dashboard", label: "Dashboard"' in workspace_group
    assert 'key: "mission", label: "Home"' not in workspace_block
    assert 'key={group.label || "primary-chat"}' in nav
    assert '{group.label && <div className="nlabel">{group.label}</div>}' in nav

    for source in [types, app, perms, deep_links]:
        assert '"dashboard"' in source
    assert 'import { Dashboard }' in app
    assert 'view === "dashboard" && <Dashboard />' in app


def test_chat_is_clean_screenshot_style_and_omits_dashboard_panels():
    chat = read('views/MissionControl.tsx')
    dashboard = read('views/Dashboard.tsx')
    css = read('styles/app.css')

    for phrase in [
        'clean-chat-page',
        'main-chat-surface',
        'main-chat-shell',
        'main-chat-header',
        'Melkizac — All Groups Agent',
        'main-chat-history',
        'main-chat-composer',
        'Send a task or message to Melkizac...',
        'Add document or image',
        'Max 50MB',
        'Full access',
        'Ask permission',
        'Draft only',
        'AUTO',
        '5.5 Medium',
        'No Project selected',
    ]:
        assert phrase in chat

    assert 'Select a project to see its missions' not in chat
    assert 'aria-label="Voice input"' in chat
    assert '<svg viewBox="0 0 24 24"' in chat
    assert '♬' not in chat
    assert '♪' not in chat

    # Dashboard-only operational surfaces must not sit below the clean Chat composer.
    for dashboard_only in [
        'Needs attention',
        'Running now',
        'Latest agent outputs',
        'System health',
        'Next recommended actions',
        'Usage snapshot',
        'What agents are doing',
        'MobileOperatorDock',
    ]:
        assert dashboard_only not in chat
        assert dashboard_only in dashboard

    # Dashboard must be metrics/operations, not a duplicate Chat intake surface.
    for chat_only in [
        'Ask Melkizac',
        'chat-command-center',
        'chat-composer-card',
        'suggested-prompts',
        'project-mission-list',
        'mission-card-grid',
        'ChatActionCard',
    ]:
        assert chat_only not in dashboard

    for selector in [
        '.clean-chat-page',
        'width: 100%;',
        'display: block;',
        '.main-chat-surface.clean-chat-page',
        '.main-chat-shell',
        '.main-chat-header',
        '.main-chat-history',
        '.main-chat-row.user',
        '.main-chat-row.agent',
        '.main-chat-composer',
    ]:
        assert selector in css

    assert 'clean-chat-page scroll' not in chat


def test_documentation_describes_clean_chat_and_dashboard_split():
    docs = DOCS.read_text(encoding='utf-8')
    for phrase in [
        '## Chat command center',
        'clean signed-in landing surface',
        'minimal screenshot-like layout',
        'Operational cards, attention panels, running-work summaries, health cards, output panels, and recommended-action blocks belong on the separate **Dashboard** page',
        'main input message box',
        'Do anything',
        'Add document or image up to 50MB',
        'Permission mode',
        'AI model selector',
        'Project selector',
        'No Project selected means Melkizac should not assume a project boundary',
        'Chat does not display any bottom mission list or placeholder rows below the project selector',
        'AUTO means Melkizac chooses the best model per step',
    ]:
        assert phrase in docs
