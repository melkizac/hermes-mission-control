from pathlib import Path

SRC = Path('/opt/hermes-mission-control/source/src')


def read(rel):
    return (SRC / rel).read_text(encoding='utf-8')


def test_admin_user_toggle_lives_in_app_top_right_not_left_rail():
    app = read('App.tsx')
    nav = read('components/NavRail.tsx')

    assert 'function AdminUserModeToggle()' in app
    assert '<AdminUserModeToggle />' in app
    assert 'className="top-mode-toggle"' in app
    assert 'aria-label="Admin and user mode toggle"' in app
    assert 'User' in app
    assert 'Admin' in app
    assert 'admin-console-switch' not in nav
    assert 'User Workspace' not in nav


def test_top_right_toggle_preserves_mode_switch_defaults():
    app = read('App.tsx')

    assert 'setUiMode("admin")' in app
    assert 'setView("settings")' in app
    assert 'setUiMode("workspace")' in app
    assert 'setView("mission")' in app
    assert 'permissions.accountIsAdmin' in app


def test_top_right_toggle_has_fixed_top_right_css():
    css = read('styles/app.css')

    assert '.top-mode-toggle' in css
    assert 'position: fixed;' in css
    assert 'top: 18px;' in css
    assert 'right: 22px;' in css
    assert '.top-mode-toggle .mode-button' in css
