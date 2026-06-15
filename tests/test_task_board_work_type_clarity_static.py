from pathlib import Path

ROOT = Path('/opt/hermes-mission-control/source')
SRC = ROOT / 'src'


def read(rel):
    return (SRC / rel).read_text(encoding='utf-8')


def test_task_board_derives_operator_work_types_without_backend_storage_labels():
    task_board = read('views/TaskBoard.tsx')

    assert 'type WorkTypeKey = "human" | "agent" | "routine" | "cron" | "internal" | "implementation" | "review"' in task_board
    for label in ['Human', 'Agent', 'Routine', 'Cron', 'Internal', 'Implementation', 'Review']:
        assert f'label: "{label}"' in task_board
    assert 'function deriveWorkTypeChips(task: BoardTask)' in task_board
    assert 'task-work-type-row' in task_board


def test_task_board_default_filters_stay_project_first_not_board_source_first():
    task_board = read('views/TaskBoard.tsx')

    assert 'aria-label="Project selector"' in task_board
    assert 'aria-label="Board selector"' not in task_board
    assert '<option value="">All Boards</option>' not in task_board
    assert 'Board Source' not in task_board
    assert 'All board sources' not in task_board


def test_task_board_work_type_chips_are_styled_as_compact_cues():
    css = read('styles/app.css')

    assert '.task-work-type-row {' in css
    assert '.task-work-type-chip {' in css
    assert '.task-work-type-chip.work-type-human' in css
    assert '.task-work-type-chip.work-type-agent' in css
    assert '.task-work-type-chip.work-type-cron' in css
