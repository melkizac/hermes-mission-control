from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AGENT_ORG = (ROOT / "src/views/AgentOrg.tsx").read_text(encoding="utf-8")
CSS = (ROOT / "src/styles/app.css").read_text(encoding="utf-8")


def test_agent_org_option_a_removes_redundant_top_level_tabs():
    assert 'className="org-tabs"' not in AGENT_ORG
    assert 'const tabs: Tab[]' not in AGENT_ORG
    assert 'useState<Tab>' not in AGENT_ORG
    assert '!loading && tab === "agents"' not in AGENT_ORG
    assert '!loading && tab === "queues"' not in AGENT_ORG
    assert '!loading && tab === "runs"' not in AGENT_ORG
    assert '!loading && tab === "permissions"' not in AGENT_ORG


def test_agent_org_option_a_keeps_single_org_diagram_with_routing_sections():
    assert 'className="org-chart org-chart-option-a"' in AGENT_ORG
    assert 'aria-label="Agent organization chart"' in AGENT_ORG
    assert 'className="org-diagram"' in AGENT_ORG
    assert 'Who owns what' in AGENT_ORG
    assert '<DigitalCoworkerCapabilityPanel agents={agents} />' in AGENT_ORG
    assert '<HandoffTimeline handoffs={allHandoffs} compact />' in AGENT_ORG


def test_agent_cards_support_hover_details_avatar_upload_and_drawer_click():
    assert 'className="org-node-hover-details"' in AGENT_ORG
    assert 'className="org-node-avatar-button"' in AGENT_ORG
    assert 'accept="image/*"' in AGENT_ORG
    assert 'window.localStorage.setItem("hmc-agent-org-avatars"' in AGENT_ORG
    assert 'role="button" tabIndex={0}' in AGENT_ORG
    assert 'onClick={() => setSelectedId(agent.id)}' in AGENT_ORG
    assert 'avatarUrl ? <img className={`agent-detail-avatar org-agent-avatar image ${agent.status}`}' in AGENT_ORG

    for selector in [
        '.org-chart-intro',
        '.org-diagram',
        '.org-node-avatar-button',
        '.org-node-hover-details',
        '.agent-detail-avatar.image',
    ]:
        assert selector in CSS
    assert 'grid-template-columns: 1fr auto 1fr' in CSS
    assert 'border-radius: 50%' in CSS
    assert '.org-node-grid .org-node::before' in CSS
    assert '.org-diagram > .org-node::after' in CSS
    assert '.agent-org-page .org-chart-option-a { order: 2;' in CSS
    assert '.agent-org-page .org-metrics { order: 3;' in CSS
    assert 'z-index: 60;' in CSS
    assert 'pointer-events:none' in CSS.replace(' ', '')
