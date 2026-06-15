from pathlib import Path

ROOT = Path('/opt/hermes-mission-control/source')
MISSION_PATH = ROOT / 'src/views/MissionControl.tsx'
PREVIEW_PATH = ROOT / 'src/components/ChatIntentRoutingPreview.tsx'
CSS_PATH = ROOT / 'src/styles/app.css'
APP_PATH = Path('/opt/hermes-mission-control/app.py')


def test_main_chat_has_one_click_research_deliverable_start_action_and_card():
    mission = MISSION_PATH.read_text(encoding='utf-8')
    preview = PREVIEW_PATH.read_text(encoding='utf-8')
    css = CSS_PATH.read_text(encoding='utf-8')
    assert 'start_research_deliverable' in preview
    # Main Chat now keeps router controls silent: high-confidence internal drafts auto-start
    # the research-to-deliverable Project graph instead of requiring a visible button label.
    assert 'defaultRoutingAction(intentDecision, preview)' in mission
    assert 'autoStartResearchDeliverable(decision, preview)' in mission
    assert 'runResearchDeliverableWorkflow' in mission
    assert 'researchWorkflowCard' in mission
    assert 'Research-to-Deliverable workflow started' in mission
    assert 'Open Task Board' in mission
    assert 'main-chat-research-card' in css
    assert 'aria-label="Research-to-Deliverable workflow status"' in mission


def test_research_deliverable_action_creates_full_graph_under_selected_project():
    mission = MISSION_PATH.read_text(encoding='utf-8')
    app = APP_PATH.read_text(encoding='utf-8')
    assert 'route.create_project = true;' in mission
    assert 'route.create_task = false;' in mission
    assert 'workflow_template_id' in app
    assert 'research_to_deliverable_v1' in app
    assert 'process_sources' in app
    assert 'deliver_to_chat' in app


def test_high_confidence_research_deliverable_can_auto_start_as_safe_internal_draft():
    mission = MISSION_PATH.read_text(encoding='utf-8')
    router = (ROOT / 'src/services/chatIntentRouter.ts').read_text(encoding='utf-8')
    assert 'autoStartResearchDeliverable' in mission
    assert 'permissionMode !== "draft-only"' in mission
    assert 'decision.intentType === "research_to_deliverable"' in mission
    assert 'decision.matchedContext.approvalRequired !== true' in mission
    assert 'High confidence: can create/link Project and queue internal draft work' in router


def test_research_deliverable_typed_send_can_autostart_new_project_without_selected_project():
    mission = MISSION_PATH.read_text(encoding='utf-8')
    router = (ROOT / 'src/services/chatIntentRouter.ts').read_text(encoding='utf-8')
    assert 'const canCreateResearchProject = decisionValue.intentType === "research_to_deliverable" && decisionValue.nextAction === "show_mission_proposal"' in router
    assert 'const canProceed = decisionValue.confidence === "high" && (Boolean(matched.projectName || matched.projectId) || canCreateResearchProject);' in router
    assert 'const isCreatingResearchProject = isResearchDeliverable && Boolean(route.create_project || route.intent_type === "project");' in mission
    assert 'if (routeNeedsProject && !isCreatingResearchProject && !suggestedProjectId && !suggestedProjectName)' in mission
    assert '"research-to-deliverable"' in mission
    assert '"training material"' in mission
