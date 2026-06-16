from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_model_router_is_authorised_model_allow_list_not_assignment_grid():
    page = (ROOT / "src/views/ModelRouter.tsx").read_text()

    assert "Models & rate limits" in page
    assert "Each model card combines the authorised routing fields with provider rate-limit remaining bars" in page
    assert "Model access & rate limits" in page
    assert "UsageLimitRow" in page
    assert "Agent runtime switcher" not in page
    assert "agent-runtime-grid" not in page


def test_models_and_rate_limits_are_parked_under_settings_nav():
    nav = (ROOT / "src/components/NavRail.tsx").read_text()
    settings = (ROOT / "src/views/SettingsDesktop.tsx").read_text()

    workforce_block = nav.split("label: \"Workforce\"", 1)[1].split("label: \"System\"", 1)[0]
    system_block = nav.split("label: \"System\"", 1)[1].split("const adminConsoleGroups", 1)[0]
    assert 'label: "Model Router"' not in workforce_block
    assert '{ key: "models", label: "Models & limits", icon: "modelRouter" }' in system_block
    assert 'key: "models", eyebrow: "Models", title: "Models & Rate Limits"' in settings


def test_agent_detail_drawer_has_authorised_model_selector_assignment_flow():
    panel = (ROOT / "src/components/ContextPanel.tsx").read_text()
    store = (ROOT / "src/services/store.tsx").read_text()
    client = (ROOT / "src/services/httpHermesClient.ts").read_text()

    assert "Select authorised model for" in panel
    assert "authorizedModels" in panel
    assert "saveAgentRuntime" in panel
    assert "getAgentRuntimes" in store
    assert "saveAgentRuntime" in store
    assert 'request<AgentRuntimeSwitcher>("/api/agent-runtimes")' in client
    assert '`/api/agent-runtimes/${encodeURIComponent(agentId)}`' in client
