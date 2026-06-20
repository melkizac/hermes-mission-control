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


def test_agent_org_option_a_keeps_only_the_org_diagram_on_the_page():
    assert 'className="org-chart org-chart-option-a"' in AGENT_ORG
    assert 'aria-label="Agent organization chart"' in AGENT_ORG
    assert 'className="org-diagram"' in AGENT_ORG
    assert 'Who owns what' in AGENT_ORG
    assert '<DigitalCoworkerCapabilityPanel agents={agents} />' not in AGENT_ORG
    assert '<HandoffTimeline handoffs={allHandoffs} compact />' not in AGENT_ORG
    assert 'const allHandoffs =' not in AGENT_ORG


def test_agent_org_header_uses_tooltip_and_five_metrics_below_header():
    assert '<div className="org-title-row">' in AGENT_ORG
    assert 'className="org-title-help"' in AGENT_ORG
    assert 'role="tooltip"' in AGENT_ORG
    assert '<h1>Agent Org</h1>\n          <p>' not in AGENT_ORG
    assert '<h1>Agent Org</h1>\n          {data.registry_path' not in AGENT_ORG
    assert 'Registry: {data.registry_path}' not in AGENT_ORG
    assert 'Active Goals' not in AGENT_ORG
    assert AGENT_ORG.count('<Metric label=') == 5
    assert '.org-title-help span[role="tooltip"]' in CSS
    assert '.agent-org-page .org-metrics { order: 1;' in CSS
    assert '.agent-org-page .org-chart-option-a { order: 4;' in CSS


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
    assert 'justify-content: center;' in CSS
    assert 'width: 100%;' in CSS
    assert 'box-sizing: border-box;' in CSS
    assert 'padding-inline: 32px;' in CSS
    assert 'flex: 0 1 197px;' in CSS
    assert 'border-radius: 50%' in CSS
    assert '.org-node-grid .org-node::before' in CSS
    assert '.org-diagram > .org-node::after' in CSS
    assert 'min-height: max-content;' in CSS
    assert 'flex: 0 0 auto;' in CSS
    assert 'overflow: visible !important;' in CSS
