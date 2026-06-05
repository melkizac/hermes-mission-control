from pathlib import Path
import importlib.util

ROOT = Path('/opt/hermes-mission-control')
SRC = ROOT / 'source' / 'src'
APP_PATH = ROOT / 'app.py'


def read(path):
    return Path(path).read_text(encoding='utf-8')


def load_app():
    spec = importlib.util.spec_from_file_location('hmc_phase10_app', APP_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_phase10_create_research_run_creates_parent_and_lane_tasks_with_result_evidence(tmp_path):
    app = load_app()
    app.KANBAN_DB = tmp_path / 'kanban.db'
    payload = {
        'title': 'AI adoption research sprint',
        'objective': 'Compare SME AI adoption blockers and produce an evidence-backed recommendation.',
        'projectId': 'nexius-research',
        'lanes': [
            {'title': 'Market scan', 'agentId': 'melkizac', 'focus': 'Map competitors and ICP claims.'},
            {'title': 'LinkedIn signal', 'agentId': 'content-ops', 'focus': 'Find operator-led themes.'},
            {'title': 'Browser funnel check', 'agentId': 'devops-builder', 'focus': 'Inspect lead forms without submitting.', 'requiresApproval': True},
        ],
        'sources': [
            {'label': 'Competitor sites', 'kind': 'web'},
            {'label': 'LinkedIn posts', 'kind': 'social'},
            {'label': 'Client funnel', 'kind': 'browser'},
        ],
    }
    result, status = app.create_research_run(payload)
    assert status == 201
    assert result['ok'] is True
    run = result['run']
    assert run['title'] == payload['title']
    assert run['status'] == 'running'
    assert len(run['lanes']) == 3
    assert len(run['sourceCoverage']) == 3
    assert run['trackedTaskIds'][0] == run['taskId']
    assert len(run['trackedTaskIds']) == 4
    assert run['taskUrl'].endswith(f"view=board&task={run['taskId']}")
    assert all(lane.get('taskId') for lane in run['lanes'])

    board = app.list_task_board({'project': ['nexius-research']})
    created = {task['id']: task for task in board['tasks'] if task['id'] in run['trackedTaskIds']}
    assert len(created) == 4
    parent = created[run['taskId']]
    assert parent['created_by'] == 'research-runs'
    assert sorted(parent['children']) == sorted([lane['taskId'] for lane in run['lanes']])
    lane_task = created[run['lanes'][0]['taskId']]
    assert 'Research lane task' in lane_task['body']
    response, response_status = app.task_result_response(lane_task['id'])
    assert response_status == 200
    mission_result = response['mission_result']
    assert mission_result['artifacts']
    assert mission_result['evidence']
    assert 'Synthesize lane evidence' in mission_result['nextActions']


def test_phase10_create_research_run_validates_lane_selection(tmp_path):
    app = load_app()
    app.KANBAN_DB = tmp_path / 'kanban.db'
    result, status = app.create_research_run({'title': 'Missing lanes', 'lanes': []})
    assert status == 400
    assert result['ok'] is False
    assert 'lane' in result['error'].lower()


def test_phase10_api_contract_and_routes_are_wired():
    app_text = read(APP_PATH)
    for needle in [
        'def create_research_run',
        "if parsed.path == '/api/research-runs'",
        "self.send_json(result, status)",
        "'created_by': 'research-runs'",
        'task_links',
    ]:
        assert needle in app_text
    types = read(SRC / 'types.ts')
    client = read(SRC / 'services' / 'hermesClient.ts')
    http = read(SRC / 'services' / 'httpHermesClient.ts')
    for needle in ['ResearchRunCreateRequest', 'ResearchRunCreateResponse']:
        assert needle in types
    assert 'createResearchRun(input: ResearchRunCreateRequest): Promise<ResearchRunCreateResponse>' in client
    assert 'request<ResearchRunCreateResponse>("/api/research-runs", { method: "POST"' in http


def test_phase10_research_runs_ui_exposes_creation_form_and_selection_controls():
    view = read(SRC / 'views' / 'ResearchRuns.tsx')
    for needle in [
        'Create wide research run',
        'data-testid="research-create-form"',
        'data-testid="research-lane-checkbox"',
        'data-testid="research-source-checkbox"',
        'createResearchRun',
        'tracked tasks',
        'Open parent task',
    ]:
        assert needle in view
    styles = read(SRC / 'styles' / 'app.css')
    for needle in ['.research-create-panel', '.research-choice-grid', '.research-created-banner']:
        assert needle in styles
    # The create bridge must follow the current light Mission Control card grammar,
    # not a separate dark/gradient form treatment.
    research_css = styles[styles.index('/* ---------------- RESEARCH RUNS ---------------- */'):]
    assert 'research-create-panel { border: 1px solid var(--line); background: #fff;' in research_css
    assert 'research-choice { text-align: left; border: 1px solid var(--line); background: #fff;' in research_css
    assert 'research-create-grid input, .research-create-grid textarea { width: 100%; border: 1px solid var(--line); border-radius: 14px; background: #fff;' in research_css
    assert 'linear-gradient(180deg, rgba(16, 23, 34' not in research_css
    assert 'rgba(5, 10, 18' not in research_css
    probe = ROOT / 'source' / 'scripts' / 'phase10-research-run-create-probe.cjs'
    assert probe.exists()
