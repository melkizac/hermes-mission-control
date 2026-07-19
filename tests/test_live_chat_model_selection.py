import importlib.util
import json
import sys
import time
from pathlib import Path
from types import SimpleNamespace


ROOT = Path(__file__).resolve().parents[1]


def load_app(tmp_path, monkeypatch):
    app_root = tmp_path / "mission-control"
    app_root.mkdir()
    password_file = tmp_path / "admin-password"
    password_file.write_text("admin-secret\n", encoding="utf-8")
    monkeypatch.setenv("HMC_APP_ROOT", str(app_root))
    monkeypatch.setenv("HMC_APP_DB", str(app_root / "mission_control.db"))
    monkeypatch.setenv("HMC_PASSWORD_FILE", str(password_file))
    backend = ROOT / "backend"
    if str(backend) not in sys.path:
        sys.path.insert(0, str(backend))
    sys.modules.pop("auth", None)
    module_name = f"hmc_live_model_selection_{time.time_ns()}"
    spec = importlib.util.spec_from_file_location(module_name, backend / "app.py")
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def test_chat_models_are_unique_healthy_hermes_routes(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    router_file = tmp_path / "model-router.json"
    router_file.write_text(json.dumps({
        "enabled": True,
        "models": [
            {"id": "missing-openai", "label": "Missing OpenAI", "provider": "openai", "model": "gpt-x", "enabled": True, "credential_env": "OPENAI_API_KEY"},
            {"id": "codex-canonical", "label": "Hermes CLI default", "provider": "openai-codex", "model": "gpt-5.5", "enabled": True},
            {"id": "codex-account-copy", "label": "OAuth account copy", "provider": "openai-codex", "model": "gpt-5.5", "enabled": True},
            {"id": "deepseek-chat", "label": "DeepSeek", "provider": "deepseek", "model": "deepseek-chat", "enabled": True, "credential_env": "DEEPSEEK_API_KEY"},
            {"id": "openrouter-auto", "label": "OpenRouter Auto", "provider": "openrouter", "model": "openrouter/auto", "enabled": True, "credential_env": "OPENROUTER_API_KEY"},
        ],
    }), encoding="utf-8")
    monkeypatch.setattr(app, "MODEL_ROUTER_FILE", router_file)
    monkeypatch.setattr(app, "configured_env_keys", lambda: {"DEEPSEEK_API_KEY", "OPENROUTER_API_KEY"})
    monkeypatch.setattr(app, "configured_env_value", lambda name: "configured" if name in {"DEEPSEEK_API_KEY", "OPENROUTER_API_KEY"} else "")
    monkeypatch.setattr(app, "hermes_auth_credentials", lambda: [
        {"provider": "openai-codex", "label": "Codex", "auth_type": "oauth", "active": True, "health": "healthy"},
        {"provider": "openrouter", "label": "OpenRouter", "auth_type": "api_key", "active": True, "health": "healthy"},
        {"provider": "deepseek", "label": "DeepSeek", "auth_type": "api_key", "active": True, "health": "rate-limited"},
    ])
    monkeypatch.setattr(app, "hermes_cli_settings", lambda: {
        "active": {"provider": "openai-codex", "model": "gpt-5.6", "credential_env": ""},
        "auth_providers": ["openai-codex", "openrouter", "deepseek"],
    })

    config = app.read_model_router_config()
    available = config["available_models"]
    routes = [(item["provider"], item["model"]) for item in available]

    assert routes == [
        ("openai-codex", "gpt-5.6"),
        ("openai-codex", "gpt-5.5"),
        ("openrouter", "openrouter/auto"),
    ]
    assert all(item["enabled"] and item["authorized"] for item in available)
    assert config["summary"]["available"] == 3


def test_manual_chat_selection_rejects_stale_route_and_carries_provider(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    good = {"id": "openrouter-auto", "label": "OpenRouter Auto", "provider": "openrouter", "model": "openrouter/auto", "tier": "balanced", "enabled": True, "authorized": True}
    stale = {"id": "missing-openai", "label": "Missing OpenAI", "provider": "openai", "model": "gpt-x", "tier": "frontier", "enabled": True, "authorized": False}
    monkeypatch.setattr(app, "read_model_router_config", lambda: {
        "enabled": True,
        "models": [stale, good],
        "available_models": [good],
    })

    rejected = app.resolve_message_model({"modelRouting": {"mode": "manual", "modelId": stale["id"]}}, "hello")
    selected = app.resolve_message_model({"modelRouting": {"mode": "manual", "modelId": good["id"]}}, "hello")

    assert "no longer available" in rejected["error"]
    assert selected["api_model"] == "openrouter/auto"
    assert selected["api_provider"] == "openrouter"
    assert selected["force_cli"] is True


def test_manual_route_executes_hermes_cli_with_provider_and_model(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    calls = []

    def fake_run(cmd, **kwargs):
        calls.append((cmd, kwargs))
        return SimpleNamespace(returncode=0, stdout="Selected model reply.", stderr="")

    monkeypatch.setattr(app, "resolve_hermes_cli_bin", lambda: "/usr/local/bin/hermes")
    monkeypatch.setattr(app.subprocess, "run", fake_run)

    result = app.api_chat_completion(
        [{"role": "user", "content": "hello"}],
        model="openrouter/auto",
        provider="openrouter",
        force_cli=True,
        runtime_route={"profile_name": "default"},
        request_id="manual-model-1",
    )

    command = calls[0][0]
    assert command[:2] == ["/usr/local/bin/hermes", "chat"]
    assert command[command.index("--provider") + 1] == "openrouter"
    assert command[command.index("-m") + 1] == "openrouter/auto"
    assert result["choices"][0]["message"]["content"] == "Selected model reply."


def test_agent_default_uses_profile_model_and_forces_exact_cli_route(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    default_model = {
        "id": "codex-default",
        "label": "Hermes profile default",
        "provider": "openai-codex",
        "model": "gpt-5.6",
        "tier": "frontier",
        "enabled": True,
        "authorized": True,
    }
    monkeypatch.setattr(app, "read_model_router_config", lambda: {
        "enabled": True,
        "models": [default_model],
        "available_models": [default_model],
    })
    monkeypatch.setattr(app, "profile_model_config", lambda profile: {
        "provider": "openai-codex",
        "model": "gpt-5.6",
        "base_url": "",
    })
    monkeypatch.setattr(app, "agent_runtime_assignment", lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("agent assignment must not override the Hermes profile default")))

    selected = app.resolve_message_model(
        {"modelRouting": {"mode": "auto"}},
        "hello",
        agent_id="melkizac",
        runtime_route={"profile_name": "default"},
    )

    assert selected["mode"] == "auto"
    assert selected["api_provider"] == "openai-codex"
    assert selected["api_model"] == "gpt-5.6"
    assert selected["selected_model"] == default_model
    assert selected["force_cli"] is True
    assert "Hermes profile default" in selected["reason"]


def test_smart_routing_selects_a_healthy_model_and_forces_exact_cli_route(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    healthy_model = {
        "id": "openrouter-auto",
        "label": "OpenRouter Auto",
        "provider": "openrouter",
        "model": "openrouter/auto",
        "tier": "balanced",
        "enabled": True,
        "authorized": True,
    }
    stale_model = {
        "id": "stale",
        "label": "Stale",
        "provider": "openai",
        "model": "gpt-x",
        "tier": "frontier",
        "enabled": True,
        "authorized": False,
    }
    monkeypatch.setattr(app, "read_model_router_config", lambda: {
        "enabled": True,
        "models": [stale_model],
        "available_models": [healthy_model],
        "summary": {},
        "policy": {},
    })

    selected = app.resolve_message_model(
        {"modelRouting": {"mode": "smart"}},
        "Handle this standard task and verify the result",
        runtime_route={"profile_name": "default"},
    )

    assert selected["mode"] == "smart"
    assert selected["selected_model"] == healthy_model
    assert selected["api_provider"] == "openrouter"
    assert selected["api_model"] == "openrouter/auto"
    assert selected["force_cli"] is True
    assert "smart-selected by complexity" in selected["reason"]


def test_both_chat_interfaces_share_available_model_filter():
    helper = (ROOT / "src/services/modelSelection.ts").read_text(encoding="utf-8")
    agent_chat = (ROOT / "src/components/ChatThread.tsx").read_text(encoding="utf-8")
    main_chat = (ROOT / "src/views/MissionControl.tsx").read_text(encoding="utf-8")

    assert "available_models" in helper
    assert "model.enabled && model.authorized" in helper
    assert 'from "../services/modelSelection"' in agent_chat
    assert 'from "../services/modelSelection"' in main_chat
    assert "availableChatModels(routerConfig)" in agent_chat
    assert "availableChatModels(modelRouterConfig)" in main_chat
    assert "key missing" not in agent_chat
    assert "key missing" not in main_chat
    assert 'option value="auto">' in agent_chat and "Agent default" in agent_chat
    assert 'option value="smart">Smart routing' in agent_chat
    assert 'option value="auto">' in main_chat and "Agent default" in main_chat
    assert 'option value="smart">Smart routing' in main_chat
    assert 'return { mode: "smart" }' in agent_chat
    assert 'return { mode: "smart" }' in main_chat
