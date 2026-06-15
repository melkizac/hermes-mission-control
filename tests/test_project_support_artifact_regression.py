import sys
from pathlib import Path

ROOT = Path('/opt/hermes-mission-control')
sys.path.insert(0, str(ROOT))
import app  # noqa: E402


def test_attention_cron_output_tasks_are_support_artifacts_not_projects():
    """Cron attention-router scratch workspaces must never appear as Projects."""
    assert app.is_support_artifact_project('attention-cron-output-0426b7268da92bfd')
    assert app.is_support_artifact_project('attention_cron_output_0426b7268da92bfd')
    assert app.canonical_task_project_slug('attention-cron-output-0426b7268da92bfd') is None

    data = app.list_projects({})
    project_ids = {project['id'] for project in data['projects']}

    assert 'attention-cron-output-0426b7268da92bfd' not in project_ids
    assert not any(
        project_id.startswith(('attention-cron-output-', 'attention_cron_output_'))
        for project_id in project_ids
    )
