#!/usr/bin/env python3
"""Reset Hermes Mission Control admin/operator login credentials.

Usage:
  sudo /opt/hermes-mission-control/reset-login.py --username NEW_ID
  sudo /opt/hermes-mission-control/reset-login.py --username NEW_ID --password 'NEW_PASSWORD'
  sudo /opt/hermes-mission-control/reset-login.py --username NEW_ID --generate --print-password

By default this script prompts securely and never prints the password.  It updates
both the systemd credential source and the Mission Control auth database so the
previous configured admin login is superseded instead of remaining active.
"""
from __future__ import annotations

import argparse
import hashlib
import hmac
import os
import re
import secrets
import shutil
import sqlite3
import subprocess
import sys
import time
from getpass import getpass
from pathlib import Path

SERVICE_NAME = os.environ.get("HMC_RESET_SERVICE_NAME", "hermes-mission-control.service")
SERVICE_FILE = Path(os.environ.get("HMC_RESET_SERVICE_FILE", "/etc/systemd/system/hermes-mission-control.service"))
APP_ROOT = Path(os.environ.get("HMC_APP_ROOT", "/opt/hermes-mission-control"))
DEFAULT_PASSWORD_FILE = Path(os.environ.get("HMC_RESET_DEFAULT_PASSWORD_FILE", str(APP_ROOT / ".basic-password")))
APP_DB = Path(os.environ.get("HMC_APP_DB", str(APP_ROOT / "mission_control.db")))
MIN_PASSWORD_LENGTH = 12
USERNAME_RE = re.compile(r"[A-Za-z0-9._@-]+")


def fail(message: str, code: int = 1) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(code)


def validate_username(username: str) -> str:
    username = (username or "").strip()
    if not username:
        fail("username is required")
    if len(username) > 80:
        fail("username must be 80 characters or fewer")
    if not USERNAME_RE.fullmatch(username):
        fail("username may contain only letters, numbers, dot, underscore, @, or hyphen")
    if username.lower() == "demo":
        fail("admin username cannot be 'demo' because that is reserved for the demo account")
    return username


def validate_password(password: str) -> str:
    if len(password) < MIN_PASSWORD_LENGTH:
        fail(f"password must be at least {MIN_PASSWORD_LENGTH} characters")
    if "\n" in password or "\r" in password:
        fail("password cannot contain newlines")
    return password


def read_password(args: argparse.Namespace) -> tuple[str, bool]:
    """Return (password, generated)."""
    sources = [bool(args.password is not None), bool(args.generate)]
    if sum(sources) > 1:
        fail("choose only one password source: prompt, --password, or --generate")
    if args.password is not None:
        return validate_password(args.password), False
    if args.generate:
        # token_urlsafe(24) yields about 32 printable characters with no newline.
        return validate_password(secrets.token_urlsafe(24)), True
    password = getpass("New Mission Control password: ")
    confirm = getpass("Confirm password: ")
    if password != confirm:
        fail("passwords do not match")
    return validate_password(password), False


def service_text() -> str:
    if not SERVICE_FILE.exists():
        fail(f"service file not found: {SERVICE_FILE}")
    return SERVICE_FILE.read_text(errors="replace")


def env_value(text: str, key: str, default: str = "") -> str:
    pattern = rf"^Environment={re.escape(key)}=(.+)$"
    match = re.search(pattern, text, re.MULTILINE)
    if not match:
        return default
    return match.group(1).strip().strip('"')


def password_file_from_service(text: str) -> Path:
    return Path(env_value(text, "HMC_PASSWORD_FILE", str(DEFAULT_PASSWORD_FILE)))


def configured_user_from_service(text: str) -> str:
    return env_value(text, "HMC_USER", "admin").strip() or "admin"


def set_or_append_env(text: str, key: str, value: str) -> str:
    line = f"Environment={key}={value}"
    pattern = rf"^Environment={re.escape(key)}=.*$"
    if re.search(pattern, text, re.MULTILINE):
        return re.sub(pattern, line, text, count=1, flags=re.MULTILINE)
    service_header = "[Service]\n"
    if service_header not in text:
        fail("service file has no [Service] section")
    return text.replace(service_header, service_header + line + "\n", 1)


def atomic_write(path: Path, content: str, mode: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.tmp-{os.getpid()}")
    tmp.write_text(content)
    tmp.chmod(mode)
    os.replace(tmp, path)
    path.chmod(mode)


def run(cmd: list[str]) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(cmd, text=True, capture_output=True)
    if result.returncode != 0:
        detail = (result.stderr.strip() or result.stdout.strip()).splitlines()
        fail(f"command failed: {' '.join(cmd)}" + (f"\n{detail[0]}" if detail else ""))
    return result


def password_hash(password: str, salt: str | None = None, iterations: int = 210000) -> str:
    salt = salt or secrets.token_hex(16)
    derived = hashlib.pbkdf2_hmac("sha256", str(password).encode("utf-8"), salt.encode("utf-8"), iterations)
    return f"pbkdf2_sha256${iterations}${salt}${derived.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        scheme, iterations, salt, expected = stored_hash.split("$", 3)
        if scheme != "pbkdf2_sha256":
            return False
        candidate = password_hash(password, salt=salt, iterations=int(iterations)).split("$", 3)[3]
        return hmac.compare_digest(candidate, expected)
    except Exception:
        return False


def user_slug(value: str) -> str:
    raw = (value or "user").strip().lower()
    raw = re.sub(r"[^a-z0-9]+", "-", raw).strip("-")
    return raw or "user"


def ensure_auth_tables(con: sqlite3.Connection) -> None:
    # Minimal subset needed for an emergency credential reset. app.py/auth.py may
    # extend this schema further when the service starts.
    con.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            status TEXT NOT NULL DEFAULT 'active',
            created_at INTEGER NOT NULL,
            last_login_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS workspaces (
            id TEXT PRIMARY KEY,
            owner_user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            slug TEXT NOT NULL UNIQUE,
            created_at INTEGER NOT NULL
        );
        """
    )


def backup_db(app_db: Path) -> Path | None:
    if not app_db.exists():
        return None
    backup = app_db.with_name(f"{app_db.name}.reset-backup-{time.strftime('%Y%m%d-%H%M%S')}")
    shutil.copy2(app_db, backup)
    backup.chmod(0o600)
    return backup


def upsert_admin_user(con: sqlite3.Connection, old_username: str, new_username: str, password: str) -> dict[str, object]:
    con.row_factory = sqlite3.Row
    ensure_auth_tables(con)
    now = int(time.time())
    phash = password_hash(password)
    old = con.execute("SELECT * FROM users WHERE email=?", (old_username,)).fetchone()
    new = con.execute("SELECT * FROM users WHERE email=?", (new_username,)).fetchone()
    action = "created"
    disabled_previous = False

    if old and old_username != new_username and not new:
        con.execute(
            "UPDATE users SET email=?, name=?, password_hash=?, role='admin', status='active', last_login_at=NULL WHERE id=?",
            (new_username, new_username, phash, old["id"]),
        )
        user_id = old["id"]
        action = "renamed"
    elif new:
        con.execute(
            "UPDATE users SET password_hash=?, role='admin', status='active', last_login_at=NULL WHERE id=?",
            (phash, new["id"]),
        )
        user_id = new["id"]
        action = "updated"
        if old and old_username != new_username:
            con.execute("UPDATE users SET status='disabled', last_login_at=NULL WHERE id=?", (old["id"],))
            disabled_previous = True
    elif old:
        con.execute(
            "UPDATE users SET password_hash=?, role='admin', status='active', last_login_at=NULL WHERE id=?",
            (phash, old["id"]),
        )
        user_id = old["id"]
        action = "updated"
    else:
        slug = user_slug(new_username)
        user_id = f"user_{slug.replace('-', '_')}"
        candidate = user_id
        suffix = 2
        while con.execute("SELECT id FROM users WHERE id=?", (candidate,)).fetchone():
            candidate = f"{user_id}_{suffix}"
            suffix += 1
        user_id = candidate
        con.execute(
            "INSERT INTO users (id,email,name,password_hash,role,status,created_at,last_login_at) VALUES (?,?,?,?,?,?,?,NULL)",
            (user_id, new_username, new_username, phash, "admin", "active", now),
        )
        action = "created"

    # Ensure the admin has at least one workspace so login identity resolution works.
    ws = con.execute("SELECT id FROM workspaces WHERE owner_user_id=? ORDER BY created_at LIMIT 1", (user_id,)).fetchone()
    if not ws:
        slug = user_slug(new_username)
        workspace_id = f"ws_{slug.replace('-', '_')}"
        candidate = workspace_id
        suffix = 2
        while con.execute("SELECT id FROM workspaces WHERE id=? OR slug=?", (candidate, candidate)).fetchone():
            candidate = f"{workspace_id}_{suffix}"
            suffix += 1
        con.execute(
            "INSERT INTO workspaces (id,owner_user_id,name,slug,created_at) VALUES (?,?,?,?,?)",
            (candidate, user_id, f"{new_username} Workspace", candidate.replace('_', '-'), now),
        )
    con.commit()
    stored = con.execute("SELECT password_hash FROM users WHERE id=?", (user_id,)).fetchone()["password_hash"]
    if not verify_password(password, stored):
        fail("database password verification failed after update")
    return {"user_id": user_id, "action": action, "disabled_previous": disabled_previous}


def reset_credentials(args: argparse.Namespace) -> dict[str, object]:
    username = validate_username(args.username)
    password, generated = read_password(args)
    text = service_text()
    old_username = configured_user_from_service(text)
    password_file = password_file_from_service(text)

    db_backup = None if args.no_db_backup else backup_db(APP_DB)
    atomic_write(password_file, password + "\n", 0o600)

    updated = set_or_append_env(text, "HMC_USER", username)
    updated = set_or_append_env(updated, "HMC_PASSWORD_FILE", str(password_file))
    if updated != text:
        atomic_write(SERVICE_FILE, updated, 0o644)

    APP_DB.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(APP_DB, timeout=10)
    try:
        db_result = upsert_admin_user(con, old_username, username, password)
    finally:
        con.close()

    run(["systemctl", "daemon-reload"])
    restarted = False
    if not args.no_restart:
        run(["systemctl", "restart", SERVICE_NAME])
        run(["systemctl", "is-active", "--quiet", SERVICE_NAME])
        restarted = True

    return {
        "username": username,
        "old_username": old_username,
        "password_file": password_file,
        "app_db": APP_DB,
        "db_backup": db_backup,
        "db_result": db_result,
        "generated": generated,
        "password": password,
        "restarted": restarted,
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Reset Mission Control admin login ID and password")
    parser.add_argument("--username", required=True, help="new admin login ID")
    parser.add_argument("--password", help="new admin password; omit to prompt securely")
    parser.add_argument("--generate", action="store_true", help="generate a strong temporary password")
    parser.add_argument("--print-password", action="store_true", help="print generated password once; requires --generate and an interactive TTY")
    parser.add_argument("--no-restart", action="store_true", help="write credentials but do not restart the service")
    parser.add_argument("--no-db-backup", action="store_true", help="skip auth DB backup before changing it")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    if os.geteuid() != 0:
        fail("run this script as root/sudo so it can update the service, password file, and auth DB")
    if args.print_password and (not args.generate or not sys.stdout.isatty()):
        fail("--print-password is only allowed with --generate in an interactive local TTY")

    result = reset_credentials(args)
    print("Mission Control admin login reset complete.")
    print(f"Username: {result['username']}")
    print(f"Previous configured username: {result['old_username']}")
    print(f"Password file: {result['password_file']}")
    print(f"Auth DB: {result['app_db']}")
    if result["db_backup"]:
        print(f"Auth DB backup: {result['db_backup']}")
    print(f"Auth DB user action: {result['db_result']['action']}")
    print(f"Previous configured user disabled: {'yes' if result['db_result']['disabled_previous'] else 'no'}")
    print("Password: [hidden]")
    if args.print_password:
        print(f"Generated password (display once): {result['password']}")
    print(f"Service restarted: {'yes' if result['restarted'] else 'no'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
