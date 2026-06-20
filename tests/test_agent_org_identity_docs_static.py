from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = (ROOT / "backend/app.py").read_text(encoding="utf-8")


def test_agent_org_profile_runtime_exposes_identity_docs():
    assert "def _profile_identity_docs" in APP
    assert "'identity_docs': _profile_identity_docs(resolved)" in APP
    assert "root / 'IDENTITY.md'" in APP
    assert "root / 'identity.md'" in APP
    assert "name.lower() not in ('soul.md', 'identity.md', 'user.md', 'agents.md', 'claude.md')" in APP
    assert "'size_bytes': file.get('sizeBytes') or 0" in APP
