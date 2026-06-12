import base64
import hashlib
import hmac
import os
import re
import secrets
import shutil
import sqlite3
import subprocess
import threading
import time
from pathlib import Path

HOME = Path('/root')
HERMES_HOME = Path(os.environ.get('HERMES_HOME', HOME / '.hermes'))
APP_ROOT = Path(os.environ.get('HMC_APP_ROOT', '/opt/hermes-mission-control'))
APP_DB = Path(os.environ.get('HMC_APP_DB', APP_ROOT / 'mission_control.db'))
RUNTIME_ROOT = Path(os.environ.get('HMC_USER_RUNTIME_ROOT', APP_ROOT / 'user-runtimes'))
RUNTIME_IMAGE = os.environ.get('HMC_USER_RUNTIME_IMAGE', 'python:3.11-slim')
RUNTIME_HERMES_SOURCE = Path(os.environ.get('HMC_USER_RUNTIME_HERMES_SOURCE', '/root/hermes-agent'))
RUNTIME_UV_PYTHON_HOME = Path(os.environ.get('HMC_USER_RUNTIME_UV_PYTHON_HOME', '/root/.local/share/uv'))
RUNTIME_AUTO_START = os.environ.get('HMC_USER_RUNTIME_AUTO_START', '1').strip().lower() not in ('0', 'false', 'no', 'off')
RUNTIME_CONTAINER_HOME = '/opt/data'
BASIC_USER = os.environ.get('HMC_USER', 'admin')
DEMO_USER = os.environ.get('HMC_DEMO_USER', 'demo')
DEMO_PASSWORD = os.environ.get('HMC_DEMO_PASSWORD', 'demo12345678')
BASIC_PASSWORD_FILE = Path(os.environ.get('HMC_PASSWORD_FILE', '/opt/hermes-mission-control/.basic-password'))
AUTH_BOOTSTRAP_LOCK = threading.Lock()
AUTH_BOOTSTRAP_MATERIAL = None
AUTH_SCHEMA_LOCK = threading.Lock()
AUTH_SCHEMA_READY = False
SQLITE_BUSY_TIMEOUT_MS = int(os.environ.get('HMC_SQLITE_BUSY_TIMEOUT_MS', '5000'))
SESSION_COOKIE = 'hmc_session'
SESSION_TTL_SECONDS = 7 * 24 * 60 * 60

def configured_password():
    if not BASIC_PASSWORD_FILE.exists():
        return ''
    return BASIC_PASSWORD_FILE.read_text(errors='ignore').strip()


def session_secret():
    expected = configured_password()
    material = f'{expected}:{BASIC_PASSWORD_FILE}:{BASIC_USER}'.encode('utf-8')
    return hashlib.sha256(material).digest()


def sign_session(user, issued_at):
    payload = f'{user}:{issued_at}'.encode('utf-8')
    return hmac.new(session_secret(), payload, hashlib.sha256).hexdigest()


def make_session_token(user):
    issued_at = str(int(time.time()))
    sig = sign_session(user, issued_at)
    raw = f'{user}:{issued_at}:{sig}'.encode('utf-8')
    return base64.urlsafe_b64encode(raw).decode('ascii')


def parse_cookies(header):
    cookies = {}
    for part in (header or '').split(';'):
        if '=' not in part:
            continue
        key, value = part.split('=', 1)
        cookies[key.strip()] = value.strip()
    return cookies


def valid_session_token(token):
    if not token:
        return False
    try:
        raw = base64.urlsafe_b64decode(token.encode('ascii')).decode('utf-8')
        user, issued_at, sig = raw.rsplit(':', 2)
        ts = int(issued_at)
    except Exception:
        return False
    if not user_identity_by_email(user):
        return False
    if time.time() - ts > SESSION_TTL_SECONDS:
        return False
    expected_sig = sign_session(user, issued_at)
    return user if hmac.compare_digest(sig, expected_sig) else False



def auth_db_connect():
    APP_DB.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(APP_DB, timeout=max(1, SQLITE_BUSY_TIMEOUT_MS / 1000))
    con.row_factory = sqlite3.Row
    con.execute(f'PRAGMA busy_timeout={SQLITE_BUSY_TIMEOUT_MS}')
    return con


def user_slug(value):
    raw = (value or 'user').strip().lower()
    raw = re.sub(r'[^a-z0-9]+', '-', raw).strip('-')
    return raw or 'user'


def hermes_profile_path(profile_name):
    """Return the trusted filesystem path for a managed Hermes profile.

    Mission Control never accepts profile paths from the browser.  The backend
    stores a safe profile_name and resolves the path under HERMES_HOME/profiles.
    """
    name = user_slug(profile_name)
    if name in ('', 'default'):
        # Keep Mission Control-created user profiles out of the default root so
        # one user's agent cannot accidentally share the platform/default state.
        name = 'mc-default-user'
    return HERMES_HOME / 'profiles' / name


def user_default_profile_name(user_row, workspace_row=None):
    workspace_name = ''
    if workspace_row:
        try:
            workspace_name = str(workspace_row['name'] or '')
        except Exception:
            workspace_name = ''
    raw = workspace_name.strip()
    if raw.lower().endswith(' workspace'):
        raw = raw[:-10].strip()
    if not raw:
        try:
            raw = user_row['name'] or user_row['email'] or user_row['id']
        except Exception:
            raw = 'user'
    return f'mc-{user_slug(raw)}'


def public_hermes_profile(row):
    if not row:
        return None
    profile_name = row['profile_name']
    return {
        'id': row['id'],
        'owner_user_id': row['owner_user_id'],
        'profile_name': profile_name,
        'display_name': row['display_name'],
        'status': row['status'] or 'active',
        'profile_path': str(hermes_profile_path(profile_name)),
        'created_at': row['created_at'],
        'updated_at': row['updated_at'],
    }


def runtime_slug(value):
    return user_slug(value).replace('_', '-').strip('-') or 'user'


def runtime_host_home(user_id):
    return RUNTIME_ROOT / runtime_slug(user_id) / 'hermes-home'


def runtime_container_name(user_id):
    return f'hmc-user-{runtime_slug(user_id)}'


def docker_available():
    return bool(shutil.which('docker'))


def docker_image_exists(image):
    if not docker_available():
        return False
    try:
        subprocess.run(['docker', 'image', 'inspect', image], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10, check=True)
        return True
    except Exception:
        return False


def docker_container_state(container_name):
    if not docker_available():
        return None
    try:
        proc = subprocess.run(['docker', 'inspect', '-f', '{{.State.Status}}', container_name], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, timeout=10, check=True)
        return proc.stdout.strip() or None
    except Exception:
        return None


def copy_profile_into_runtime(profile_name, host_home):
    """Seed a per-user runtime home from the existing managed profile once."""
    source = hermes_profile_path(profile_name)
    target = host_home / 'profiles' / user_slug(profile_name)
    marker = target / '.hmc-runtime-seeded'
    if marker.exists() or not source.exists():
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(source, target, dirs_exist_ok=True)
    marker.write_text(str(int(time.time())) + '\n')


def public_user_runtime(row):
    if not row:
        return None
    return {
        'id': row['id'],
        'user_id': row['user_id'],
        'profile_id': row['profile_id'],
        'kind': row['kind'],
        'status': row['status'],
        'container_name': row['container_name'],
        'image': row['image'],
        'host_home': row['host_home'],
        'container_home': row['container_home'],
        'last_error': row['last_error'] or '',
        'created_at': row['created_at'],
        'updated_at': row['updated_at'],
    }


def user_status_metadata(row):
    if not row:
        return {}
    keys = set(row.keys()) if hasattr(row, 'keys') else set()
    return {
        'status_updated_at': row['status_updated_at'] if 'status_updated_at' in keys else None,
        'disabled_at': row['disabled_at'] if 'disabled_at' in keys else None,
        'disabled_by': row['disabled_by'] if 'disabled_by' in keys else None,
        'disabled_reason': row['disabled_reason'] if 'disabled_reason' in keys else None,
    }


def ensure_user_runtime(con, user_row, profile_row, provision=None):
    """Ensure each Mission Control account has a Docker-backed Hermes runtime record.

    The runtime is one container per user, with that user's Hermes home mounted
    at /opt/data. The user's server-managed Hermes profile is seeded into that
    home under profiles/<profile_name>, so the browser still never supplies a
    path and every account has a distinct filesystem/process boundary.
    """
    if not user_row or not profile_row:
        return None
    user_id = user_row['id']
    if (user_row['status'] or 'active') != 'active':
        row = con.execute('SELECT * FROM user_runtimes WHERE user_id=? AND kind=? ORDER BY created_at LIMIT 1', (user_id, 'docker')).fetchone()
        if row:
            now = int(time.time())
            con.execute('UPDATE user_runtimes SET status=?, last_error=?, updated_at=? WHERE id=?', ('disabled', 'User account is disabled; runtime is held until the account is re-enabled.', now, row['id']))
            row = con.execute('SELECT * FROM user_runtimes WHERE id=?', (row['id'],)).fetchone()
        return row
    profile_id = profile_row['id']
    now = int(time.time())
    host_home = runtime_host_home(user_id)
    container_name = runtime_container_name(user_id)
    host_home.mkdir(parents=True, exist_ok=True)
    (host_home / 'profiles').mkdir(parents=True, exist_ok=True)
    try:
        copy_profile_into_runtime(profile_row['profile_name'], host_home)
    except Exception:
        pass
    row = con.execute('SELECT * FROM user_runtimes WHERE user_id=? AND kind=? ORDER BY created_at LIMIT 1', (user_id, 'docker')).fetchone()
    if not row:
        runtime_id = f'rt_{runtime_slug(user_id).replace("-", "_")}'
        while con.execute('SELECT id FROM user_runtimes WHERE id=?', (runtime_id,)).fetchone():
            runtime_id = f'rt_{secrets.token_hex(6)}'
        con.execute(
            'INSERT INTO user_runtimes (id,user_id,profile_id,kind,status,container_name,image,host_home,container_home,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
            (runtime_id, user_id, profile_id, 'docker', 'pending', container_name, RUNTIME_IMAGE, str(host_home), RUNTIME_CONTAINER_HOME, now, now),
        )
        row = con.execute('SELECT * FROM user_runtimes WHERE id=?', (runtime_id,)).fetchone()
    elif row['profile_id'] != profile_id or row['container_name'] != container_name or row['host_home'] != str(host_home) or row['image'] != RUNTIME_IMAGE:
        con.execute(
            'UPDATE user_runtimes SET profile_id=?, container_name=?, image=?, host_home=?, container_home=?, updated_at=? WHERE id=?',
            (profile_id, container_name, RUNTIME_IMAGE, str(host_home), RUNTIME_CONTAINER_HOME, now, row['id']),
        )
        row = con.execute('SELECT * FROM user_runtimes WHERE id=?', (row['id'],)).fetchone()
    should_start = RUNTIME_AUTO_START if provision is None else bool(provision)
    if should_start:
        provision_user_runtime(con, row)
        row = con.execute('SELECT * FROM user_runtimes WHERE id=?', (row['id'],)).fetchone()
    return row


def provision_user_runtime(con, runtime_row):
    if not runtime_row:
        return None
    now = int(time.time())
    name = runtime_row['container_name']
    image = runtime_row['image'] or RUNTIME_IMAGE
    host_home = Path(runtime_row['host_home'])
    if not docker_available():
        con.execute('UPDATE user_runtimes SET status=?, last_error=?, updated_at=? WHERE id=?', ('docker_unavailable', 'docker CLI is not installed or not on PATH', now, runtime_row['id']))
        return None
    if not docker_image_exists(image):
        con.execute('UPDATE user_runtimes SET status=?, last_error=?, updated_at=? WHERE id=?', ('image_missing', f'Docker image {image} is not available; build or pull it before starting the runtime', now, runtime_row['id']))
        return None
    state = docker_container_state(name)
    try:
        if state == 'running':
            con.execute('UPDATE user_runtimes SET status=?, last_error=?, updated_at=? WHERE id=?', ('running', '', now, runtime_row['id']))
        elif state:
            subprocess.run(['docker', 'start', name], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True, timeout=30, check=True)
            con.execute('UPDATE user_runtimes SET status=?, last_error=?, updated_at=? WHERE id=?', ('running', '', now, runtime_row['id']))
        else:
            host_home.mkdir(parents=True, exist_ok=True)
            cmd = [
                'docker', 'run', '-d', '--name', name, '--restart', 'unless-stopped',
                '-v', f'{host_home}:{RUNTIME_CONTAINER_HOME}',
                '-e', 'HERMES_HOME=/opt/data',
            ]
            if RUNTIME_HERMES_SOURCE.exists():
                cmd += [
                    '-v', f'{RUNTIME_HERMES_SOURCE}:{RUNTIME_HERMES_SOURCE}:ro',
                    '-e', f'PATH={RUNTIME_HERMES_SOURCE}/venv/bin:{RUNTIME_HERMES_SOURCE}/.venv/bin:/usr/local/bin:/usr/bin:/bin',
                    '-e', f'PYTHONPATH={RUNTIME_HERMES_SOURCE}',
                ]
            if RUNTIME_UV_PYTHON_HOME.exists():
                cmd += ['-v', f'{RUNTIME_UV_PYTHON_HOME}:{RUNTIME_UV_PYTHON_HOME}:ro']
            cmd += [image, 'sleep', 'infinity']
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True, timeout=60, check=True)
            con.execute('UPDATE user_runtimes SET status=?, last_error=?, updated_at=? WHERE id=?', ('running', '', now, runtime_row['id']))
    except subprocess.CalledProcessError as exc:
        err = (exc.stderr or str(exc))[:500]
        con.execute('UPDATE user_runtimes SET status=?, last_error=?, updated_at=? WHERE id=?', ('error', err, now, runtime_row['id']))
    except Exception as exc:
        con.execute('UPDATE user_runtimes SET status=?, last_error=?, updated_at=? WHERE id=?', ('error', str(exc)[:500], now, runtime_row['id']))


def ensure_user_hermes_profile(con, user_row, workspace_row=None):
    """Ensure each Mission Control user owns exactly one active Hermes profile.

    This is the isolation primitive for runtime agent state.  Access is enforced
    by joining the authenticated user to hermes_profiles/user_profile_access; the
    frontend never supplies profile paths.
    """
    if not user_row:
        return None
    user_id = user_row['id']
    row = con.execute(
        "SELECT * FROM hermes_profiles WHERE owner_user_id=? AND status='active' ORDER BY created_at LIMIT 1",
        (user_id,),
    ).fetchone()
    if not row:
        now = int(time.time())
        base_name = user_default_profile_name(user_row, workspace_row)
        profile_name = base_name
        n = 2
        while con.execute('SELECT id FROM hermes_profiles WHERE profile_name=?', (profile_name,)).fetchone():
            profile_name = f'{base_name}-{n}'
            n += 1
        profile_id = f'prof_{user_slug(user_id).replace("-", "_")}'
        while con.execute('SELECT id FROM hermes_profiles WHERE id=?', (profile_id,)).fetchone():
            profile_id = f'prof_{secrets.token_hex(6)}'
        display_name = f"{user_row['name'] or user_row['email']} Agent Profile"
        con.execute(
            'INSERT INTO hermes_profiles (id,owner_user_id,profile_name,display_name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
            (profile_id, user_id, profile_name, display_name, 'active', now, now),
        )
        con.execute(
            'INSERT OR IGNORE INTO user_profile_access (user_id,profile_id,role,created_at) VALUES (?,?,?,?)',
            (user_id, profile_id, 'owner', now),
        )
        row = con.execute('SELECT * FROM hermes_profiles WHERE id=?', (profile_id,)).fetchone()
    else:
        con.execute(
            'INSERT OR IGNORE INTO user_profile_access (user_id,profile_id,role,created_at) VALUES (?,?,?,?)',
            (user_id, row['id'], 'owner', int(time.time())),
        )
    try:
        root = hermes_profile_path(row['profile_name'])
        root.mkdir(parents=True, exist_ok=True)
        for child in ('sessions', 'logs', 'cron', 'skills'):
            (root / child).mkdir(parents=True, exist_ok=True)
    except Exception:
        pass
    return row


def require_user_profile_access(con, identity, profile_id=None, profile_name=None):
    if not identity:
        return None
    current_user = (identity.get('user') or {})
    if current_user.get('role') == 'admin' and (profile_id or profile_name):
        row = con.execute(
            "SELECT * FROM hermes_profiles WHERE (id=? OR profile_name=?) AND status='active'",
            (profile_id or '', profile_name or ''),
        ).fetchone()
        return row
    user_id = current_user.get('id')
    if not user_id:
        return None
    if profile_id or profile_name:
        return con.execute(
            """SELECT p.* FROM hermes_profiles p
                 LEFT JOIN user_profile_access a ON a.profile_id=p.id AND a.user_id=?
                 WHERE (p.id=? OR p.profile_name=?)
                   AND p.status='active'
                   AND (p.owner_user_id=? OR a.user_id IS NOT NULL)""",
            (user_id, profile_id or '', profile_name or '', user_id),
        ).fetchone()
    return con.execute(
        "SELECT * FROM hermes_profiles WHERE owner_user_id=? AND status='active' ORDER BY created_at LIMIT 1",
        (user_id,),
    ).fetchone()


def password_hash(password, salt=None, iterations=210000):
    salt = salt or secrets.token_hex(16)
    derived = hashlib.pbkdf2_hmac('sha256', str(password).encode('utf-8'), salt.encode('utf-8'), iterations)
    return f'pbkdf2_sha256${iterations}${salt}${derived.hex()}'


def verify_password(password, stored_hash):
    if not stored_hash:
        return False
    try:
        scheme, iterations, salt, expected = stored_hash.split('$', 3)
        if scheme != 'pbkdf2_sha256':
            return False
        candidate = password_hash(password, salt=salt, iterations=int(iterations)).split('$', 3)[3]
        return hmac.compare_digest(candidate, expected)
    except Exception:
        return False


def ensure_auth_tables():
    global AUTH_SCHEMA_READY
    if AUTH_SCHEMA_READY:
        return auth_db_connect()
    with AUTH_SCHEMA_LOCK:
        if AUTH_SCHEMA_READY:
            return auth_db_connect()
        con = auth_db_connect()
        try:
            con.execute('PRAGMA journal_mode=WAL')
        except sqlite3.DatabaseError:
            pass
        con.executescript("""
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
    CREATE TABLE IF NOT EXISTS hermes_profiles (
        id TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL,
        profile_name TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_profile_access (
        user_id TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'owner',
        created_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, profile_id)
    );
    CREATE TABLE IF NOT EXISTS user_runtimes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'docker',
        status TEXT NOT NULL DEFAULT 'pending',
        container_name TEXT NOT NULL UNIQUE,
        image TEXT NOT NULL,
        host_home TEXT NOT NULL,
        container_home TEXT NOT NULL DEFAULT '/opt/data',
        last_error TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE (user_id, kind)
    );
    CREATE TABLE IF NOT EXISTS projects (id TEXT NOT NULL, workspace_id TEXT NOT NULL, owner_user_id TEXT NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', description TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (workspace_id, id));
    CREATE TABLE IF NOT EXISTS workspace_tasks (id TEXT NOT NULL, workspace_id TEXT NOT NULL, project_id TEXT, title TEXT NOT NULL, body TEXT, status TEXT NOT NULL DEFAULT 'queued', assignee TEXT, created_by TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (workspace_id, id));
    CREATE TABLE IF NOT EXISTS workspace_inbox (id TEXT NOT NULL, workspace_id TEXT NOT NULL, title TEXT NOT NULL, body TEXT, status TEXT NOT NULL DEFAULT 'drafted', risk TEXT NOT NULL DEFAULT 'medium', agent_id TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (workspace_id, id));
    CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, user_id TEXT, actor_type TEXT NOT NULL DEFAULT 'user', actor_id TEXT, action TEXT NOT NULL, resource_type TEXT, resource_id TEXT, evidence TEXT, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS agent_directory (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, category TEXT, capabilities TEXT, shared_agent_ref TEXT, status TEXT NOT NULL DEFAULT 'active', admin_managed_only INTEGER NOT NULL DEFAULT 1, agent_class TEXT NOT NULL DEFAULT 'workspace', scope TEXT NOT NULL DEFAULT 'workspace', visibility TEXT NOT NULL DEFAULT 'workspace-assigned', owner_type TEXT NOT NULL DEFAULT 'workspace', policy_metadata TEXT, owner_user_id TEXT, owner_workspace_id TEXT);
    CREATE TABLE IF NOT EXISTS user_agent_preferences (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, workspace_id TEXT NOT NULL, agent_id TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, display_order INTEGER NOT NULL DEFAULT 100, nickname TEXT, created_at INTEGER NOT NULL, UNIQUE (user_id, workspace_id, agent_id));
    CREATE TABLE IF NOT EXISTS role_agent_assignments (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL DEFAULT '*', role TEXT NOT NULL, agent_id TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, display_order INTEGER NOT NULL DEFAULT 100, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE (workspace_id, role, agent_id));
    CREATE TABLE IF NOT EXISTS agent_assignments (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, project_id TEXT NOT NULL, agent_id TEXT NOT NULL, created_by TEXT, created_at INTEGER NOT NULL, UNIQUE (workspace_id, project_id, agent_id));
    """)
    user_cols = {row['name'] for row in con.execute("PRAGMA table_info(users)").fetchall()}
    for column_name, ddl in {
        'status_updated_at': "ALTER TABLE users ADD COLUMN status_updated_at INTEGER",
        'disabled_at': "ALTER TABLE users ADD COLUMN disabled_at INTEGER",
        'disabled_by': "ALTER TABLE users ADD COLUMN disabled_by TEXT",
        'disabled_reason': "ALTER TABLE users ADD COLUMN disabled_reason TEXT",
    }.items():
        if column_name not in user_cols:
            con.execute(ddl)
    existing_cols = {row['name'] for row in con.execute("PRAGMA table_info(agent_directory)").fetchall()}
    for column_name, ddl in {
        'agent_class': "ALTER TABLE agent_directory ADD COLUMN agent_class TEXT NOT NULL DEFAULT 'workspace'",
        'scope': "ALTER TABLE agent_directory ADD COLUMN scope TEXT NOT NULL DEFAULT 'workspace'",
        'visibility': "ALTER TABLE agent_directory ADD COLUMN visibility TEXT NOT NULL DEFAULT 'workspace-assigned'",
        'owner_type': "ALTER TABLE agent_directory ADD COLUMN owner_type TEXT NOT NULL DEFAULT 'workspace'",
        'policy_metadata': "ALTER TABLE agent_directory ADD COLUMN policy_metadata TEXT",
        'owner_user_id': "ALTER TABLE agent_directory ADD COLUMN owner_user_id TEXT",
        'owner_workspace_id': "ALTER TABLE agent_directory ADD COLUMN owner_workspace_id TEXT",
    }.items():
        if column_name not in existing_cols:
            con.execute(ddl)
    con.commit()
    AUTH_SCHEMA_READY = True
    return con


def upsert_local_user(email, password, role='user', name=None, workspace_name=None):
    slug = user_slug(email)
    user_id = f'user_{slug.replace("-", "_")}'
    workspace_id = f'ws_{slug.replace("-", "_")}'
    now = int(time.time())
    con = ensure_auth_tables()
    existing = con.execute('SELECT * FROM users WHERE email=?', (email,)).fetchone()
    phash = password_hash(password)
    if existing:
        if password and not verify_password(password, existing['password_hash']):
            con.execute('UPDATE users SET password_hash=?, role=?, status=? WHERE id=?', (phash, role, 'active', existing['id']))
        else:
            con.execute('UPDATE users SET role=?, status=? WHERE id=?', (role, 'active', existing['id']))
        user_id = existing['id']
    else:
        con.execute(
            'INSERT INTO users (id,email,name,password_hash,role,status,created_at) VALUES (?,?,?,?,?,?,?)',
            (user_id, email, name or email, phash, role, 'active', now),
        )
    ws = con.execute('SELECT * FROM workspaces WHERE owner_user_id=? ORDER BY created_at LIMIT 1', (user_id,)).fetchone()
    if not ws:
        con.execute(
            'INSERT INTO workspaces (id,owner_user_id,name,slug,created_at) VALUES (?,?,?,?,?)',
            (workspace_id, user_id, workspace_name or f'{name or email} Workspace', slug, now),
        )
        ws = con.execute('SELECT * FROM workspaces WHERE owner_user_id=? ORDER BY created_at LIMIT 1', (user_id,)).fetchone()
    user_row = con.execute('SELECT * FROM users WHERE id=?', (user_id,)).fetchone()
    ensure_user_hermes_profile(con, user_row, ws)
    con.commit()
    con.close()


def bootstrap_auth_seed_users():
    global AUTH_BOOTSTRAP_MATERIAL
    expected = configured_password()
    material = (BASIC_USER, hashlib.sha256(expected.encode('utf-8')).hexdigest() if expected else '', DEMO_USER, hashlib.sha256(str(DEMO_PASSWORD).encode('utf-8')).hexdigest() if DEMO_PASSWORD else '')
    if AUTH_BOOTSTRAP_MATERIAL == material:
        return
    with AUTH_BOOTSTRAP_LOCK:
        if AUTH_BOOTSTRAP_MATERIAL == material:
            return
        if expected:
            upsert_local_user(BASIC_USER, expected, role='admin', name=BASIC_USER, workspace_name=f'{BASIC_USER} Workspace')
        if DEMO_USER and DEMO_PASSWORD:
            upsert_local_user(DEMO_USER, DEMO_PASSWORD, role='viewer', name=DEMO_USER, workspace_name=f'{DEMO_USER} Workspace')
        AUTH_BOOTSTRAP_MATERIAL = material


def row_identity(user_row, workspace_row=None):
    user = dict(user_row)
    workspace = dict(workspace_row) if workspace_row else None
    profile_row = None
    runtime_row = None
    try:
        con = auth_db_connect()
        profile_row = ensure_user_hermes_profile(con, user_row, workspace_row)
        runtime_row = ensure_user_runtime(con, user_row, profile_row)
        con.commit()
        con.close()
    except Exception:
        profile_row = None
        runtime_row = None
    public_user = {
        'id': user.get('id'),
        'email': user.get('email'),
        'name': user.get('name') or user.get('email'),
        'role': user.get('role') or 'user',
        'status': user.get('status') or 'active',
    }
    public_workspace = None
    if workspace:
        public_workspace = {'id': workspace.get('id'), 'name': workspace.get('name'), 'slug': workspace.get('slug')}
    # Keep workspace available both at the top-level identity and nested under
    # user for callers that treat public user records as self-contained rows.
    public_user['workspace'] = public_workspace
    return {

        **user,
        'workspace_id': workspace.get('id') if workspace else None,
        'workspace': public_workspace,
        'hermes_profile': public_hermes_profile(profile_row),
        'runtime': public_user_runtime(runtime_row),
        'user': public_user,
    }


def user_identity_by_email(email):
    bootstrap_auth_seed_users()
    con = ensure_auth_tables()
    row = con.execute('SELECT * FROM users WHERE email=? AND status=?', (email, 'active')).fetchone()
    if not row:
        con.close()
        return None
    workspace = con.execute('SELECT * FROM workspaces WHERE owner_user_id=? ORDER BY created_at LIMIT 1', (row['id'],)).fetchone()
    identity = row_identity(row, workspace)
    con.close()
    return identity


def authenticate_user(username, password):
    bootstrap_auth_seed_users()
    con = ensure_auth_tables()
    row = con.execute('SELECT * FROM users WHERE email=? AND status=?', (str(username), 'active')).fetchone()
    if not row or not verify_password(str(password), row['password_hash']):
        con.close()
        return None
    con.execute('UPDATE users SET last_login_at=? WHERE id=?', (int(time.time()), row['id']))
    workspace = con.execute('SELECT * FROM workspaces WHERE owner_user_id=? ORDER BY created_at LIMIT 1', (row['id'],)).fetchone()
    con.commit()
    identity = row_identity(row, workspace)
    con.close()
    return identity


def resolve_session_token(token):
    email = valid_session_token(token)
    if not email:
        return {'ok': False}
    identity = user_identity_by_email(email)
    if not identity:
        return {'ok': False}
    return {'ok': True, 'user': identity['user'], 'workspace': identity['workspace'], 'hermes_profile': identity.get('hermes_profile'), 'runtime': identity.get('runtime')}


def current_identity_from_cookie(cookie_header):
    cookies = parse_cookies(cookie_header or '')
    resolved = resolve_session_token(cookies.get(SESSION_COOKIE))
    return resolved if resolved.get('ok') else None


def me_payload_from_cookie(cookie_header):
    identity = current_identity_from_cookie(cookie_header)
    if not identity:
        return {'ok': False, 'error': 'Authentication required'}, 401
    return identity, 200


def is_admin_identity(identity):
    return bool(identity and (identity.get('user') or {}).get('role') == 'admin')


def agent_directory_permissions(identity):
    admin = is_admin_identity(identity)
    return {
        'can_select': admin,
        'can_assign_to_own_projects': bool(identity),
        'can_assign_to_users': admin,
        'can_edit_global_definition': admin,
        'can_manage_runtime': admin,
    }


def global_mutation_permission(identity, method='POST', path=''):
    method = (method or 'GET').upper()
    path = path or ''
    # Workspace-level preference/assignment mutations are intentionally allowed
    # for normal users. They only touch user_agent_preferences or agent_assignments
    # scoped to the user's own workspace; they never edit the shared agent template.
    workspace_allowed = (
        (method in ('POST', 'DELETE') and path.startswith('/api/user/agents/') and path.endswith('/select')) or
        (method == 'POST' and (path == '/api/user/personal-agents' or (path.startswith('/api/user/personal-agents/') and (path.endswith('/action') or path.endswith('/request-company-access'))))) or
        (method == 'POST' and path.startswith('/api/projects/') and '/agents/' in path and path.endswith('/assign')) or
        (method == 'POST' and path.startswith('/api/agents/') and (path.endswith('/messages') or path.endswith('/attachments')))
    )
    if workspace_allowed:
        return {'ok': True}, 200
    protected = (
        path.startswith('/api/admin/') or
        path == '/api/runtime-connect/tokens' or
        (path.startswith('/api/runtime-connect/tokens/') and path.endswith('/revoke')) or
        path == '/api/windows-gateway/config' or
        path == '/api/browser-sessions/events' or
        (path.startswith('/api/browser-sessions/') and (path.endswith('/stop') or path.endswith('/takeover'))) or
        (path.startswith('/api/agent-org/agents/') and ('/goals' in path or path.endswith('/action'))) or
        path == '/api/model-router' or
        (path.startswith('/api/agents/') and path.endswith('/attachments'))
    )
    if protected and not is_admin_identity(identity):
        return {'ok': False, 'error': 'Admin permission required for global Mission Control mutations.'}, 403
    return {'ok': True}, 200
