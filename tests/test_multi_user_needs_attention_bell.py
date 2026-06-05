from pathlib import Path

SRC = Path('/opt/hermes-mission-control/source/src')


def read(rel):
    return (SRC / rel).read_text(encoding='utf-8')


def test_needs_attention_available_in_bell_and_user_nav():
    app = read('App.tsx')
    nav = read('components/NavRail.tsx')

    assert 'function NeedsAttentionBell()' in app
    assert '<NeedsAttentionBell />' in app
    assert 'aria-label={`Needs Attention: ${attentionCount} item' in app
    assert 'setView("approvals")' in app
    assert 'attentionCount > 0' in app
    assert 'top-attention-bell' in app
    assert '{ key: "approvals", label: "Needs Attention", icon: "approvals" }' in nav


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
