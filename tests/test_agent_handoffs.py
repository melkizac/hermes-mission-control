import json


def _create_task(app, task_id="handoff-task"):
    result, status = app.create_task({
        "id": task_id,
        "title": "Coordinate evidence gate",
        "body": "Task body",
        "assignee": "content-ops",
        "status": "queued",
        "created_by": "test",
    })
    assert status == 201
    assert result["ok"] is True
    return result["task"]


def test_agent_handoff_create_list_update_and_task_detail(tmp_path, monkeypatch):
    import app

    monkeypatch.setattr(app, "KANBAN_DB", tmp_path / "kanban.db")
    _create_task(app)

    payload, status = app.create_agent_handoff({
        "id": "handoff-content-to-growth",
        "from_agent": "content-ops",
        "to_agent": "linkedin-growth",
        "task_id": "handoff-task",
        "objective": "Turn draft into scheduled LinkedIn post",
        "context": "Use approved campaign brief; do not expose secrets.",
        "requested_output": "Scheduled post proof plus blocker if LinkedIn auth fails.",
        "risk": "high",
        "status": "requested",
        "evidence": [{"kind": "task", "task_id": "handoff-task", "summary": "ready for handoff"}],
    }, {"username": "unit-test"})

    assert status == 201
    assert payload["ok"] is True
    handoff = payload["handoff"]
    assert handoff["from_agent"] == "content-ops"
    assert handoff["to_agent"] == "linkedin-growth"
    assert handoff["risk"] == "high"
    assert handoff["status"] == "requested"
    assert handoff["evidence"][0]["kind"] == "task"

    listed = app.list_agent_handoffs({"task_id": ["handoff-task"]})
    assert listed["summary"]["total"] == 1
    assert listed["summary"]["open"] == 1
    assert listed["summary"]["high_risk"] == 1
    assert listed["handoffs"][0]["id"] == "handoff-content-to-growth"

    update, update_status = app.update_agent_handoff("handoff-content-to-growth", {
        "status": "completed",
        "evidence": [{"kind": "api", "summary": "handoff accepted and completed"}],
    })
    assert update_status == 200
    assert update["handoff"]["status"] == "completed"
    assert update["handoff"]["evidence"][0]["kind"] == "api"

    detail, detail_status = app.task_result_response("handoff-task")
    assert detail_status == 200
    assert detail["task"]["agent_handoffs"][0]["id"] == "handoff-content-to-growth"
    assert detail["agent_handoffs"][0]["status"] == "completed"

    con = app.kanban_connect(True)
    events = [row[0] for row in con.execute("SELECT kind FROM task_events WHERE task_id=? ORDER BY created_at", ("handoff-task",)).fetchall()]
    con.close()
    assert "agent_handoff_created" in events
    assert "agent_handoff_updated" in events


def test_agent_handoff_validation_and_task_filter(tmp_path, monkeypatch):
    import app

    monkeypatch.setattr(app, "KANBAN_DB", tmp_path / "kanban.db")
    missing, missing_status = app.create_agent_handoff({"from_agent": "a", "to_agent": "b", "requested_output": "x"})
    assert missing_status == 400
    assert missing["ok"] is False
    assert "objective" in missing["error"]

    not_found, not_found_status = app.create_agent_handoff({
        "from_agent": "a",
        "to_agent": "b",
        "task_id": "does-not-exist",
        "objective": "x",
        "requested_output": "y",
    })
    assert not_found_status == 404
    assert not_found["error"] == "task not found"


def test_operational_agent_org_exposes_handoffs_and_summary(tmp_path, monkeypatch):
    import app

    monkeypatch.setattr(app, "KANBAN_DB", tmp_path / "kanban.db")
    monkeypatch.setattr(app, "load_agent_registry", lambda: {
        "agents": [
            {"id": "content-ops", "name": "Content Ops", "role": "Drafts", "summary": "Creates assets", "mode": "draft", "tools": [], "permissions": [], "skills": []},
            {"id": "linkedin-growth", "name": "LinkedIn Growth", "role": "Publishes", "summary": "Schedules posts", "mode": "approval", "tools": [], "permissions": [], "skills": []},
        ],
        "flows": [],
    })
    monkeypatch.setattr(app, "list_automations", lambda filters: {"automations": []})
    monkeypatch.setattr(app, "list_skill_hub", lambda filters: {"skills": []})
    monkeypatch.setattr(app, "list_inbox", lambda filters: {"items": []})
    monkeypatch.setattr(app, "get_costs", lambda filters: {"expensive_sessions": []})
    monkeypatch.setattr(app, "list_projects", lambda filters: {"projects": []})
    monkeypatch.setattr(app, "list_agent_activity", lambda limit=400: [])
    monkeypatch.setattr(app, "profile_runtime_details", lambda profile_id, **kwargs: {})

    _create_task(app, "org-handoff-task")
    created, status = app.create_agent_handoff({
        "id": "handoff-org-visible",
        "from_agent": "content-ops",
        "to_agent": "linkedin-growth",
        "task_id": "org-handoff-task",
        "objective": "Move approved draft to publishing",
        "requested_output": "Publishing proof attached to task.",
        "risk": "medium",
        "status": "blocked",
        "evidence": [{"kind": "blocker", "summary": "waiting on account access"}],
    })
    assert status == 201, created

    org = app.operational_agent_org()
    by_id = {agent["id"]: agent for agent in org["agents"]}
    assert by_id["content-ops"]["handoff_summary"]["sent"] == 1
    assert by_id["linkedin-growth"]["handoff_summary"]["received"] == 1
    assert by_id["linkedin-growth"]["handoff_summary"]["blocked"] == 1
    assert by_id["linkedin-growth"]["handoffs"][0]["id"] == "handoff-org-visible"
    assert org["summary"]["open_handoffs"] == 1
    assert org["summary"]["blocked_handoffs"] == 1
