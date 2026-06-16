import shutil
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
    assert payload["summary"]["todo"] == 1
    assert payload["summary"]["running"] == 1


def test_task_board_preserves_operator_lanes_and_maps_queued_to_todo(tmp_path, monkeypatch):
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
    assert by_id["raw-queued"]["status"] == "todo"
    assert payload["summary"]["todo"] == 2
    assert payload["summary"]["scheduled"] == 1
    assert "queued" not in payload["summary"]
    assert {task["id"] for task in payload["lanes"]["todo"]} == {"raw-todo", "raw-queued"}
    assert payload["lanes"]["scheduled"][0]["id"] == "raw-scheduled"



def create_named_board(app, slug):
    app.ensure_kanban_tables().close()
    board_dir = app.KANBAN_BOARDS_ROOT / slug
    board_dir.mkdir(parents=True, exist_ok=True)
    db_path = board_dir / "kanban.db"
    shutil.copyfile(app.KANBAN_DB, db_path)
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    for table in ("task_links", "task_comments", "task_events", "task_runs", "tasks"):
        con.execute(f"DELETE FROM {table}")
    con.commit()
    return con


def test_task_board_aggregates_named_boards_and_preserves_source_identity(tmp_path, monkeypatch):
    hermes_home = tmp_path / "hermes"
    hermes_home.mkdir()
    monkeypatch.setenv("HERMES_HOME", str(hermes_home))
    app = load_app(tmp_path, monkeypatch)
    now = int(time.time())

    default_con = app.ensure_kanban_tables()
    seed_task(default_con, "default-visible", "todo", now - 20, title="Default board task", tenant="default-project")
    default_con.commit()
    default_con.close()

    named_con = create_named_board(app, "owned-app-capability-standard")
    seed_task(named_con, "named-visible", "running", now - 10, title="Named board task", tenant="owned-app-capability-standard")
    named_con.commit()
    named_con.close()

    payload = app.list_task_board({}, None)
    by_id = {task["id"]: task for task in payload["tasks"]}

    assert by_id["default-visible"]["board_slug"] == "default"
    assert by_id["default-visible"]["board_is_default"] is True
    assert by_id["named-visible"]["board_slug"] == "board:owned-app-capability-standard"
    assert by_id["named-visible"]["board_is_default"] is False
    assert {board["slug"] for board in payload["boards"]} == {"default", "board:owned-app-capability-standard"}
    assert {board["source_kind"] for board in payload["boards"]} == {"default", "named_board"}
    assert payload["sources"] == payload["boards"]
    assert payload["summary"]["boards"] == ["board:owned-app-capability-standard", "default"]


def test_task_board_aggregates_boards_and_filters_by_project_tenant(tmp_path, monkeypatch):
    hermes_home = tmp_path / "hermes"
    hermes_home.mkdir()
    monkeypatch.setenv("HERMES_HOME", str(hermes_home))
    app = load_app(tmp_path, monkeypatch)
    now = int(time.time())

    default_con = app.ensure_kanban_tables()
    seed_task(default_con, "mirror-task", "queued", now - 30, title="Default mirror title", tenant="owned-app-capability-standard")
    seed_task(default_con, "default-only", "todo", now - 25, title="Default only", tenant="other-project")
    default_con.commit()
    default_con.close()

    named_con = create_named_board(app, "owned-app-capability-standard")
    seed_task(named_con, "mirror-task", "running", now - 5, title="Canonical named title", tenant="owned-app-capability-standard")
    seed_task(named_con, "named-only", "blocked", now - 4, title="Named only", tenant="owned-app-capability-standard")
    named_con.commit()
    named_con.close()

    payload = app.list_task_board({}, None)
    by_id = {task["id"]: task for task in payload["tasks"]}

    assert by_id["mirror-task"]["title"] == "Canonical named title"
    assert by_id["mirror-task"]["board_slug"] == "board:owned-app-capability-standard"
    assert by_id["mirror-task"]["status"] == "running"
    assert "named-only" in by_id
    assert "default-only" in by_id
    assert [task["id"] for task in payload["tasks"]].count("mirror-task") == 1

    project_only = app.list_task_board({"project": ["owned-app-capability-standard"]}, None)
    assert {task["id"] for task in project_only["tasks"]} == {"mirror-task", "named-only"}

    all_boards = app.list_task_board({"board": ["all"]}, None)
    assert {task["id"] for task in all_boards["tasks"]} == {"mirror-task", "named-only", "default-only"}
    assert [task["id"] for task in all_boards["tasks"]].count("mirror-task") == 1

    default_only = app.list_task_board({"board": ["default"]}, None)
    assert {task["id"] for task in default_only["tasks"]} == {"mirror-task", "default-only"}
    assert default_only["tasks"][0]["board_slug"] == "default"
    assert {board["slug"] for board in default_only["boards"]} == {"default", "board:owned-app-capability-standard"}

    named_only = app.list_task_board({"source": ["board:owned-app-capability-standard"]}, None)
    assert {task["id"] for task in named_only["tasks"]} == {"mirror-task", "named-only"}
    assert all(task["board_slug"] == "board:owned-app-capability-standard" for task in named_only["tasks"])

    named_project_only = app.list_task_board({"board": ["board:owned-app-capability-standard"], "project": ["owned-app-capability-standard"]}, None)
    assert {task["id"] for task in named_project_only["tasks"]} == {"mirror-task", "named-only"}

    unknown = app.list_task_board({"board": ["missing-board"]}, None)
    assert unknown["tasks"] == []
    assert unknown["board_errors"] == [{"board": "missing-board", "status": "skipped", "reason": "unknown board/source filter"}]


def test_task_board_reports_corrupt_aggregated_board_without_hiding_default(tmp_path, monkeypatch):
    hermes_home = tmp_path / "hermes"
    hermes_home.mkdir()
    monkeypatch.setenv("HERMES_HOME", str(hermes_home))
    app = load_app(tmp_path, monkeypatch)
    now = int(time.time())

    default_con = app.ensure_kanban_tables()
    seed_task(default_con, "default-survives", "todo", now - 10, title="Default survives")
    default_con.commit()
    default_con.close()

    corrupt_dir = app.KANBAN_BOARDS_ROOT / "corrupt-board"
    corrupt_dir.mkdir(parents=True, exist_ok=True)
    (corrupt_dir / "kanban.db").write_text("not a sqlite database")

    payload = app.list_task_board({}, None)

    assert [task["id"] for task in payload["tasks"]] == ["default-survives"]
    assert payload["board_errors"] == [{"board": "board:corrupt-board", "status": "skipped", "reason": "missing tasks table"}]


def test_task_board_ignores_empty_profile_kanban_db_without_warning(tmp_path, monkeypatch):
    hermes_home = tmp_path / "hermes"
    profiles_root = hermes_home / "profiles"
    empty_profile = profiles_root / "content-ops"
    empty_profile.mkdir(parents=True)
    (empty_profile / "kanban.db").touch()
    monkeypatch.setenv("HERMES_HOME", str(hermes_home))
    app = load_app(tmp_path, monkeypatch)
    now = int(time.time())

    default_con = app.ensure_kanban_tables()
    seed_task(default_con, "default-visible", "todo", now - 10, title="Default visible")
    default_con.commit()
    default_con.close()

    payload = app.list_task_board({}, None)

    assert [task["id"] for task in payload["tasks"]] == ["default-visible"]
    assert payload["board_errors"] == []
    assert {board["slug"] for board in payload["boards"]} == {"default"}


def test_project_task_index_uses_default_board_project_tenants(tmp_path, monkeypatch):
    hermes_home = tmp_path / "hermes"
    hermes_home.mkdir()
    monkeypatch.setenv("HERMES_HOME", str(hermes_home))
    app = load_app(tmp_path, monkeypatch)
    now = int(time.time())

    con = app.ensure_kanban_tables()
    seed_task(con, "project-visible-from-default-board", "blocked", now - 5, title="Project task visible", tenant="owned-app-capability-standard")
    con.commit()
    con.close()

    index = app.project_task_index()

    assert "owned-app-capability-standard" in index
    assert index["owned-app-capability-standard"]["actions"]["blocked"] == 1
    assert index["owned-app-capability-standard"]["actions"]["open"] == 0

    projects_payload = app.list_projects({}, None)
    project = next((item for item in projects_payload["projects"] if item["id"] == "owned-app-capability-standard"), None)
    assert project is not None
    assert project["actions"]["blocked"] == 1
    assert any(item["id"] == "project-visible-from-default-board" for item in project["activity"])
