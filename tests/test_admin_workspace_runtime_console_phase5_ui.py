from pathlib import Path

SRC = Path('/opt/hermes-mission-control/source/src')


def read(rel):
    return (SRC / rel).read_text(encoding='utf-8')


def test_phase5_admin_nav_exposes_workspace_runtime_console():
    nav = read('components/NavRail.tsx')
    types = read('types.ts')
    app = read('App.tsx')

    assert 'workspace-runtime-console' in types
    assert 'Workspace Runtime Console' in nav
    assert 'view === "workspace-runtime-console"' in app


def test_phase5_runtime_console_ui_has_selector_and_explicit_modes():
    page = read('views/AdminSetupPage.tsx')

    assert 'WorkspaceRuntimeConsolePanel' in page
    assert 'aria-label="Select workspace runtime"' in page
    assert 'Mode: Supervise' in page
    assert 'Mode: Manage' in page
    assert 'Mode: Impersonate / operate as user' in page
    assert 'Supervise mode does not expose private user chat or memory by default.' in page
    assert '/api/admin/workspaces/${encodeURIComponent(selectedWorkspaceId)}/runtime-console' in page


def test_phase5_impersonation_ui_requires_reason_and_posts_audit_action():
    page = read('views/AdminSetupPage.tsx')

    assert 'impersonationReason' in page
    assert 'Reason for impersonation' in page
    assert 'This is visually obvious and audit logged before any user-context action.' in page
    assert '/api/admin/workspaces/${encodeURIComponent(selectedWorkspaceId)}/runtime-console/action' in page
    assert 'admin-runtime-console-impersonation-warning' in page
