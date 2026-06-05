from pathlib import Path

SRC = Path('/opt/hermes-mission-control/source/src')


def read(rel):
    return (SRC / rel).read_text(encoding='utf-8')


def test_home_is_nontechnical_ask_hermes_command_center():
    home = read('views/MissionControl.tsx')
    cards = read('components/ChatActionCard.tsx')
    css = read('styles/app.css')

    for phrase in [
        'clean-chat-page',
        'main-chat-surface',
        'Melkizac — All Groups Agent',
        'Send a task or message to Melkizac...',
        'Full access',
        '5.5 Medium',
        'No Project selected',
    ]:
        assert phrase in home

    dashboard = read('views/Dashboard.tsx')

    for card_type in [
        'proposed_mission',
        'running_mission',
        'approval_required',
        'blocked_mission',
        'completed_mission',
        'routine_suggested',
    ]:
        assert card_type in cards
        assert card_type not in dashboard
        assert card_type not in home

    for label in [
        'Mission proposed',
        'Mission running',
        'Blocked',
        'Completed',
        'Routine suggested',
    ]:
        assert label in cards

    assert 'mission-card-grid' not in home
    assert 'mission-card-grid' not in dashboard
    assert '.mission-card-grid' in css
    assert '.journey-step-card' in css
    for dashboard_metric in [
        'Agent activity',
        'What agents are doing',
        'Latest agent outputs',
        'Usage snapshot',
    ]:
        assert dashboard_metric in dashboard


def test_workspace_nav_uses_customer_language_for_agent_org():
    nav = read('components/NavRail.tsx')
    workspace_block = nav.split('const simplifiedWorkspaceGroups', 1)[1].split('const adminConsoleGroups', 1)[0]

    assert 'label: "AI Workforce"' in workspace_block
    assert 'label: "Agent Org"' not in workspace_block
    assert 'key: "agent-org"' in workspace_block
