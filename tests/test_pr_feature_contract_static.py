from pathlib import Path

ROOT = Path('/opt/hermes-mission-control/source')
SRC = ROOT / 'src'
DOCS = ROOT / 'docs'


def read(path: Path) -> str:
    return path.read_text(encoding='utf-8')


def test_feature_contract_exists_and_protects_task_board_capabilities():
    contract = read(DOCS / 'MISSION_CONTROL_FEATURE_CONTRACT.md')

    assert 'Git conflicts are necessary but not sufficient' in contract
    assert '## /tasks — Task Board' in contract
    for capability in [
        'Search by ID, title, body, owner, project, skill',
        'Status filtering',
        'Owner/assignee filtering',
        'Project filtering',
        'Board/source filtering as an advanced/internal capability',
        'Cards/List view switch',
        'Task drawer/detail view',
        'Create action/manual task capture',
        'Clear filters action',
    ]:
        assert capability in contract


def test_pr_template_requires_feature_contract_and_conflict_evidence():
    template = read(ROOT / '.github' / 'pull_request_template.md')

    assert 'docs/MISSION_CONTROL_FEATURE_CONTRACT.md' in template
    assert 'Capabilities intentionally preserved' in template
    assert 'No user-visible capability was removed' in template
    assert 'Branch was updated from latest `main` before merge' in template
    assert 'Checks were rerun after conflict resolution' in template
    assert 'Rollback notes' in template


def test_task_board_default_filter_controls_remain_covered_by_static_guard():
    task_board = read(SRC / 'views' / 'TaskBoard.tsx')

    assert 'placeholder="Search ID, title, body, owner, project, skill…"' in task_board
    assert 'aria-label="Status selector"' in task_board
    assert 'aria-label="Owner selector"' in task_board
    assert 'aria-label="Project selector"' in task_board
    assert 'Clear filters' in task_board
    assert 'setQ(""); setStatus(""); setAssignee(""); setProject("")' in task_board
    assert 'setViewMode("cards")' in task_board
    assert 'setViewMode("list")' in task_board


def test_pr_hygiene_workflow_rejects_broad_cleanup_and_batch_merges():
    workflow = read(DOCS / 'PR_HYGIENE_WORKFLOW.md')

    assert 'Every new change gets its own narrow PR' in workflow
    assert 'Do not batch unrelated UI, backend, cleanup, and deployment changes into one branch' in workflow
    assert 'Update PR 1 from main -> verify -> merge' in workflow
    assert 'Cleanup PRs are high-risk' in workflow
    assert 'feature-preservation checklist' in workflow
