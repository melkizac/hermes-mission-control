from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = (ROOT / "backend/app.py").read_text(encoding="utf-8")
AGENT_ORG = (ROOT / "src/views/AgentOrg.tsx").read_text(encoding="utf-8")


def test_agent_org_avatar_save_has_persistent_backend_endpoint():
    assert "MAX_AGENT_AVATAR_BYTES" in APP
    assert "def save_agent_org_avatar(agent_id, payload):" in APP
    assert "avatar_channel = f'agent-avatar-{aid}'" in APP
    assert "agent['avatar_url'] = avatar_url" in APP
    assert "save_agent_registry(registry)" in APP
    assert "parsed.path.startswith('/api/agent-org/agents/') and parsed.path.endswith('/avatar')" in APP


def test_agent_org_avatar_save_rejects_non_image_profile_picture_files():
    assert "'.png': 'image/png'" in APP
    assert "'.jpg': 'image/jpeg'" in APP
    assert "'.jpeg': 'image/jpeg'" in APP
    assert "'.webp': 'image/webp'" in APP
    assert "'.gif': 'image/gif'" in APP
    assert "Profile pictures must be .png, .jpg, .jpeg, .webp, or .gif images." in APP
    assert "Profile picture upload must be an image." in APP
    assert "profile picture size must be numeric" in APP


def test_agent_org_avatar_save_is_admin_protected_global_mutation():
    auth = (ROOT / "backend/auth.py").read_text(encoding="utf-8")
    assert "path.endswith('/avatar')" in auth
    assert "Admin permission required for global Mission Control mutations." in auth


def test_agent_org_avatar_upload_uses_backend_save_not_browser_only_storage():
    assert "readFileAsDataUrl" in AGENT_ORG
    assert "api/agent-org/agents/${encodeURIComponent(agent.id)}/avatar" in AGENT_ORG
    assert "setData((current) => ({" in AGENT_ORG
    assert "detailCache.current.set(agent.id, { ...cachedDetail, avatar_url: avatarUrl })" in AGENT_ORG
    assert "window.localStorage" not in AGENT_ORG
