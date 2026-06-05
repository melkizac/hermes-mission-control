from pathlib import Path

APP = Path('/opt/hermes-mission-control/app.py').read_text(encoding='utf-8')
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
    assert "agent_payload('default', st=shared_status, include_artifacts=False, message_limit=80)" in APP
    assert "agent_payload('devops', st=shared_status, include_artifacts=False, message_limit=80)" in APP
    assert "'artifacts': artifacts() if include_artifacts else []," in APP
    assert 'message_limit=None' in APP
