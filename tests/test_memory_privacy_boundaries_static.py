from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MEMORY_TSX = ROOT / "src" / "views" / "MemoryContext.tsx"
APP_CSS = ROOT / "src" / "styles" / "app.css"
DEEP_LINKS_TS = ROOT / "src" / "services" / "deepLinks.ts"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_memory_page_separates_user_workspace_session_and_recent_use_scopes():
    src = read(MEMORY_TSX)
    assert 'type MemoryScopeView = "about" | "workspace" | "agent" | "recent";' in src
    assert '["about", "About me"]' in src
    assert '["workspace", "Workspace memory"]' in src
    assert '["agent", "Agent/session context"]' in src
    assert '["recent", "Recent use"]' in src
    assert 'scopeView === "about"' in src
    assert 'scopeView === "workspace"' in src
    assert 'scopeView === "agent"' in src
    assert 'scopeView === "recent"' in src


def test_memory_privacy_copy_distinguishes_memory_from_admin_capabilities():
    src = read(MEMORY_TSX)
    assert 'Memory is not Admin Capabilities' in src
    assert 'Admin Capabilities governs skills, tools, plugins, connectors, and runtime permissions.' in src
    assert 'Memory only guides agent context and personalization; it does not grant new tool access.' in src
    assert 'About me is durable user profile memory used for tone, preferences, and identity assumptions.' in src
    assert 'Workspace memory is durable operational context shared with agents in this workspace.' in src


def test_memory_mutation_controls_are_read_only_until_backend_supports_safe_edits():
    src = read(MEMORY_TSX)
    assert 'Edit and delete are read-only here until the memory backend exposes audited safe mutation endpoints.' in src
    assert 'disabled title="Memory edit is not supported by the current API"' in src
    assert 'disabled title="Memory delete is not supported by the current API"' in src
    assert 'Request correction' in src
    assert 'Request deletion' in src


def test_memory_route_is_deep_linkable_from_user_mode():
    src = read(DEEP_LINKS_TS)
    assert '"memory",' in src
    assert 'normalizedPath.startsWith("/app/")' in src


def test_memory_styles_support_scope_cards_and_privacy_boundary():
    css = read(APP_CSS)
    assert '.memory-privacy-boundary' in css
    assert '.memory-scope-switcher' in css
    assert '.memory-scope-card' in css
    assert '.memory-controls-disabled' in css
