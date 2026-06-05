from pathlib import Path

SRC = Path('/opt/hermes-mission-control/source/src')


def read(rel):
    return (SRC / rel).read_text(encoding='utf-8')


def test_nav_uses_mutually_exclusive_user_and_admin_nav_groups():
    nav = read('components/NavRail.tsx')

    assert 'const adminConsoleGroups: NavGroup[]' in nav
    assert 'label: "Platform"' in nav
    assert 'label: "Runtime"' in nav
    assert 'label: "Governance"' in nav
    assert 'const visibleGroups = uiMode === "admin" ? adminConsoleGroups : primaryGroups;' in nav
    assert 'visibleGroups.map((group)' in nav
    assert 'primaryGroups.map((group)' not in nav


def test_admin_console_does_not_repeat_settings_nested_admin_items():
    nav = read('components/NavRail.tsx')

    assert 'label: "Account"' in nav
    assert 'label: "Profile"' in nav
    assert 'label: "Logout"' in nav
    assert 'settings-dock' not in nav
    assert 'permissions.canAccessAdmin && (' not in nav
    assert 'permissions.canManageRuntime && (' not in nav
    assert 'settings-role-section' not in nav


def test_switches_land_on_clear_mode_specific_defaults():
    app = read('App.tsx')

    assert 'setView("settings");' in app
    assert 'setView("mission");' in app
