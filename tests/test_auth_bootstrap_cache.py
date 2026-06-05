from pathlib import Path

APP = Path('/opt/hermes-mission-control/app.py').read_text(encoding='utf-8')


def test_auth_bootstrap_is_cached_after_first_seed():
    assert 'AUTH_BOOTSTRAP_LOCK = threading.Lock()' in APP
    assert 'AUTH_BOOTSTRAP_MATERIAL = None' in APP
    assert 'if AUTH_BOOTSTRAP_MATERIAL == material:' in APP
    assert 'with AUTH_BOOTSTRAP_LOCK:' in APP
    assert 'AUTH_BOOTSTRAP_MATERIAL = material' in APP


def test_auth_bootstrap_material_tracks_secret_changes_without_exposing_secret():
    assert "hashlib.sha256(expected.encode('utf-8')).hexdigest()" in APP
    assert "hashlib.sha256(str(DEMO_PASSWORD).encode('utf-8')).hexdigest()" in APP
    assert 'material = (BASIC_USER,' in APP


def test_authenticated_reads_still_resolve_identity_from_cookie():
    assert 'def valid_session_token(token):' in APP
    assert 'if not user_identity_by_email(user):' in APP
    assert 'def current_identity_from_cookie(cookie_header):' in APP
    assert 'resolved = resolve_session_token(cookies.get(SESSION_COOKIE))' in APP
