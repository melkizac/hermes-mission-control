from pathlib import Path

SRC = Path('/opt/hermes-mission-control/source/src')


def read(rel):
    return (SRC / rel).read_text(encoding='utf-8')


def test_task_board_title_is_clean_and_no_issues_suffix():
    task_board = read('views/TaskBoard.tsx')

    assert '<h1>Task Board</h1>' in task_board
    assert 'Task Board / Issues' not in task_board


def test_task_board_header_actions_are_icon_only_and_next_to_title():
    task_board = read('views/TaskBoard.tsx')

    assert 'task-title-row' in task_board
    assert 'task-title-actions' in task_board
    assert 'className="task-icon-action' in task_board
    assert 'aria-label={showCreate ? "Close add action form" : "Add action"}' in task_board
    assert 'aria-label="Refresh task board"' in task_board
    assert '<Icon name="plus"' in task_board
    assert '<Icon name="refresh"' in task_board
    assert '>{showCreate ? "Close Form" : "+ Add Action"}</button>' not in task_board
    assert '>Refresh</button>' not in task_board


def test_task_board_icon_actions_are_right_aligned_in_title_row_styles():
    css = read('styles/app.css')

    assert '.task-title-row { display: flex; align-items: center; justify-content: space-between;' in css
    assert '.task-title-actions { display: flex; align-items: center; gap: 8px;' in css
    assert '.task-icon-action {' in css
