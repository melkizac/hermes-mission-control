from pathlib import Path

ROOT = Path('/opt/hermes-mission-control')
SRC = ROOT / 'source' / 'src'
APP = ROOT / 'app.py'


def read_src(rel):
    return (SRC / rel).read_text(encoding='utf-8')


def read_app():
    return APP.read_text(encoding='utf-8')


def test_phase1_types_define_delegate_work_contracts_and_project_master_instructions():
    types = read_src('types.ts')

    expected_exports = [
        'export interface ProjectMasterInstructions',
        'export interface DelegateWorkPlan',
        'export interface DelegateWorkContextResponse',
        'export interface DelegateWorkMutationResponse',
    ]
    for needle in expected_exports:
        assert needle in types

    for field in ['masterInstructions', 'routingReason', 'approvalRequired', 'promptPreview', 'taskBody']:
        assert field in types


def test_phase1_backend_exposes_delegate_work_plan_and_create_routes():
    app = read_app()

    for needle in [
        'def delegate_work_context_payload',
        'def delegate_work_plan_payload',
        'def create_delegate_work_item',
        "'/api/delegate-work/context'",
        "'/api/delegate-work/plan'",
        "'/api/delegate-work'",
        'Project master instructions',
        'risk_level',
    ]:
        assert needle in app


def test_phase1_frontend_has_delegate_work_front_door_and_nav_entry():
    view = read_src('views/DelegateWork.tsx')
    client = read_src('services/httpHermesClient.ts')
    nav = read_src('components/NavRail.tsx')
    app = read_src('App.tsx')
    styles = read_src('styles/app.css')

    for needle in [
        'export function DelegateWork',
        'DELEGATE WORK',
        'Project master instructions',
        'Route work',
        'Create delegated task',
        'client.planDelegateWork',
        'client.createDelegateWork',
    ]:
        assert needle in view

    assert 'planDelegateWork' in client
    assert 'createDelegateWork' in client
    assert 'delegate-work' in nav
    assert '<DelegateWork />' in app
    assert '.delegate-work-page' in styles
    assert '.delegate-work-plan' in styles
