import sqlite3
import time

from test_multi_user_phase1 import load_app


def seed_task(con, task_id, status, created_at, **overrides):
    con.execute(
        """
        INSERT INTO tasks (
            id, title, body, assignee, status, priority, created_by, created_at,
            started_at, completed_at, workspace_kind, workspace_path, branch_name,
            claim_lock, claim_expires, tenant, result, idempotency_key,
            consecutive_failures, worker_pid, last_failure_error, max_runtime_seconds,
            last_heartbeat_at, current_run_id, workflow_template_id, current_step_key,
            skills, model_override, max_retries, session_id
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """,
        (
            task_id,
            overrides.get("title", task_id),
            overrides.get("body", ""),
            overrides.get("assignee", "devops"),
            status,
            overrides.get("priority", 50),
            "test",
            created_at,
            overrides.get("started_at"),
            overrides.get("completed_at"),
            "scratch",
            None,
            None,
            None,
            None,
            overrides.get("tenant", "mission-control-admin-multi-runtime-design"),
            overrides.get("result"),
            None,
            0,
            overrides.get("worker_pid"),
            None,
            None,
            overrides.get("last_heartbeat_at"),
            overrides.get("current_run_id"),
            None,
            None,
            "[]",
            None,
            None,
            None,
        ),
    )


def test_task_board_hides_archived_and_orders_by_live_update_time(tmp_path, monkeypatch):
    hermes_home = tmp_path / "hermes"
    hermes_home.mkdir()
    monkeypatch.setenv("HERMES_HOME", str(hermes_home))
    app = load_app(tmp_path, monkeypatch)
    con = app.ensure_kanban_tables()
    now = int(time.time())
    seed_task(con, "old-running", "running", now - 1000, started_at=now - 900, last_heartbeat_at=now - 5, title="Old created but actively running")
    seed_task(con, "new-queued", "queued", now - 10, title="Newer created queued task")
    seed_task(con, "archived-attention", "archived", now - 1, title="Archived stale attention wrapper")
    con.commit()
    con.close()

    payload = app.list_task_board({}, None)
    ids = [task["id"] for task in payload["tasks"]]

    assert "archived-attention" not in ids
    assert ids[:2] == ["old-running", "new-queued"]
    assert payload["summary"]["queued"] == 1
    assert payload["summary"]["running"] == 1


def test_task_board_preserves_kanban_statuses_instead_of_collapsing_to_queued(tmp_path, monkeypatch):
    hermes_home = tmp_path / "hermes"
    hermes_home.mkdir()
    monkeypatch.setenv("HERMES_HOME", str(hermes_home))
    app = load_app(tmp_path, monkeypatch)
    con = app.ensure_kanban_tables()
    now = int(time.time())
    seed_task(con, "raw-todo", "todo", now - 30, title="Backlog item")
    seed_task(con, "raw-scheduled", "scheduled", now - 20, title="Scheduled item")
    seed_task(con, "raw-queued", "queued", now - 10, title="Queued item")
    con.commit()
    con.close()

    payload = app.list_task_board({}, None)
    by_id = {task["id"]: task for task in payload["tasks"]}

    assert by_id["raw-todo"]["status"] == "todo"
    assert by_id["raw-scheduled"]["status"] == "scheduled"
    assert by_id["raw-queued"]["status"] == "queued"
    assert payload["summary"]["todo"] == 1
    assert payload["summary"]["scheduled"] == 1
    assert payload["summary"]["queued"] == 1
    assert payload["lanes"]["todo"][0]["id"] == "raw-todo"
    assert payload["lanes"]["scheduled"][0]["id"] == "raw-scheduled"
