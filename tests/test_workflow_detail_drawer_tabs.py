from pathlib import Path

ROOT = Path('/opt/hermes-mission-control/source')
WORKFLOW_LIBRARY = ROOT / 'src/views/WorkflowLibrary.tsx'
CSS = ROOT / 'src/styles/app.css'


def test_workflow_library_detail_drawer_has_standard_tabs_and_header():
    source = WORKFLOW_LIBRARY.read_text(encoding='utf-8')
    css = CSS.read_text(encoding='utf-8')

    assert 'type WorkflowDetailTab = "overview" | "actions" | "approvals" | "evidence" | "runs" | "rules" | "metrics" | "learning";' in source
    assert 'const workflowDetailTabs: WorkflowDetailTab[] = ["overview", "actions", "approvals", "evidence", "runs", "rules", "metrics", "learning"];' in source
    for label in ['Owner', 'Risk', 'Autonomy', 'Needs human', 'Updated']:
        assert f'label="{label}"' in source
    assert 'workflow-drawer-header' in source
    assert '{activeTab === "overview" && (' in source
    assert 'workflow-detail-tabs' in source
    assert 'WorkflowTabBody' in source
    assert '.workflow-detail-tabs {' in css
    assert '.workflow-detail-drawer-standard { align-content: start; grid-auto-rows: max-content; }' in css
    assert '.workflow-drawer-header {' in css
    assert '.workflow-action-list li,' in css
    assert '.workflow-routines-linked .workflow-steps li' in css


def test_workflow_library_detail_drawer_keeps_single_drawer_not_separate_page():
    source = WORKFLOW_LIBRARY.read_text(encoding='utf-8')
    assert 'data-testid="workflow-detail-drawer"' in source
    assert 'workflow-detail-drawer workflow-detail-drawer-standard' in source
    assert 'workflow-detail-layer' in source
