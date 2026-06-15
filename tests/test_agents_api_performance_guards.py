from pathlib import Path

APP = Path('/opt/hermes-mission-control/app.py').read_text(encoding='utf-8')
AGENT_ORG_VIEW = Path('/opt/hermes-mission-control/source/src/views/AgentOrg.tsx').read_text(encoding='utf-8')
ARTIFACTS_FN = APP[APP.index('def artifacts('):APP.index('\n\ndef tasks_from_cron', APP.index('def artifacts('))]
PROJECT_FROM_PATH_FN = APP[APP.index('def project_from_path('):APP.index('\n\ndef second_brain_project', APP.index('def project_from_path('))]


def test_artifacts_scan_is_bounded_and_skips_heavy_dirs():
    assert 'def artifacts(limit=20, max_files=600):' in ARTIFACTS_FN
    assert 'os.walk(root)' in ARTIFACTS_FN
    assert '.rglob' not in ARTIFACTS_FN
    assert 'scanned >= max_files' in ARTIFACTS_FN
    assert "'node_modules'" in ARTIFACTS_FN
    assert "'.git'" in ARTIFACTS_FN


def test_project_from_path_scan_is_bounded_and_skips_heavy_dirs():
    assert "def project_from_path(path, kind='workspace', source='filesystem', max_files=300):" in PROJECT_FROM_PATH_FN
    assert 'os.walk(path)' in PROJECT_FROM_PATH_FN
    assert '.rglob' not in PROJECT_FROM_PATH_FN
    assert 'scanned >= max_files' in PROJECT_FROM_PATH_FN
    assert "'node_modules'" in PROJECT_FROM_PATH_FN
    assert "'.git'" in PROJECT_FROM_PATH_FN


def test_list_agents_reuses_status_payload_and_avoids_duplicate_artifact_scan():
    assert "def agent_payload(profile_id='default', st=None, include_artifacts=True" in APP
    assert 'st = st or status_payload()' in APP
    assert 'def agent_list_status_payload():' in APP
    assert 'shared_status = agent_list_status_payload()' in APP
    assert "return [agent_summary_payload(profile_id, st=shared_status) for profile_id in agent_roster_profile_ids(include_default=True)]" in APP
    assert "agent_roster_profile_ids(include_default=True)" in APP
    assert "'messages': []," in APP
    assert "'artifacts': []," in APP
    assert "'skills': []," in APP
    assert "'tools': []," in APP
    assert "'files': []," in APP
    assert "'tasks': []," in APP
    assert "'detailLoaded': False," in APP
    assert "'artifacts': artifacts() if include_artifacts else []," in APP
    assert 'message_limit=None' in APP
    assert 'include_message_project_context=True' in APP
    assert 'real_chat_messages(source, profile_id=chat_id, limit=message_limit or 1000, include_project_context=include_message_project_context)' in APP


def test_agent_org_summary_defers_heavy_detail_fields():
    assert "def operational_agent_org(include_details=True, detail_agent_id=None):" in APP
    assert "if detail_mode:" in APP
    assert "'run_trees': []" in APP
    assert "'profile_details': None" in APP
    assert "agent_org_detail_payload" in APP
    assert "operational_agent_org(include_details=False)" in APP
    assert "queued_work_count = sum((a.get('queue') or {}).get('queued', 0) for a in agents)" in APP
    assert "approvals_needed_count = sum(a.get('inbox_count', len(a.get('inbox') or [])) or 0 for a in agents)" in APP


def test_agent_directory_seeding_is_startup_once_and_not_request_hot_path():
    assert 'AGENT_DIRECTORY_SEED_LOCK = threading.Lock()' in APP
    assert 'AGENT_DIRECTORY_SEEDED = False' in APP
    assert 'def seed_agent_directory(force=False):' in APP
    seed_fn = APP[APP.index('def seed_agent_directory'):APP.index('\n\ndef agent_directory_row', APP.index('def seed_agent_directory'))]
    assert 'if AGENT_DIRECTORY_SEEDED and not force:' in seed_fn
    assert 'with AGENT_DIRECTORY_SEED_LOCK:' in seed_fn
    assert 'complete = len(existing) == len(required)' in seed_fn
    assert 'con.close(); AGENT_DIRECTORY_SEEDED = True; return' in seed_fn
    assert 'def main():' in APP and 'seed_agent_directory()\n    reset_processing_state_file()' in APP


def test_agent_runtime_route_get_paths_are_read_mostly():
    assert 'def resolve_agent_runtime_route(identity, agent_id, provision_runtime=False):' in APP
    route_fn = APP[APP.index('def resolve_agent_runtime_route'):APP.index('\n\ndef runtime_route_headers', APP.index('def resolve_agent_runtime_route'))]
    assert 'ensure_workspace_runtime_profile(identity, provision=provision_runtime)' in route_fn
    assert 'def workspace_runtime_profile_snapshot(identity):' in APP
    assert 'write_text' not in APP[APP.index('def workspace_runtime_profile_snapshot'):APP.index('\n\ndef ensure_workspace_runtime_profile', APP.index('def workspace_runtime_profile_snapshot'))]
    list_agents_fn = APP[APP.index('def list_agents_payload'):APP.index('\n\ndef agent_activity_connect', APP.index('def list_agents_payload'))]
    assert 'resolve_agent_runtime_route(' not in list_agents_fn
    assert 'runtime_agent_channel_id' in list_agents_fn
    assert "message_limit=80" in APP[APP.index("elif parsed.path.startswith('/api/agents/'):"):APP.index("elif parsed.path == '/api/approvals':")]
    assert 'include_runtime_details=False' in APP[APP.index("elif parsed.path.startswith('/api/agents/'):"):APP.index("elif parsed.path == '/api/approvals':")]
    assert "include_artifacts=False" in APP[APP.index("elif parsed.path.startswith('/api/agents/'):"):APP.index("elif parsed.path == '/api/approvals':")]
    assert 'include_message_project_context=False' in APP[APP.index("elif parsed.path.startswith('/api/agents/'):"):APP.index("elif parsed.path == '/api/approvals':")]


def test_sqlite_connections_use_busy_timeout_and_wal_for_lock_resilience():
    auth = Path('/opt/hermes-mission-control/auth.py').read_text(encoding='utf-8')
    assert "SQLITE_BUSY_TIMEOUT_MS = int(os.environ.get('HMC_SQLITE_BUSY_TIMEOUT_MS', '5000'))" in auth
    assert "con.execute(f'PRAGMA busy_timeout={SQLITE_BUSY_TIMEOUT_MS}')" in auth
    assert "con.execute('PRAGMA journal_mode=WAL')" in auth
    assert 'AUTH_SCHEMA_LOCK = threading.Lock()' in auth
    assert 'if AUTH_SCHEMA_READY:' in auth
    assert "con.execute(f'PRAGMA busy_timeout={SQLITE_BUSY_TIMEOUT_MS}')" in APP
    assert "con.execute('PRAGMA journal_mode=WAL')" in APP


def test_agent_org_drawer_uses_cached_on_demand_details():
    assert 'cachedJsonRequest' in AGENT_ORG_VIEW
    assert 'const AGENT_ORG_SUMMARY_CACHE_KEY = "agent-org:summary"' in AGENT_ORG_VIEW
    assert 'function agentOrgDetailCacheKey(agentId: string)' in AGENT_ORG_VIEW
    assert 'const detailCache = useRef(new Map<string, OrgAgent>())' in AGENT_ORG_VIEW
    assert 'mergeSummaryWithCachedDetail(agent, detailCache.current.get(agent.id))' in AGENT_ORG_VIEW
    assert 'agentOrgDetailCacheKey(selectedId)' in AGENT_ORG_VIEW
    assert '/api/agent-org/agents/${encodeURIComponent(selectedId)}' in AGENT_ORG_VIEW
