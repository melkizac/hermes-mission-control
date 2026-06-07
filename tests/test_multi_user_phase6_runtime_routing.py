from pathlib import Path
from types import SimpleNamespace

from test_multi_user_phase1 import load_app
from test_multi_user_phase2_phase3 import make_user


def assign_agent(app, identity, agent_id):
    admin = app.authenticate_user("melverick", "admin-secret")
    current = app.admin_user_agent_access(app.auth_db_connect(), identity["id"], identity["workspace"]["id"], identity.get("role", "user"))["assigned_agent_ids"]
    result, status = app.admin_set_user_agents(admin, identity["id"], {"agent_ids": sorted(set(current + [agent_id]))})
    assert status == 200
    assert agent_id in result["assigned_agent_ids"]


def test_phase6_workspace_profile_is_one_profile_per_workspace_not_per_agent(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "hermes-home"))
    app = load_app(tmp_path, monkeypatch)
    acme = make_user(app, "acme@example.com", name="Acme")

    assign_agent(app, acme, "default")
    assign_agent(app, acme, "devops")
    default_route, default_status = app.resolve_agent_runtime_route(acme, "default")
    devops_route, devops_status = app.resolve_agent_runtime_route(acme, "devops")

    assert default_status == 200
    assert devops_status == 200
    assert default_route["profile_name"] == devops_route["profile_name"] == "mc-acme"
    assert default_route["profile_path"] == devops_route["profile_path"]
    assert default_route["agent_id"] == "default"
    assert devops_route["agent_id"] == "devops"
    assert devops_route["shared_agent_ref"] == "devops"
    assert Path(devops_route["profile_path"]).is_dir()
    assert (Path(devops_route["profile_path"]) / "MISSION_CONTROL_RUNTIME.json").exists()


def test_phase6_runtime_route_is_isolated_between_workspaces(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "hermes-home"))
    app = load_app(tmp_path, monkeypatch)
    acme = make_user(app, "acme@example.com", name="Acme")
    beta = make_user(app, "beta@example.com", name="Beta")

    assign_agent(app, acme, "devops")
    assign_agent(app, beta, "devops")
    acme_route, _ = app.resolve_agent_runtime_route(acme, "devops")
    beta_route, _ = app.resolve_agent_runtime_route(beta, "devops")

    assert acme_route["profile_name"] == "mc-acme"
    assert beta_route["profile_name"] == "mc-beta"
    assert acme_route["profile_path"] != beta_route["profile_path"]
    assert acme_route["channel_id"] != beta_route["channel_id"]


def test_phase6_normal_user_must_select_agent_before_runtime_chat(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "hermes-home"))
    app = load_app(tmp_path, monkeypatch)
    acme = make_user(app, "acme@example.com", name="Acme")

    denied, status = app.resolve_agent_runtime_route(acme, "devops")
    assert status == 403
    assert "assigned" in denied["error"].lower()

    assign_agent(app, acme, "devops")
    allowed, status = app.resolve_agent_runtime_route(acme, "devops")
    assert status == 200
    assert allowed["ok"] is True


def test_phase6_runtime_prompt_and_headers_include_workspace_profile(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "hermes-home"))
    app = load_app(tmp_path, monkeypatch)
    acme = make_user(app, "acme@example.com", name="Acme")
    assign_agent(app, acme, "devops")
    route, status = app.resolve_agent_runtime_route(acme, "devops")
    assert status == 200

    prompt = app.runtime_route_prompt_block(route)
    headers = app.runtime_route_headers(route)

    assert "workspace = Hermes profile" in prompt
    assert "mc-acme" in prompt
    assert "ws_acme_example_com" in prompt
    assert headers["X-Hermes-Profile"] == "mc-acme"
    assert headers["X-Hermes-Workspace"] == "ws_acme_example_com"
    assert headers["X-Hermes-Agent-Template"] == "devops"


def test_phase6_admin_devops_agent_routes_to_dedicated_profile_when_configured(tmp_path, monkeypatch):
    hermes_home = tmp_path / "hermes-home"
    monkeypatch.setenv("HERMES_HOME", str(hermes_home))
    app = load_app(tmp_path, monkeypatch)
    identity = app.authenticate_user("melverick", "admin-secret")
    devops_root = hermes_home / "profiles" / "devops"
    devops_root.mkdir(parents=True)

    route, status = app.resolve_agent_runtime_route(identity, "devops")

    assert status == 200
    assert route["routing_model"] == "profile-backed-agent"
    assert route["profile_name"] == "devops"
    assert route["channel_id"] == "devops"
    assert route["profile_path"] == str(devops_root)
    assert app.runtime_route_headers(route)["X-Hermes-Profile"] == "devops"


def test_phase6_admin_default_agent_still_routes_to_workspace_profile(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "hermes-home"))
    app = load_app(tmp_path, monkeypatch)
    identity = app.authenticate_user("melverick", "admin-secret")

    route, status = app.resolve_agent_runtime_route(identity, "default")

    assert status == 200
    assert route["routing_model"] == "workspace-profile"
    assert route["profile_name"] == "mc-melverick"
    assert route["channel_id"] == "mc-melverick__default"


def test_phase6_profile_backed_chat_uses_profile_cli_and_strips_session_id(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "hermes-home"))
    app = load_app(tmp_path, monkeypatch)
    calls = []

    def fake_run(cmd, **kwargs):
        calls.append((cmd, kwargs))
        return SimpleNamespace(returncode=0, stdout="session_id: test-session\nI’m Andrej, your DevOps Builder.", stderr="")

    monkeypatch.setattr(app.shutil, "which", lambda name: "/usr/local/bin/hermes")
    monkeypatch.setattr(app.subprocess, "run", fake_run)

    result = app.api_chat_completion(
        [{"role": "system", "content": "context"}, {"role": "user", "content": "who are you?"}],
        runtime_route={"routing_model": "profile-backed-agent", "profile_name": "devops"},
        request_id="req-1",
    )

    assert calls[0][0][:4] == ["/usr/local/bin/hermes", "--profile", "devops", "chat"]
    assert calls[0][1]["env"]["HERMES_PROFILE"] == "devops"
    assert result["choices"][0]["message"]["content"] == "I’m Andrej, your DevOps Builder."


def test_phase6_profile_chat_falls_back_to_repo_venv_hermes_when_service_path_is_sparse(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / "hermes-home"))
    app = load_app(tmp_path, monkeypatch)
    calls = []

    def fake_run(cmd, **kwargs):
        calls.append((cmd, kwargs))
        return SimpleNamespace(returncode=0, stdout="session_id: test-session\nFallback CLI works.", stderr="")

    monkeypatch.delenv("HMC_HERMES_BIN", raising=False)
    monkeypatch.setattr(app.shutil, "which", lambda name: None)
    monkeypatch.setattr(app.Path, "exists", lambda self: str(self) == "/root/hermes-agent/venv/bin/hermes")
    monkeypatch.setattr(app.subprocess, "run", fake_run)

    result = app.api_chat_completion(
        [{"role": "user", "content": "ping"}],
        runtime_route={"routing_model": "profile-backed-agent", "profile_name": "devops"},
        request_id="req-2",
    )

    assert calls[0][0][:4] == ["/root/hermes-agent/venv/bin/hermes", "--profile", "devops", "chat"]
    assert result["choices"][0]["message"]["content"] == "Fallback CLI works."


def test_phase6_profile_backed_cli_prompt_is_sanitized_for_visible_chat(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    prompt = app.messages_to_cli_prompt([
        {"role": "system", "content": "Mission Control runtime routing context:\n- Hermes profile: devops"},
        {"role": "user", "content": "hi"},
    ])

    assert prompt.startswith("Mission Control context:")
    assert "User message:\nhi" in prompt
    assert app.visible_user_message_from_cli_prompt(prompt) == "hi"
    assert app.visible_user_message_from_cli_prompt("ordinary terminal message") == "ordinary terminal message"
