import re
from pathlib import Path

SRC = Path('/opt/hermes-mission-control/source/src')


def read(rel):
    return (SRC / rel).read_text(encoding='utf-8')


def test_phase7_has_typed_ui_permissions_contract():
    permissions = read('services/uiPermissions.ts')

    assert 'export const adminOnlyViews' in permissions
    assert '"agent-org"' in permissions
    assert '"runtimes"' in permissions
    assert '"tools"' in permissions
    assert '"skills"' in permissions
    assert '"models"' in permissions
    assert '"settings"' in permissions
    assert 'export function isAdminRole' in permissions
    assert 'export function canAccessView' in permissions
    assert 'export function viewLabelForRole' in permissions
    assert 'My Projects' in permissions
    assert 'My Task Board' in permissions
    assert 'My Agents' in permissions


def test_phase7_store_fetches_me_and_guards_forbidden_views():
    store = read('services/store.tsx')
    client = read('services/hermesClient.ts')
    http = read('services/httpHermesClient.ts')

    assert 'me: MissionControlMe | null;' in store
    assert 'permissions: UiPermissions;' in store
    assert 'client.getMe()' in store
    assert 'const nextAccountRole = nextMe?.user?.role;' in store
    assert re.search(
        r'const nextRole = nextAccountRole === "admin" && uiMode === "admin"\s*\? "admin"\s*:\s*nextAccountRole === "admin"\s*\? "user"\s*:\s*nextAccountRole;',
        store,
    )
    assert 'canAccessView(nextRole, next)' in store
    assert 'safeDefaultViewForRole(nextRole)' in store
    assert 'getMe(): Promise<MissionControlMe>;' in client
    assert 'request<MissionControlMe>("/api/me")' in http


def test_phase7_nav_hides_admin_setup_for_non_admin_users():
    nav = read('components/NavRail.tsx')

    assert 'const { view, setView, uiMode, agents, me } = useStore();' in nav
    assert 'const visibleGroups = uiMode === "admin" ? adminConsoleGroups : primaryGroups;' in nav
    assert 'label: "Workspace"' in nav
    assert 'label: "My AI Workforce"' in nav
    assert 'label: "Knowledge & Evidence"' in nav
    assert 'label: "Evidence"' not in nav.split('const simplifiedWorkspaceGroups', 1)[1].split('const adminConsoleGroups', 1)[0]
    assert 'label: "Account"' in nav
    assert 'permissions.canAccessAdmin &&' not in nav
    assert 'permissions.canManageRuntime &&' not in nav
    assert 'workspace-pill' in nav
    assert 'me?.workspace?.name' in nav


def test_phase7_agent_details_are_read_only_for_normal_users():
    panel = read('components/ContextPanel.tsx')

    assert 'permissions.canEditGlobalAgents' in panel
    assert 'canEditAgent' in panel
    assert 'Read-only workspace selection' in panel
    assert 'canEditAgent &&' in panel
    assert 'removeSkill(s.id)' in panel
    assert 'confirmDelete(agent, deleteAgent)' in panel
    assert 'setEditing(f)' in panel
    assert 'canEditAgentIdentity' in panel
    assert 'disabled={!canEditFile(f)}' in panel


def test_phase7_app_blocks_direct_admin_view_render_for_non_admins():
    app = read('App.tsx')

    assert 'permissions.canAccessAdmin' in app
    assert 'adminOnlyViews.has(view)' in app
    assert re.search(r'canAccessView\(me\?\.user\?\.role, view\)', app)
    assert 'safeDefaultViewForRole(me?.user.role)' in app
    assert 'AdminOnlyNotice' in app
    assert 'This area is restricted to Mission Control admins' in app
