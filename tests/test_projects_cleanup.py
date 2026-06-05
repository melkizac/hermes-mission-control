import sys
from pathlib import Path

ROOT = Path('/opt/hermes-mission-control')
SRC = ROOT / 'source' / 'src'
APP = ROOT / 'app.py'

sys.path.insert(0, str(ROOT))
import app  # noqa: E402


def read_src(rel):
    return (SRC / rel).read_text(encoding='utf-8')


def test_project_backend_filters_support_artifacts_and_canonicalizes_real_projects():
    assert app.is_support_artifact_project('cron:f29300284621')
    assert app.is_support_artifact_project('approval-reclass:cron-output-de0b73d04d992bd8')
    assert app.is_support_artifact_project('phase17-test')
    assert app.is_support_artifact_project('t_33c73874')

    assert app.canonical_task_project_slug('goal:agentic-ai-course-interest-leadgen-2026-06') == 'nexius-academy-agentic-ai-course-growth'
    assert app.canonical_task_project_slug('goal:agentic-ai-course-7day-sprint-2026-06') == 'nexius-academy-agentic-ai-course-growth'
    assert app.canonical_task_project_slug('nexius-leads') == 'nexius-academy-agentic-ai-course-growth'
    assert app.canonical_task_project_slug('goal:devops-builder-fully-implement-mission-control-goal-function-202') == 'mission-control'


def test_project_list_returns_tidy_real_initiatives_only():
    data = app.list_projects({})
    ids = {project['id'] for project in data['projects']}

    assert 'mission-control' in ids
    assert 'nexius-academy-agentic-ai-course-growth' in ids
    assert 'melverick-site' in ids
    assert 'melverick-second-brain' in ids

    assert not any(pid.startswith('cron-') or pid.startswith('cron_') for pid in ids)
    assert not any(pid.startswith('phase17') or pid.startswith('phase16') for pid in ids)
    assert not any(pid.startswith('t_') or pid.startswith('t-') for pid in ids)
    assert 'goal-agentic-ai-course-interest-leadgen-2026-06' not in ids
    assert 'goal-agentic-ai-course-7day-sprint-2026-06' not in ids

    growth = next(project for project in data['projects'] if project['id'] == 'nexius-academy-agentic-ai-course-growth')
    assert growth['portfolio_group'] == 'Nexius Growth'
    assert growth['kind'] == 'growth'
    assert growth['actions']['done'] >= 1


def test_projects_ui_lists_cards_flat_with_project_area_filter():
    view = read_src('views/Projects.tsx')
    types = read_src('types.ts')

    assert 'portfolio_group?: string' in types
    assert 'project_areas?: string[]' in types
    assert 'All project areas' in view
    assert 'aria-label="Refresh projects"' in view
    assert '<Icon name="refresh" size={18} />' in view
    assert 'Current focus' not in view
    assert 'projects.map((project)' in view
    assert 'groupedProjects' not in view
    assert 'projects-grouped-list' not in view
    assert 'project-group-head' not in view
