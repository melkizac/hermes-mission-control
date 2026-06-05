from pathlib import Path

ROOT = Path('/opt/hermes-mission-control')
SRC = ROOT / 'source' / 'src'
APP = ROOT / 'app.py'


def src(rel):
    return (SRC / rel).read_text(encoding='utf-8')


def app_py():
    return APP.read_text(encoding='utf-8')


def test_phase3_types_define_packaged_workflow_library_contracts():
    types = src('types.ts')

    for needle in [
        'export interface PackagedWorkflow',
        'export interface WorkflowStep',
        'export interface WorkflowLibraryResponse',
        'export interface WorkflowLaunchResponse',
        'skills: string[];',
        'evidence: EvidenceRecord[];',
        'artifacts: MissionArtifact[];',
        'approvalGates: ApprovalGate[];',
    ]:
        assert needle in types


def test_phase3_backend_exposes_workflow_library_and_launch_routes():
    app = app_py()

    for needle in [
        'def packaged_sme_workflows',
        'def workflow_library_payload',
        'def launch_packaged_workflow',
        "'/api/workflows'",
        "'/api/workflows/'",
        "'Nexius Academy lead intake'",
        "'LinkedIn content operating loop'",
        "'result_details'",
        "'approval_gates'",
        "'workflow-template'",
    ]:
        assert needle in app


def test_phase3_frontend_renders_workflow_library_and_launch_entry_points():
    view = src('views/WorkflowLibrary.tsx')
    client = src('services/httpHermesClient.ts')
    contract = src('services/hermesClient.ts')
    nav = src('components/NavRail.tsx')
    app = src('App.tsx')
    styles = src('styles/app.css')

    for needle in [
        'export function WorkflowLibrary',
        'PACKAGED SME WORKFLOWS',
        'Workflow library',
        'Launch workflow',
        'Evidence-ready',
        'Approval gates',
        'client.listWorkflows',
        'client.launchWorkflow',
        'data-testid="workflow-card"',
        'data-testid="workflow-detail-drawer"',
        'Close workflow details',
        'setSelected(null)',
    ]:
        assert needle in view
    assert 'selected ?? workflows[0]' not in view
    assert 'className="workflow-detail"' not in view

    assert 'listWorkflows(filters?: { q?: string; category?: string }): Promise<WorkflowLibraryResponse>;' in contract
    assert 'launchWorkflow(id: string, input:' in contract
    assert 'async listWorkflows' in client
    assert 'async launchWorkflow' in client
    assert 'workflow-library' in nav
    assert '<WorkflowLibrary />' in app
    assert '.workflow-library-page' in styles
    assert '.workflow-card' in styles
    assert '.workflow-detail-drawer' in styles
    assert '.workflow-detail-scrim' in styles
    assert 'grid-template-columns: minmax(360px, 1fr) minmax(360px, 0.85fr)' not in styles
