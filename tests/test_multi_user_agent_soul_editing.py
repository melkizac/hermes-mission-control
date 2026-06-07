from pathlib import Path

from test_multi_user_phase1 import load_app
from test_multi_user_phase2_phase3 import make_user


def assign_agent(app, identity, agent_id="devops"):
    admin = app.authenticate_user("melverick", "admin-secret")
    result, status = app.admin_set_user_agents(admin, identity["id"], {"agent_ids": [agent_id]})
    assert status == 200
    assert agent_id in result["assigned_agent_ids"]


def test_normal_user_workspace_agent_soul_is_scoped_to_workspace_profile(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "hermes-home"))
    app = load_app(tmp_path, monkeypatch)
    acme = make_user(app, "acme@example.com", name="Acme")
    beta = make_user(app, "beta@example.com", name="Beta")

    assign_agent(app, acme, "devops")
    assign_agent(app, beta, "devops")

    result, status = app.write_workspace_agent_soul(acme, "devops", "# Andrej for Acme\nAcme-specific identity.")
    assert status == 200
    assert result["ok"] is True

    acme_route, acme_status = app.resolve_agent_runtime_route(acme, "devops")
    beta_route, beta_status = app.resolve_agent_runtime_route(beta, "devops")
    assert acme_status == beta_status == 200

    acme_path = Path(acme_route["profile_path"]) / "agents" / "devops" / "SOUL.md"
    beta_path = Path(beta_route["profile_path"]) / "agents" / "devops" / "SOUL.md"
    assert acme_path.read_text() == "# Andrej for Acme\nAcme-specific identity."
    assert not beta_path.exists()
    assert acme_path != beta_path


def test_workspace_agent_soul_is_exposed_as_editable_identity_file_and_prompt_context(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "hermes-home"))
    app = load_app(tmp_path, monkeypatch)
    acme = make_user(app, "acme@example.com", name="Acme")
    assign_agent(app, acme, "devops")
    app.write_workspace_agent_soul(acme, "devops", "# Workspace DevOps Soul\nSpeak as Acme's builder.")

    route, status = app.resolve_agent_runtime_route(acme, "devops")
    assert status == 200
    files = app.read_config_files("devops", identity=acme, agent_id="devops", agent_name="Andrej / DevOps Builder")
    soul = files[0]

    assert soul["name"] == "SOUL.md"
    assert soul["kind"] == "soul"
    assert soul["scope"] == "workspace-agent"
    assert soul["editable"] is True
    assert "Acme's builder" in soul["content"]

    prompt = app.runtime_route_prompt_block(route)
    assert "Workspace-scoped agent SOUL.md identity override" in prompt
    assert "Acme's builder" in prompt


def test_default_workspace_agent_soul_is_returned_before_file_exists(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "hermes-home"))
    app = load_app(tmp_path, monkeypatch)
    acme = make_user(app, "acme@example.com", name="Acme")
    assign_agent(app, acme, "devops")

    files = app.read_config_files("devops", identity=acme, agent_id="devops", agent_name="Andrej / DevOps Builder")
    soul = files[0]

    assert soul["name"] == "SOUL.md"
    assert soul["updatedAt"] == "not saved"
    assert soul["editable"] is True
    assert "Agent template: devops" in soul["content"]



def test_agent_file_put_route_writes_workspace_soul_for_normal_user(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "hermes-home"))
    app = load_app(tmp_path, monkeypatch)
    acme = make_user(app, "acme@example.com", name="Acme")
    assign_agent(app, acme, "devops")

    token = app.make_session_token(acme["email"])
    data, status = put_agent_file(
        app,
        f"{app.SESSION_COOKIE}={token}",
        "/api/agents/devops/files/SOUL.md",
        {"content": "# Acme API Soul\nRoute write works.", "scope": "workspace-agent"},
    )

    assert status == 200
    assert data["ok"] is True
    workspace_path = app.workspace_agent_identity_path(acme, "devops")
    assert workspace_path.read_text() == "# Acme API Soul\nRoute write works."
    assert not (app.profile_root("devops") / "SOUL.md").exists()


def test_agent_file_put_route_denies_viewer_workspace_soul_edit(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "hermes-home"))
    app = load_app(tmp_path, monkeypatch)
    viewer = make_user(app, "viewer@example.com", role="viewer", name="Viewer")
    assign_agent(app, viewer, "devops")

    token = app.make_session_token(viewer["email"])
    data, status = put_agent_file(
        app,
        f"{app.SESSION_COOKIE}={token}",
        "/api/agents/devops/files/SOUL.md",
        {"content": "# Viewer should not write", "scope": "workspace-agent"},
    )

    assert status == 403
    assert "permission" in data["error"].lower()
    assert not app.workspace_agent_identity_path(viewer, "devops").exists()


def test_admin_agent_file_put_route_honors_workspace_agent_scope(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "hermes-home"))
    app = load_app(tmp_path, monkeypatch)
    admin = app.authenticate_user("melverick", "admin-secret")
    app.select_user_agent(admin, "devops", {})

    token = app.make_session_token(admin["email"])
    data, status = put_agent_file(
        app,
        f"{app.SESSION_COOKIE}={token}",
        "/api/agents/devops/files/SOUL.md",
        {"content": "# Admin Workspace Soul", "scope": "workspace-agent"},
    )

    assert status == 200
    assert data["ok"] is True
    assert app.workspace_agent_identity_path(admin, "devops").read_text() == "# Admin Workspace Soul"
    assert not (app.profile_root("devops") / "SOUL.md").exists()


class _FakePutHandler:
    def __init__(self, app, path, cookie, payload):
        from io import BytesIO
        import json

        self.app = app
        self.path = path
        raw = json.dumps(payload).encode("utf-8")
        self.rfile = BytesIO(raw)
        self.headers = {"Content-Length": str(len(raw)), "Cookie": cookie}
        self.response = None

    def authed(self):
        return True

    def require_auth(self):
        return self.app.Handler.require_auth(self)

    def send_json(self, data, status=200):
        self.response = (data, status)
        return self.response


def put_agent_file(app, cookie, path, payload):
    handler = _FakePutHandler(app, path, cookie, payload)
    app.Handler.do_PUT(handler)
    assert handler.response is not None
    return handler.response
