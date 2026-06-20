from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_store_supports_expert_mode_without_admin_permissions():
    source = (ROOT / "src/services/store.tsx").read_text()

    assert 'type UiMode = "workspace" | "expert" | "admin";' in source
    assert 'if (mode === "expert") return "models";' in source
    assert 'const startsInExpert = startingPath === "/expert";' in source
    assert 'startsInExpert ? "expert" : "workspace"' in source
    assert 'uiMode === "admin" ? "admin"' in source
    assert 'if (target.mode) setRawUiMode(target.mode);' in source


def test_top_mode_toggle_renders_user_expert_admin():
    app = (ROOT / "src/App.tsx").read_text()
    css = (ROOT / "src/styles/app.css").read_text()

    assert 'function switchToExpert()' in app
    assert 'window.history.pushState({}, "", "/expert");' in app
    assert 'setUiMode("expert");' in app
    assert 'setView("models");' in app
    assert 'aria-label="User, expert, and admin mode toggle"' in app
    assert 'uiMode === "expert"' in app
    assert '>\n        Expert\n      </button>' in app
    assert 'grid-template-columns: repeat(3, 1fr)' in css


def test_expert_deep_link_round_trips():
    source = (ROOT / "src/services/deepLinks.ts").read_text()

    assert 'mode?: "workspace" | "expert" | "admin";' in source
    assert 'if (normalizedPath === "/expert") target.mode = "expert";' in source
    assert 'if (!target.view && normalizedPath === "/expert") target.view = "models";' in source
    assert 'target.mode === "expert" || view === "models"' in source
    assert '? "/expert"' in source


def test_expert_nav_is_distinct_from_user_nav_without_admin_console():
    source = (ROOT / "src/components/NavRail.tsx").read_text()

    assert 'const expertWorkspaceGroups: NavGroup[]' in source
    assert 'label: "Build"' in source
    assert 'label: "Inspect"' in source
    assert 'uiMode === "expert" ? expertWorkspaceGroups : simplifiedWorkspaceGroups' in source
    expert_section = source.split('const expertWorkspaceGroups: NavGroup[]', 1)[1].split('const adminConsoleGroups', 1)[0]
    assert 'Users & Workspaces' not in expert_section
    assert 'Workspace Runtime Console' not in expert_section
