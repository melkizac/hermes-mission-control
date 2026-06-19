from pathlib import Path

ROOT = Path('/opt/hermes-mission-control/source')
TASK_BOARD = ROOT / 'src/views/TaskBoard.tsx'
CSS = ROOT / 'src/styles/app.css'


def test_task_detail_overview_is_execution_cockpit_not_new_page():
    source = TASK_BOARD.read_text(encoding='utf-8')

    assert 'ariaLabel="Project-aware task cockpit"' in source
    assert 'tabs={["overview", "sources", "tasks", "outputs", "run-tree", "handoffs", "release", "evidence", "settings"] as const}' in source
    assert 'data-testid="task-execution-cockpit-overview"' in source
    assert 'At a glance execution cockpit' in source
    assert 'Task objective' in source
    assert 'Evidence gate' in source
    assert 'Artifacts surfaced' in source
    assert 'Approval gates' in source
    assert 'Recent execution timeline' in source
    assert 'Artifact preview' in source
    assert 'No duplicate page: this overview summarizes the same drawer tabs operators can drill into.' in source


def test_task_detail_overview_surfaces_approval_artifact_and_timeline_helpers():
    source = TASK_BOARD.read_text(encoding='utf-8')

    for helper in [
        'buildOverviewExecutionCockpit',
        'getTaskArtifactPreview',
        'getTaskApprovalGateSummary',
        'getTaskEvidenceGateSummary',
        'getTaskExecutionTimelinePreview',
    ]:
        assert helper in source
    assert 'task.mission_result?.approvalGates ?? task.result_details?.approval_gates ?? []' in source
    assert 'task.mission_result?.artifacts.map((artifact) => artifact as unknown as DrawerRecord) ?? []' in source
    assert 'task.events.slice(-3)' in source
    assert 'task.runs.slice(-2)' in source
    assert 'task.agent_handoffs ?? []' in source


def test_task_execution_cockpit_styles_are_compact_and_evidence_forward():
    css = CSS.read_text(encoding='utf-8')

    for selector in [
        '.task-execution-cockpit {',
        '.task-cockpit-signal-grid {',
        '.task-cockpit-signal-card {',
        '.task-cockpit-signal-card.needs-human {',
        '.task-cockpit-preview-grid {',
        '.task-cockpit-artifact-list {',
        '.task-cockpit-timeline {',
    ]:
        assert selector in css
    assert 'grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));' in css
    assert 'grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));' in css
