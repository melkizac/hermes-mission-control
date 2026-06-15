from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_model_router_is_authorised_model_allow_list_not_assignment_grid():
    page = (ROOT / "src/views/ModelRouter.tsx").read_text()

    assert "Authorised models available for agents" in page
    assert "Only authorised and enabled models can be assigned to agents" in page
    assert "Agent runtime switcher" not in page
    assert "agent-runtime-grid" not in page


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
