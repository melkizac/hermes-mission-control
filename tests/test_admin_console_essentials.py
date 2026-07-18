from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_admin_dashboard_is_exceptions_first_and_keeps_advanced_tools_available():
    dashboard = read("src/views/admin/AdminDashboardPane.tsx")

    for title in ["System Status", "Agents & Runtimes", "Users & Access", "Safety & Activity"]:
        assert title in dashboard

    assert '<details className="admin-advanced-tools">' in dashboard
    for route in [
        "shared-agent-templates",
        "agent-platform-admin",
        "workflow-library",
        "research-runs",
        "capabilities",
        "automations",
        "costs",
        "quota",
    ]:
        assert f'view: "{route}"' in dashboard

    assert 'className="admin-hub-grid"' not in dashboard
    assert "primaryAreas.map" in dashboard
    assert 'className="admin-primary-card"' in dashboard


def test_admin_navigation_exposes_four_essentials_and_collapses_advanced_routes():
    nav = read("src/components/NavRail.tsx")
    admin_block = nav.split("const adminConsoleGroups", 1)[1].split("// S1 route preservation note", 1)[0]

    assert 'label: "Essentials"' in admin_block
    assert 'label: "Advanced"' in admin_block
    for label in ["System Status", "Agents & Runtimes", "Users & Access", "Safety & Activity"]:
        assert f'label: "{label}"' in admin_block

    assert 'const collapsibleWorkspaceSections = new Set<string>(["Advanced"]);' in nav
    assert 'Advanced: true' in nav

    for route in [
        "runtimes",
        "agent-platform-admin",
        "shared-agent-templates",
        "workflow-library",
        "research-runs",
        "capabilities",
        "automations",
        "audit",
        "costs",
        "quota",
    ]:
        assert f'key: "{route}"' in admin_block


def test_admin_dashboard_summary_has_a_real_admin_only_backend_route():
    backend = read("backend/app.py")
    app = read("src/App.tsx")

    assert "def admin_dashboard_payload(identity):" in backend
    assert "parsed.path == '/api/admin/dashboard'" in backend
    assert "admin_dashboard_payload(current_identity_from_cookie" in backend
    assert 'import { AdminDashboardPane } from "./views/admin/AdminDashboardPane";' in app
    assert 'view === "desktop-gateway" && <AdminDashboardPane />' in app


def test_admin_dashboard_layout_has_mobile_single_column_contract():
    css = read("src/styles/app.css")

    for selector in [
        ".admin-health-summary",
        ".admin-primary-grid",
        ".admin-primary-card",
        ".admin-advanced-tools",
    ]:
        assert selector in css
    assert ".admin-primary-grid { grid-template-columns: 1fr; }" in css
