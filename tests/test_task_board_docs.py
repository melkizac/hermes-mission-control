from pathlib import Path

ROOT = Path('/opt/hermes-mission-control/source')


def test_task_board_docs_use_current_operator_facing_name():
    readme = (ROOT / 'README.md').read_text(encoding='utf-8')
    docs = (ROOT / 'docs/HERMES_MISSION_CONTROL.md').read_text(encoding='utf-8')

    assert '**Task Board**' in readme
    assert '## 7.6 Task Board' in docs
    assert 'Task Board / Issues' not in readme
    assert '## 7.6 Task Board / Issues' not in docs


def test_task_board_docs_record_icon_title_actions():
    docs = (ROOT / 'docs/HERMES_MISSION_CONTROL.md').read_text(encoding='utf-8')

    assert 'Add and refresh controls are icon-only buttons aligned on the right side of the title row' in docs
    assert '`Add action`' in docs
    assert '`Refresh task board`' in docs
