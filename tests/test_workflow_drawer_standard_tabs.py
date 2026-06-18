from pathlib import Path

ROOT = Path('/opt/hermes-mission-control/source')
TASK_BOARD = ROOT / 'src/views/TaskBoard.tsx'
SLIDE_OVER = ROOT / 'src/components/SlideOverDrawer.tsx'
CSS_PATH = ROOT / 'src/styles/app.css'
APP = ROOT / 'src/App.tsx'


def test_task_detail_drawer_uses_standard_workflow_tabs_in_required_order():
    source = TASK_BOARD.read_text(encoding='utf-8')

    expected = 'const workflowDrawerTabs: DetailTab[] = ["overview", "actions", "approvals", "evidence", "runs", "rules", "metrics", "learning"];'
    assert expected in source
    assert 'type DetailTab = "overview" | "actions" | "approvals" | "evidence" | "runs" | "rules" | "metrics" | "learning";' in source
    assert 'tabs={workflowDrawerTabs}' in source
    assert 'tabLabels={tabLabels}' in source
    assert 'ariaLabel="Workflow detail drawer"' in source

    obsolete_tabs = ['"sources"', '"outputs"', '"run-tree"', '"handoffs"', '"settings"']
    detail_type_line = next(line for line in source.splitlines() if line.startswith('type DetailTab ='))
    for old_tab in obsolete_tabs:
        assert old_tab not in detail_type_line


def test_workflow_drawer_has_persistent_header_and_tab_counts():
    source = TASK_BOARD.read_text(encoding='utf-8')
    css = CSS_PATH.read_text(encoding='utf-8')
    slide_over = SLIDE_OVER.read_text(encoding='utf-8')

    assert 'function WorkflowDrawerHeader' in source
    for label in ['Owner', 'Risk', 'Autonomy', 'Needs human', 'Updated']:
        assert f'label="{label}"' in source
    assert 'actions={<WorkflowDrawerHeader task={task} projectData={projectData} />}' in source
    assert 'workflow-drawer-progress' in source
    assert 'mc-tab-count' in source
    assert 'tabLabels?: Partial<Record<Tab, ReactNode>>' in slide_over
    assert '{tabLabels?.[item] ?? item}' in slide_over
    assert '.workflow-drawer-header {' in css
    assert '.mc-tab-count {' in css


def test_workflow_drawer_preserves_slide_over_context_without_new_detail_page():
    source = TASK_BOARD.read_text(encoding='utf-8')
    app = APP.read_text(encoding='utf-8')

    assert '<SlideOverDrawer<DetailTab>' in source
    assert 'className="task-detail task-detail-drawer project-task-drawer workflow-detail-drawer"' in source
    assert 'dataDeepLinkTarget="task"' in source
    assert 'workflow-detail' not in app
    assert 'workflowDrawerTabs' not in app


def test_workflow_drawer_tabs_are_real_data_first_and_safe_empty_states():
    source = TASK_BOARD.read_text(encoding='utf-8')
    css = CSS_PATH.read_text(encoding='utf-8')

    for marker in [
        'function buildWorkflowActionRows',
        'function WorkflowActionsTab',
        'eventPayloadSummary(event.payload)',
        'task.comments.forEach',
        'function WorkflowEvidenceList',
        'function buildWorkflowEvidenceList',
        'function WorkflowRunsTab',
        'function WorkflowRulesTab',
        'function WorkflowMetricsTab',
        'function WorkflowLearningTab',
    ]:
        assert marker in source

    assert 'No workflow actions are recorded yet.' in source
    assert 'No evidence artifacts are attached yet.' in source
    assert 'No direct worker runs are attached yet.' in source
    assert 'No learning notes have been recorded for this workflow yet.' in source
    assert 'Raw source context</summary>' in source
    assert 'Raw result</summary>' in source
    assert '<h3>Raw result</h3><pre>{task.result}</pre>' not in source
    assert '.workflow-action-table {' in css
    assert '.workflow-evidence-grid' in css


def test_workflow_approvals_and_rules_make_operator_decision_explicit():
    source = TASK_BOARD.read_text(encoding='utf-8')

    for label in ['Actor', 'Action', 'Target', 'Effect', 'Recommendation']:
        assert f'label="{label}"' in source
    assert 'approvalRecommendation(gate, task)' in source
    assert 'Allowed without approval' in source
    assert 'Requires approval' in source
    assert 'Never allowed' in source
    assert 'Escalation / evidence' in source
    assert 'Expose secrets or raw private content by default' in source
