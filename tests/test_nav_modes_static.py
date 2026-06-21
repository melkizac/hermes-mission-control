from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STORE = (ROOT / "src/services/store.tsx").read_text(encoding="utf-8")
NAV = (ROOT / "src/components/NavRail.tsx").read_text(encoding="utf-8")


def test_user_expert_admin_modes_are_available():
    assert 'type UiMode = "workspace" | "expert" | "admin";' in STORE
    assert 'mode === "expert" ? "agent-org"' in STORE
    assert 'function switchToExpertMode()' in NAV
    assert 'setUiMode("expert")' in NAV
    assert 'setView("agent-org")' in NAV
    assert '>\n                    Expert\n                  </button>' in NAV
    assert 'User' in NAV and 'Admin' in NAV
