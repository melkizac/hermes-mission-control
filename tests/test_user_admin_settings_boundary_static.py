from pathlib import Path

SRC = Path('/opt/hermes-mission-control/source/src')


def read(rel):
    return (SRC / rel).read_text(encoding='utf-8')


def test_user_system_nav_separates_account_preferences_rate_limits_docs_logout_from_admin():
    nav = read('components/NavRail.tsx')

    assert '{ key: "profile", label: "Account / Profile"' in nav
    assert '{ key: "workspace-preferences", label: "Workspace Preferences"' in nav
    assert '{ key: "usage", label: "Rate limits"' in nav
    assert '{ href: "/docs#daily-flow", label: "Docs"' in nav
    assert '{ action: "logout", label: "Log out"' in nav
    assert '{ key: "settings", label: "Settings"' not in nav

    user_nav_block = nav.split('const simplifiedWorkspaceGroups: NavGroup[] = [', 1)[1].split('const adminConsoleGroups', 1)[0]
    admin_nav_block = nav.split('const adminConsoleGroups: NavGroup[] = [', 1)[1].split('// S1 route preservation note', 1)[0]

    assert 'Admin Console' not in user_nav_block
    assert 'Workspace Runtime Console' not in user_nav_block
    assert 'Capabilities' not in user_nav_block
    assert 'Model Router' not in user_nav_block
    assert 'Approval Rules' not in user_nav_block
    assert 'Quota' not in user_nav_block

    for admin_label in ['Admin Console', 'Workspace Runtime Console', 'Capabilities', 'Model Router', 'Approval Rules', 'Quota']:
        assert admin_label in admin_nav_block


def test_workspace_preferences_route_is_user_accessible_not_admin_only():
    app = read('App.tsx')
    types = read('types.ts')
    permissions = read('services/uiPermissions.ts')
    deep_links = read('services/deepLinks.ts')
    account = read('views/AccountSettings.tsx')

    assert '| "workspace-preferences"' in types
    assert 'view === "workspace-preferences" && <AccountSettings initialSection="preferences" />' in app
    assert '"workspace-preferences",' in permissions
    assert '"workspace-preferences": "Workspace Preferences"' in permissions
    assert '"workspace-preferences",' in deep_links

    admin_only_block = permissions.split('export const adminOnlyViews = new Set<ViewKey>([', 1)[1].split(']);', 1)[0]
    assert 'workspace-preferences' not in admin_only_block

    assert 'initialSection?: "profile" | "preferences"' in account
    assert 'Review user-owned defaults for agents, projects, notifications, timezone, and voice without entering the Admin Console.' in account
