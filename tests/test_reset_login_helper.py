import argparse
import importlib.util
import sqlite3
import sys
from pathlib import Path

SCRIPT_PATH = Path("/opt/hermes-mission-control/reset-login.py")


def load_reset_module(monkeypatch, tmp_path):
    service_file = tmp_path / "hermes-mission-control.service"
    app_root = tmp_path / "app"
    app_root.mkdir()
    monkeypatch.setenv("HMC_RESET_SERVICE_FILE", str(service_file))
    monkeypatch.setenv("HMC_APP_ROOT", str(app_root))
    monkeypatch.setenv("HMC_APP_DB", str(app_root / "mission_control.db"))
    module_name = f"reset_login_helper_{tmp_path.name.replace('-', '_')}"
    spec = importlib.util.spec_from_file_location(module_name, SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module, service_file, app_root


def write_service(service_file, password_file, username="oldadmin"):
    service_file.write_text(
        "[Unit]\nDescription=Test\n\n"
        "[Service]\n"
        "Type=simple\n"
        f"Environment=HMC_USER={username}\n"
        f"Environment=HMC_PASSWORD_FILE={password_file}\n"
        "ExecStart=/usr/bin/python3 /opt/hermes-mission-control/app.py\n"
    )


def seed_old_admin(module, db_path, email="oldadmin", password="old-password-123"):
    con = sqlite3.connect(db_path)
    module.ensure_auth_tables(con)
    con.execute(
        "INSERT INTO users (id,email,name,password_hash,role,status,created_at,last_login_at) VALUES (?,?,?,?,?,?,?,?)",
        ("user_oldadmin", email, email, module.password_hash(password), "admin", "active", 123, 456),
    )
    con.execute(
        "INSERT INTO workspaces (id,owner_user_id,name,slug,created_at) VALUES (?,?,?,?,?)",
        ("ws_oldadmin", "user_oldadmin", "Old Workspace", "oldadmin", 123),
    )
    con.commit()
    con.close()


def test_non_root_refuses_before_touching_files(monkeypatch, tmp_path, capsys):
    module, service_file, app_root = load_reset_module(monkeypatch, tmp_path)
    password_file = tmp_path / "secret"
    write_service(service_file, password_file)
    monkeypatch.setattr(module.os, "geteuid", lambda: 1000)
    monkeypatch.setattr(sys, "argv", ["reset-login.py", "--username", "newadmin", "--password", "new-password-123"])

    try:
        module.main()
        assert False, "main should exit for non-root callers"
    except SystemExit as exc:
        assert exc.code == 1

    assert not password_file.exists()
    assert not (app_root / "mission_control.db").exists()
    assert "run this script as root/sudo" in capsys.readouterr().err


def test_reset_updates_service_password_file_and_auth_db(monkeypatch, tmp_path):
    module, service_file, app_root = load_reset_module(monkeypatch, tmp_path)
    password_file = tmp_path / "mission-control-password"
    write_service(service_file, password_file, username="oldadmin")
    db_path = app_root / "mission_control.db"
    seed_old_admin(module, db_path)
    calls = []
    monkeypatch.setattr(module, "run", lambda cmd: calls.append(cmd))

    args = argparse.Namespace(
        username="newadmin",
        password="new-password-456",
        generate=False,
        print_password=False,
        no_restart=True,
        no_db_backup=False,
    )
    result = module.reset_credentials(args)

    assert result["username"] == "newadmin"
    assert result["old_username"] == "oldadmin"
    assert result["restarted"] is False
    assert calls == [["systemctl", "daemon-reload"]]
    assert password_file.read_text() == "new-password-456\n"
    assert oct(password_file.stat().st_mode)[-3:] == "600"
    service_text = service_file.read_text()
    assert "Environment=HMC_USER=newadmin" in service_text
    assert f"Environment=HMC_PASSWORD_FILE={password_file}" in service_text
    assert Path(result["db_backup"]).exists()
    assert oct(Path(result["db_backup"]).stat().st_mode)[-3:] == "600"

    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    rows = con.execute("SELECT id,email,password_hash,role,status,last_login_at FROM users ORDER BY email").fetchall()
    assert len(rows) == 1
    row = rows[0]
    assert row["id"] == "user_oldadmin"
    assert row["email"] == "newadmin"
    assert row["role"] == "admin"
    assert row["status"] == "active"
    assert row["last_login_at"] is None
    assert module.verify_password("new-password-456", row["password_hash"])
    assert not module.verify_password("old-password-123", row["password_hash"])
    assert con.execute("SELECT id FROM workspaces WHERE owner_user_id=?", ("user_oldadmin",)).fetchone()
    con.close()


def test_reserved_demo_username_is_rejected(monkeypatch, tmp_path):
    module, service_file, _ = load_reset_module(monkeypatch, tmp_path)
    write_service(service_file, tmp_path / "secret")
    args = argparse.Namespace(
        username="demo",
        password="new-password-456",
        generate=False,
        print_password=False,
        no_restart=True,
        no_db_backup=True,
    )
    try:
        module.reset_credentials(args)
        assert False, "reserved demo username should fail"
    except SystemExit as exc:
        assert exc.code == 1
