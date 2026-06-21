from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
APP = (ROOT / "backend/app.py").read_text(encoding="utf-8")


def test_agent_org_profile_runtime_exposes_identity_docs():
    match = re.search(r"def _profile_identity_docs\(profile_id\):(.*?)\n\ndef _profile_gateway_channels", APP, re.S)
    assert match, "_profile_identity_docs should be defined before profile gateway helpers"
    helper = match.group(1)
    assert "'identity_docs': _profile_identity_docs(resolved)" in APP
    assert "root / 'IDENTITY.md'" in APP
    assert "root / 'identity.md'" in APP
    assert "name.lower() not in ('soul.md', 'identity.md', 'user.md', 'agents.md', 'claude.md')" in helper
    assert "'preview': preview" in helper
    assert "'content': content" in helper
    assert "'size_bytes': file.get('sizeBytes') or 0" in helper


def test_agent_org_identity_role_markdown_files_are_editable_and_downloadable():
    src = (ROOT / "src/views/AgentOrg.tsx").read_text(encoding="utf-8")
    css = (ROOT / "src/styles/app.css").read_text(encoding="utf-8")
    assert "downloadMarkdownDoc" in src
    assert "FileEditorDrawer" in src
    assert "identityDocToConfigFile" in src
    assert "aria-label={`Edit ${doc.name}`}" in src
    assert "aria-label={`Download ${doc.name}`}" in src
    assert ".filerow .acts span, .filerow .acts button" in css
    assert "'CLAUDE.md'" in APP
    assert "'USER.md'" in APP
