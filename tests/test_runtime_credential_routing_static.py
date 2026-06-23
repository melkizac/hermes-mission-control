from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_backend_has_profile_scoped_runtime_credential_operations():
    app = (ROOT / "backend/app.py").read_text()

    assert "def list_profile_runtime_credentials" in app
    assert "def apply_profile_runtime" in app
    assert "def smoke_test_profile_runtime" in app
    assert "credential_label" in app
    assert "credential_pool_strategies" in app
    assert "fill_first" in app
    assert "hermes gateway restart" not in app  # must be argv-based, not shell string
    assert "last_error_reason" in app
    assert "token_revoked" in app
    assert "token_invalidated" in app
    assert "Auto-discovered from Hermes auth.json credential pool" in app
    assert "Codex-NexiusLabs" not in app  # labels come from auth.json, not hardcoded secrets/config


def test_agent_runtime_assignment_uses_account_credentials_not_fake_models():
    app = (ROOT / "backend/app.py").read_text()
    snippet = app.split("def write_agent_runtime_assignment", 1)[1].split("def agent_runtime_assignment", 1)[0]

    assert "apply_profile_runtime" in snippet
    assert "credential_label" in snippet
    assert "provider" in snippet
    assert "model_value" in snippet
    assert "canonical_model" in snippet
    assert "codex-melverick" in snippet
    assert "codex-nexiuslabs" in snippet
    assert "gateway_restarted" in snippet
    assert "smoke_test" in snippet


def test_ui_shows_separate_model_and_codex_account_selectors():
    panel = (ROOT / "src/components/ContextPanel.tsx").read_text()

    assert "Model for" in panel
    assert "Codex account for" in panel
    assert "Choose model" in panel
    assert "Choose Codex account" in panel
    assert "credentialHealthLabel" in panel  # still used internally to block unavailable credentials
    assert "credential-health" not in panel  # health details are intentionally hidden from the UI
    assert "credential_label" in panel
    assert "modelAccountOptionLabel" not in panel
    assert "Choose model / quota account" not in panel
