from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def test_main_chat_context_hydrates_after_initial_paint_with_shared_cache():
    mission = read("src/views/MissionControl.tsx")
    assert 'cachedRequest<ProjectsResponse>("main-chat:projects"' in mission
    assert 'cachedRequest<BoardResponse>("main-chat:tasks"' in mission
    assert 'cachedRequest<AutomationsResponse>("main-chat:automations"' in mission
    assert "scheduleProgressiveHydration" in mission
    assert "requestAnimationFrame" in mission
    assert "requestIdleCallback" in mission
    assert "contextHydrating" in mission
    assert "Loading projects…" in mission
    initial_context_block = mission[mission.index("const cancelHydration = scheduleProgressiveHydration"):mission.index("const ensureWorkflowContext")]
    assert "/api/workflows" not in initial_context_block


def test_main_chat_workflows_are_loaded_only_on_workflow_related_intent():
    mission = read("src/views/MissionControl.tsx")
    assert "shouldHydrateWorkflowContext" in mission
    assert 'cachedRequest<WorkflowLibraryResponse>("main-chat:workflows", "/api/workflows"' in mission
    assert "const workflowContext = shouldHydrateWorkflowContext(instruction) ? await ensureWorkflowContext() : workflows" in mission
    assert "workflows: workflowContext" in mission
    assert "workflow_context_loaded" in mission


def test_agent_chat_project_context_and_model_router_progressively_hydrate():
    agents = read("src/views/Agents.tsx")
    roster = read("src/components/Roster.tsx")
    chat_thread = read("src/components/ChatThread.tsx")
    store = read("src/services/store.tsx")
    assert 'cachedJsonRequest(\n    "chat-page:project-chats"' in agents
    assert "scheduleProgressiveHydration" in agents
    assert "projectChatsHydrating" in roster
    assert "composer is ready now" in roster
    assert 'cachedJsonRequest("chat-page:model-router"' in store
    assert '}, 10000);' not in store
    assert '}, 12000);' not in store
    assert '}, 250);' in store
    assert '}, 1000);' in store
    assert "ensureModelRouter" in chat_thread
    assert "onFocus={() => void ensureModelRouter()}" in chat_thread
    assert "if (modelSelection === \"auto\") return;" in chat_thread


def test_chat_surfaces_do_not_import_workflow_library_into_agent_chat_initial_render():
    chat_thread = read("src/components/ChatThread.tsx")
    agents = read("src/views/Agents.tsx")
    assert "listWorkflows" not in chat_thread
    assert "/api/workflows" not in chat_thread
    assert "listWorkflows" not in agents
    assert "/api/workflows" not in agents
