from pathlib import Path

SRC = Path('/opt/hermes-mission-control/source/src')


def read(rel):
    return (SRC / rel).read_text(encoding='utf-8')


def test_pending_approvals_bell_matches_approval_queue_and_user_nav():
    app = read('App.tsx')
    nav = read('components/NavRail.tsx')

    assert 'function NeedsAttentionBell()' in app
    assert '<NeedsAttentionBell />' in app
    assert 'const pendingFromSummary = Number(summary?.drafted ?? 0) + Number(summary?.ready ?? 0);' in app
    assert 'setView("approvals")' in app
    assert 'if (approvalCount <= 0) return null;' in app
    assert 'aria-label={`Pending approvals: ${approvalCount}`}' in app
    assert 'top-attention-bell' in app
    assert '{ key: "approvals", label: "Approvals", icon: "approvals" }' in nav


def test_pending_approvals_bell_does_not_double_count_attention_sources():
    app = read('App.tsx')
    bell = app.split('function NeedsAttentionBell()', 1)[1].split('function AdminOnlyNotice', 1)[0]

    assert '/api/inbox' in bell
    assert '/api/status' not in bell
    assert '/api/automations' not in bell
    assert '/api/task-board' not in bell
    assert 'high_risk' not in bell
    assert 'blocked' not in bell


def test_top_right_actions_wrap_toggle_and_bell_with_bell_rightmost():
    app = read('App.tsx')
    css = read('styles/app.css')

    assert 'className="top-right-actions"' in app
    assert '<AdminUserModeToggle />' in app
    assert '<NeedsAttentionBell />' in app
    assert app.index('<AdminUserModeToggle />') < app.index('<NeedsAttentionBell />')
    assert '.top-right-actions' in css
    assert 'position: fixed;' in css
    assert 'right: 22px;' in css
    assert '.top-attention-bell' in css
    assert '.attention-count' in css


def test_bell_icon_is_available_for_top_attention_button():
    icon = read('components/Icon.tsx')

    assert '| "bell"' in icon
    assert 'bell:' in icon
