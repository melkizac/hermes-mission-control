import json
import sqlite3
from pathlib import Path


def _insert_task(con, task_id, title, status="todo", assignee="worker", result=""):
    con.execute(
        """
        INSERT INTO tasks (
          id, title, body, assignee, status, priority, created_by, created_at,
          workspace_kind, result, consecutive_failures, skills, model_override
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (task_id, title, "body", assignee, status, 50, "test", 1_700_000_000, "scratch", result, 0, json.dumps(["kanban-worker"]), "gpt-test"),
    )


def test_task_run_tree_blocks_parent_completion_on_child_verification_failure(tmp_path, monkeypatch):
    import app

    monkeypatch.setattr(app, "KANBAN_DB", tmp_path / "kanban.db")
    con = app.ensure_kanban_tables()
    _insert_task(con, "parent", "Parent agent task", status="running", assignee="chief-operator")
    _insert_task(con, "child", "Delegated subagent task", status="running", assignee="researcher")
    con.execute("INSERT INTO task_links(parent_id, child_id) VALUES (?, ?)", ("parent", "child"))
    cur = con.execute(
        """
        INSERT INTO task_runs(task_id, profile, step_key, status, started_at, ended_at, outcome, summary)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        ("child", "researcher", "verify", "done", 1_700_000_010, 1_700_000_020, "completed", "checked source evidence"),
    )
    run_id = cur.lastrowid
    con.execute(
        "INSERT INTO task_events(task_id, run_id, kind, payload, created_at) VALUES (?, ?, ?, ?, ?)",
        ("child", run_id, "verification", json.dumps({"status": "failed", "reason": "source readback mismatch"}), 1_700_000_030),
    )
    con.commit(); con.close()

    payload, status = app.task_run_tree_response("parent")
    assert status == 200
    summary = payload["run_tree"]["summary"]
    assert summary["completion_blocked"] is True
    assert summary["blocked_nodes"] == 2
    assert "source readback mismatch" in " ".join(summary["blocking_reasons"])
    assert payload["run_tree"]["root"]["children"][0]["runs"][0]["agent"] == "researcher"

    result, update_status = app.update_task("parent", {"status": "done"})
    assert update_status == 409
    assert result["ok"] is False
    assert "completion blocked" in result["error"]
    assert "source readback mismatch" in " ".join(result["blocking_reasons"])


def test_task_result_response_includes_run_tree(tmp_path, monkeypatch):
    import app

    monkeypatch.setattr(app, "KANBAN_DB", tmp_path / "kanban.db")
    con = app.ensure_kanban_tables()
    _insert_task(con, "root", "Root task", status="done", assignee="builder", result=json.dumps({"summary": "done"}))
    con.execute(
        "INSERT INTO task_runs(task_id, profile, step_key, status, started_at, ended_at, outcome, summary) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ("root", "builder", "implement", "done", 1_700_000_000, 1_700_000_100, "completed", "implemented"),
    )
    con.commit(); con.close()

    payload, status = app.task_result_response("root")
    assert status == 200
    assert payload["ok"] is True
    assert payload["run_tree"]["summary"]["total_tasks"] == 1
    assert payload["run_tree"]["summary"]["total_runs"] == 1
    assert payload["task"]["run_tree"]["root"]["agent"] == "builder"
