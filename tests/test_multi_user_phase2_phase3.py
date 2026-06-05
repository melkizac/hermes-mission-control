from test_multi_user_phase1 import load_app


def make_user(app, email, password="secret", role="user", name=None):
    app.upsert_local_user(email, password, role=role, name=name or email, workspace_name=f"{name or email} Workspace")
    identity = app.authenticate_user(email, password)
    assert identity is not None
    return identity


def test_phase2_workspace_records_are_scoped_to_current_user(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    acme = make_user(app, "acme@example.com", name="Acme")
    beta = make_user(app, "beta@example.com", name="Beta")

    app.create_workspace_project(acme, {"id": "acme-launch", "name": "Acme Launch", "description": "Acme only"})
    app.create_workspace_project(beta, {"id": "beta-launch", "name": "Beta Launch", "description": "Beta only"})
    app.create_workspace_task(acme, {"id": "acme-task", "title": "Acme task", "project_id": "acme-launch"})
    app.create_workspace_task(beta, {"id": "beta-task", "title": "Beta task", "project_id": "beta-launch"})
    app.create_workspace_inbox_item(acme, {"id": "acme-approval", "title": "Acme approval"})
    app.create_workspace_inbox_item(beta, {"id": "beta-approval", "title": "Beta approval"})
    app.record_workspace_audit_event(acme, "created", "project", "acme-launch", {"ok": True})
    app.record_workspace_audit_event(beta, "created", "project", "beta-launch", {"ok": True})

    acme_projects = app.list_workspace_projects({}, acme)["projects"]
    acme_tasks = app.list_workspace_tasks({}, acme)["tasks"]
    acme_inbox = app.list_workspace_inbox({}, acme)["items"]
    acme_audit = app.list_workspace_audit_events({}, acme)["events"]

    assert [p["id"] for p in acme_projects] == ["acme-launch"]
    assert [t["id"] for t in acme_tasks] == ["acme-task"]
    assert [i["id"] for i in acme_inbox] == ["acme-approval"]
    assert [e["resource_id"] for e in acme_audit] == ["acme-launch"]


def test_phase2_admin_can_see_all_workspace_records(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    admin = app.authenticate_user("melverick", "admin-secret")
    acme = make_user(app, "acme@example.com", name="Acme")
    beta = make_user(app, "beta@example.com", name="Beta")
    app.create_workspace_project(acme, {"id": "acme-launch", "name": "Acme Launch"})
    app.create_workspace_project(beta, {"id": "beta-launch", "name": "Beta Launch"})

    projects = app.list_workspace_projects({}, admin)["projects"]

    assert {p["id"] for p in projects} >= {"acme-launch", "beta-launch"}


def test_phase3_shared_agent_directory_selection_is_per_workspace(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    acme = make_user(app, "acme@example.com", name="Acme")
    beta = make_user(app, "beta@example.com", name="Beta")

    directory = app.list_agent_directory(acme)["agents"]
    assert {a["id"] for a in directory} >= {"default", "devops"}

    selected, status = app.select_user_agent(acme, "devops", {"nickname": "Builder"})
    assert status == 200
    assert selected["ok"] is True

    acme_agents = app.list_agent_directory(acme)["agents"]
    beta_agents = app.list_agent_directory(beta)["agents"]
    assert next(a for a in acme_agents if a["id"] == "devops")["selected"] is True
    assert next(a for a in beta_agents if a["id"] == "devops")["selected"] is False

    unselected, status = app.unselect_user_agent(acme, "devops")
    assert status == 200
    assert unselected["ok"] is True
    assert next(a for a in app.list_agent_directory(acme)["agents"] if a["id"] == "devops")["selected"] is False


def test_phase3_selected_agent_can_be_assigned_to_workspace_project(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    acme = make_user(app, "acme@example.com", name="Acme")
    beta = make_user(app, "beta@example.com", name="Beta")
    app.create_workspace_project(acme, {"id": "acme-launch", "name": "Acme Launch"})

    denied, status = app.assign_agent_to_project(acme, "acme-launch", "devops")
    assert status == 403
    assert "select" in denied["error"].lower()

    app.select_user_agent(acme, "devops", {})
    assigned, status = app.assign_agent_to_project(acme, "acme-launch", "devops")
    assert status == 200
    assert assigned["ok"] is True
    assert assigned["assignment"]["workspace_id"] == acme["workspace_id"]
    assert assigned["assignment"]["project_id"] == "acme-launch"

    hidden, status = app.assign_agent_to_project(beta, "acme-launch", "devops")
    assert status == 404
