from pathlib import Path

ROOT = Path('/opt/hermes-mission-control')
SRC = ROOT / 'source' / 'src'
APP = ROOT / 'app.py'


def src(rel):
    return (SRC / rel).read_text(encoding='utf-8')


def app_py():
    return APP.read_text(encoding='utf-8')


def test_phase2_types_extend_board_tasks_with_mission_result_and_artifacts():
    types = src('types.ts')

    assert 'mission_result?: MissionResult | null;' in types
    assert 'artifacts?: MissionArtifact[];' in types
    assert 'evidence?: EvidenceRecord[];' in types
    assert 'approval_gates?: ApprovalGate[];' in types
    assert 'next_actions?: string[];' in types
    assert 'export interface TaskResultResponse' in types


def test_phase2_backend_builds_task_result_payload_and_result_routes():
    app = app_py()

    for needle in [
        'def task_mission_result_payload',
        'def task_result_response',
        "'/result'",
        "'mission_result'",
        "'approvalGates'",
        "'nextActions'",
        "'artifacts'",
        "'evidence'",
        "'run evidence'",
        'approval_gate',
    ]:
        assert needle in app


def test_phase2_ui_renders_artifact_evidence_result_view_from_task_drawer():
    task_board = src('views/TaskBoard.tsx')
    hermes_client = src('services/hermesClient.ts')
    http_client = src('services/httpHermesClient.ts')

    for needle in [
        'ResultSummaryPanel',
        'ArtifactCard',
        'EvidenceTimeline',
        'Approval gates',
        'Evidence & Proof',
        'Next actions',
        'task.mission_result',
    ]:
        assert needle in task_board

    assert 'getTaskResult(id: string): Promise<TaskResultResponse>;' in hermes_client
    assert 'async getTaskResult(id: string): Promise<TaskResultResponse>' in http_client
    assert '`/api/tasks/${encodeURIComponent(id)}/result`' in http_client
