from pathlib import Path

ROOT = Path('/opt/hermes-mission-control')
SRC = ROOT / 'source' / 'src'
APP = ROOT / 'app.py'


def src(rel):
    return (SRC / rel).read_text(encoding='utf-8')


def app_py():
    return APP.read_text(encoding='utf-8')


def test_phase6_deep_link_contract_exists_for_mobile_operator_targets():
    deep_links = src('services/deepLinks.ts')
    store = src('services/store.tsx')
    app = src('App.tsx')

    for needle in [
        'export type MissionControlDeepLinkTarget',
        'parseMissionControlDeepLink',
        'buildMissionControlUrl',
        'view=approvals&approval=',
        'view=board&task=',
        'view=agents&agent=',
    ]:
        assert needle in deep_links

    assert 'initialDeepLinkTarget' in store
    assert 'applyDeepLinkTarget' in store
    assert 'window.addEventListener("popstate"' in app


def test_phase6_deep_links_auto_open_task_approval_and_agent_contexts():
    task_board = src('views/TaskBoard.tsx')
    approvals = src('views/Approvals.tsx')
    agents = src('views/Agents.tsx')

    for needle in [
        'parseMissionControlDeepLink',
        'deepLinkedTaskId',
        'setDetailTab("overview")',
        'client.getTaskResult(deepLinkedTaskId)',
        'data-deeplink-target="task"',
    ]:
        assert needle in task_board

    for needle in [
        'parseMissionControlDeepLink',
        'deepLinkedApprovalId',
        'setStatus("all")',
        'data-deeplink-target="approval"',
    ]:
        assert needle in approvals

    assert 'data-deeplink-target="agent-chat"' in agents


def test_phase6_operator_alert_payloads_include_direct_mission_control_links():
    app = app_py()
    client = src('services/hermesClient.ts')
    http = src('services/httpHermesClient.ts')
    types = src('types.ts')

    for needle in [
        'def mission_control_action_link',
        'def operator_alert_payload',
        "'/api/operator-links/preview'",
        'view=approvals&approval=',
        'view=board&task=',
        'view=agents&agent=',
        'Action:',
        'Open:',
    ]:
        assert needle in app

    assert 'export interface OperatorLinkPreviewResponse' in types
    assert 'getOperatorLinkPreview' in client
    assert 'getOperatorLinkPreview' in http


def test_phase6_mobile_regression_probe_is_checked_in_and_covers_core_views():
    probe = ROOT / 'source' / 'scripts' / 'phase6-mobile-regression-probe.cjs'
    assert probe.exists()
    text = probe.read_text(encoding='utf-8')
    for needle in [
        '390',
        '844',
        'Mission Control',
        'Task Board',
        'Approval Gates',
        'Projects',
        'My Agents',
        'horizontalOverflow',
        'bottomNavOverlap',
        'composerCovered',
    ]:
        assert needle in text
