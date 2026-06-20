from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_top_bar_no_longer_renders_user_admin_toggle():
    app = (ROOT / "src/App.tsx").read_text()

    assert '<AdminUserModeToggle />' not in app
    assert 'function AdminUserModeToggle()' not in app
    assert '<NeedsAttentionBell />' in app


def test_settings_menu_contains_profile_mode_toggle_for_admin_accounts():
    rail = (ROOT / "src/components/NavRail.tsx").read_text()

    assert 'permissions.accountIsAdmin && (' in rail
    assert 'settings-mode-toggle' in rail
    assert '>\n                    User\n                  </button>' in rail
    assert '>\n                    Admin\n                  </button>' in rail
    assert 'User mode' not in rail
    assert 'Admin mode' not in rail
    assert 'settings-mode-label' not in rail
    assert '>Profile<' not in rail
    assert 'window.history.pushState({}, "", "/app");' in rail
    assert 'window.history.pushState({}, "", "/admin");' in rail
    assert 'setUiMode("workspace");' in rail
    assert 'setUiMode("admin");' in rail
    assert '{!collapsed && (' in rail


def test_mode_toggle_styles_are_scoped_to_settings_menu():
    css = (ROOT / "src/styles/app.css").read_text()

    assert ':root { --top-chrome-reserve: 0px; }' in css
    assert '.settings-mode-toggle' in css
    assert '.settings-mode-toggle-button' in css
    assert 'border-radius: 999px' in css
    assert 'padding: 4px' in css
    assert '.settings-mode-label' not in css
    assert '.top-mode-toggle' not in css
