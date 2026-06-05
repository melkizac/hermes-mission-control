from pathlib import Path

SRC = Path('/opt/hermes-mission-control/source/src')


def read(rel):
    return (SRC / rel).read_text(encoding='utf-8')


def test_store_exposes_admin_workspace_mode_switch():
    store = read('services/store.tsx')

    assert 'type UiMode = "workspace" | "admin"' in store
    assert 'uiMode: UiMode;' in store
    assert 'setUiMode: (mode: UiMode) => void;' in store
    assert 'const [uiMode, setRawUiMode] = useState<UiMode>("workspace");' in store
    assert 'effectiveRole' in store
    assert 'me?.user.role === "admin" && uiMode === "admin" ? "admin" : me?.user.role === "admin" ? "user" : me?.user.role' in store
    assert 'permissionsForRole(effectiveRole, me?.user.role)' in store


def test_app_has_visible_admin_user_switch_for_admins():
    app = read('App.tsx')
    nav = read('components/NavRail.tsx')

    assert 'function AdminUserModeToggle()' in app
    assert 'uiMode' in app
    assert 'setUiMode' in app
    assert 'permissions.accountIsAdmin' in app
    assert 'Admin' in app
    assert 'User' in app
    assert 'top-mode-toggle' in app
    assert 'setUiMode("admin")' in app
    assert 'setUiMode("workspace")' in app
    assert 'admin-console-switch' not in nav


def test_permissions_distinguish_account_admin_from_active_admin_console():
    permissions = read('services/uiPermissions.ts')

    assert 'accountIsAdmin: boolean;' in permissions
    assert 'permissionsForRole(role: UserRole, accountRole?: UserRole)' in permissions
    assert 'accountIsAdmin: isAdminRole(accountRole ?? role)' in permissions
    assert 'const admin = isAdminRole(role)' in permissions


def test_admin_console_switch_has_css_affordance():
    css = read('styles/app.css')

    assert '.top-mode-toggle' in css
    assert '.top-mode-toggle .mode-button' in css
    assert '.top-mode-toggle .mode-button.on' in css
