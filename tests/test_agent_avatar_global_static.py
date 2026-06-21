from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = (ROOT / "backend/app.py").read_text(encoding="utf-8")
TYPES = (ROOT / "src/types.ts").read_text(encoding="utf-8")
ROSTER = (ROOT / "src/components/Roster.tsx").read_text(encoding="utf-8")
CHAT = (ROOT / "src/components/ChatThread.tsx").read_text(encoding="utf-8")
CONTEXT = (ROOT / "src/components/ContextPanel.tsx").read_text(encoding="utf-8")
AVATAR = (ROOT / "src/components/AgentAvatar.tsx").read_text(encoding="utf-8")
AGENT_ORG = (ROOT / "src/views/AgentOrg.tsx").read_text(encoding="utf-8")
TOOLS = (ROOT / "src/views/ToolsHub.tsx").read_text(encoding="utf-8")
CSS = (ROOT / "src/styles/app.css").read_text(encoding="utf-8")


def test_backend_agent_payloads_expose_registry_avatar_url_for_all_agent_surfaces():
    assert "def agent_registry_avatar_url(profile_id):" in APP
    assert "def safe_agent_avatar_url(value):" in APP
    assert "re.fullmatch(r'/api/attachments/agent-avatar-" in APP
    assert "pid in (agent_id, agent_profile)" in APP
    assert "'avatarUrl': fields.get('avatarUrl')" in APP
    assert "avatarUrl?: string;" in TYPES


def test_shared_agent_avatar_component_is_used_by_agent_profile_surfaces():
    assert "export function AgentAvatar" in AVATAR
    assert "agent.avatarUrl" in AVATAR
    assert 'startsWith("/api/attachments/agent-avatar-")' in AVATAR
    assert "<img src={avatarUrl}" in AVATAR
    assert 'import { AgentAvatar } from "./AgentAvatar"' in ROSTER
    assert "<AgentAvatar agent={agent} />" in ROSTER
    assert 'import { AgentAvatar } from "./AgentAvatar"' in CHAT
    assert CHAT.count("<AgentAvatar agent={agent}") >= 3
    assert 'import { AgentAvatar } from "./AgentAvatar"' in CONTEXT
    assert 'className="agent-detail-avatar"' in CONTEXT
    assert 'className="ctx-mini-av"' in CONTEXT
    assert 'import { AgentAvatar } from "../components/AgentAvatar"' in TOOLS
    assert '<AgentAvatar agent={agent} className="fic" />' in TOOLS


def test_agent_org_shared_drawer_receives_avatar_url_and_css_handles_images():
    assert "avatarUrl: agent.avatar_url" in AGENT_ORG
    assert ".av.has-image img" in CSS
    assert ".ctx-mini-av.has-image img" in CSS
    assert ".agent-detail-avatar.has-image img" in CSS
    assert ".filerow .fic.has-image img" in CSS
