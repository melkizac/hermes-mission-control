from pathlib import Path

ROOT = Path('/opt/hermes-mission-control')
SRC = ROOT / 'source' / 'src'


def read(path):
    return Path(path).read_text(encoding='utf-8')


def test_phase8_mobile_operator_dock_component_exists_with_field_actions():
    component = SRC / 'components' / 'MobileOperatorDock.tsx'
    assert component.exists()
    text = read(component)
    for needle in [
        'export function MobileOperatorDock',
        'MobileOperatorAction',
        'Needs Attention',
        'Running Now',
        'Browser Activity',
        'Projects',
        'Task Board',
        'aria-label="Mobile operator quick actions"',
        'data-testid="mobile-operator-dock"',
        'data-testid="mobile-operator-action"',
    ]:
        assert needle in text


def test_phase8_dashboard_wires_mobile_operator_actions_to_real_views():
    chat = read(SRC / 'views' / 'MissionControl.tsx')
    dashboard = read(SRC / 'views' / 'Dashboard.tsx')
    for needle in [
        'MobileOperatorDock',
        'mobileOperatorActions',
        'attentionCount={totalAttention}',
        'runningCount={runningTasks + runningBoardTasks.length}',
        'setView("approvals")',
        'setView("browser-ops")',
        'setView("projects")',
        'setView("board")',
        'setView("agents")',
    ]:
        assert needle in dashboard

    for dashboard_only in [
        'MobileOperatorDock',
        'mobileOperatorActions',
        'attentionCount={totalAttention}',
        'runningCount={runningTasks + runningBoardTasks.length}',
        'setView("approvals")',
        'setView("browser-ops")',
        'setView("projects")',
        'setView("board")',
    ]:
        assert dashboard_only not in chat


def test_phase8_mobile_operator_styles_are_fixed_safe_area_and_non_desktop_intrusive():
    styles = read(SRC / 'styles' / 'app.css')
    for needle in [
        '.mobile-operator-dock',
        '.mobile-operator-actions',
        '.mobile-operator-action',
        'env(safe-area-inset-bottom)',
        'position: fixed',
        '@media (max-width: 760px)',
        '@media (min-width: 761px)',
        'display: none',
        'z-index: 130',
    ]:
        assert needle in styles


def test_phase8_mobile_probe_covers_operator_dock_and_quick_action_taps():
    probe = ROOT / 'source' / 'scripts' / 'phase8-mobile-operator-mode-probe.cjs'
    assert probe.exists()
    text = probe.read_text(encoding='utf-8')
    for needle in [
        '390',
        '844',
        'mobile-operator-dock',
        'mobile-operator-action',
        'Browser Activity',
        'Projects',
        'Needs Attention',
        'horizontalOverflow',
        'dockOverlapsMainAction',
    ]:
        assert needle in text
