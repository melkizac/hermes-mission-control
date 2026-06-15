from pathlib import Path

ROOT = Path('/opt/hermes-mission-control')
SRC = ROOT / 'source' / 'src'
APP = ROOT / 'app.py'


def src(rel):
    return (SRC / rel).read_text(encoding='utf-8')


def app_py():
    return APP.read_text(encoding='utf-8')


def test_evidence_gate_types_and_backend_contract_are_declared():
    types = src('types.ts')
    app = app_py()

    for needle in [
        'export interface EvidenceGateChecklistItem',
        'export interface EvidenceGateState',
        'evidenceGate: EvidenceGateState;',
        'command_output',
        'build_test_log',
        'api_response',
        'screenshot',
        'file_artifact',
        'approval_note',
        'session_link',
    ]:
        assert needle in types

    for needle in [
        'DEFAULT_TASK_EVIDENCE_TYPES',
        'def task_evidence_gate_state',
        "'completion blocked by missing required evidence'",
        "'evidenceGate'",
    ]:
        assert needle in app


def test_task_board_drawer_renders_evidence_gate_checklist():
    task_board = src('views/TaskBoard.tsx')

    for needle in [
        'EvidenceGateChecklist',
        'const evidenceGate = result?.evidenceGate',
        'Evidence gate',
        'completionBlocked',
        'missingTypes',
        'command output, build/test logs, API responses, screenshots, file artifacts, approval notes, or session links',
    ]:
        assert needle in task_board

    assert 'evidence-gate-card blocked' in task_board or 'evidence-gate-card ${gate.status}' in task_board
