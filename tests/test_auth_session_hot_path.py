import importlib.util
import sys
import time
from pathlib import Path


def load_auth(tmp_path, monkeypatch):
    password_file = tmp_path / "admin-password"
    password_file.write_text("admin-secret\n", encoding="utf-8")
    app_root = tmp_path / "mission-control"
    app_root.mkdir()
    monkeypatch.setenv("HMC_APP_ROOT", str(app_root))
    monkeypatch.setenv("HMC_APP_DB", str(app_root / "mission_control.db"))
    monkeypatch.setenv("HMC_PASSWORD_FILE", str(password_file))
    monkeypatch.setenv("HMC_USER", "melverick")
    monkeypatch.setenv("HMC_DEMO_USER", "")
    monkeypatch.setenv("HMC_USER_RUNTIME_AUTO_START", "0")
    module_name = f"hmc_auth_hot_path_{time.time_ns()}"
    auth_path = Path(__file__).resolve().parents[1] / "backend" / "auth.py"
    spec = importlib.util.spec_from_file_location(module_name, auth_path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def test_session_resolution_reads_existing_runtime_without_reprovisioning(tmp_path, monkeypatch):
    auth = load_auth(tmp_path, monkeypatch)
    identity = auth.authenticate_user("melverick", "admin-secret")
    token = auth.make_session_token(identity["email"])

    def fail_if_reprovisioned(*_args, **_kwargs):
        raise AssertionError("session validation must not provision a runtime")

    monkeypatch.setattr(auth, "ensure_user_runtime", fail_if_reprovisioned)
    resolved = auth.resolve_session_token(token)

    assert resolved["ok"] is True
    assert resolved["user"]["email"] == "melverick"
    assert resolved["runtime"]["user_id"] == identity["id"]
