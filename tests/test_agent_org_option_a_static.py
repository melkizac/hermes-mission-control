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


def test_agent_org_header_uses_standard_workspace_header_tooltip_and_five_metrics():
    assert 'import { InfoTooltip }' in AGENT_ORG
    assert 'className="org-hero projects-hero professional"' in AGENT_ORG
    assert '<div className="hero-title-with-help">' in AGENT_ORG
    assert '<InfoTooltip label="About Agent Org">' in AGENT_ORG
    assert 'className="org-title-help"' not in AGENT_ORG
    assert '<h1>Agent Org</h1>\n          <p>' not in AGENT_ORG
    assert 'Active Goals' not in AGENT_ORG
    assert AGENT_ORG.count('<Metric label=') == 5
    assert '/* Agent Org page consistency with standard workspace pages */' in CSS
    assert '.agent-org-page .org-hero {' in CSS
    assert 'background: transparent;' in CSS
    assert 'box-shadow: none;' in CSS
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

def test_agent_detail_drawer_is_simplified_into_three_sections():
    assert 'return ["overview", "capabilities", "activity"];' in AGENT_ORG
    assert 'AgentOverviewPanel' in AGENT_ORG
    assert 'AgentCapabilitiesPanel' in AGENT_ORG
    assert 'AgentActivityPanel' in AGENT_ORG
    assert 'Chat with agent' in AGENT_ORG
    assert 'Primary responsibility' in AGENT_ORG
    assert 'Can help with' not in AGENT_ORG
    assert 'Profile & identity files' in AGENT_ORG
    assert 'identity_docs' in AGENT_ORG
    assert 'SOUL.md, identity.md, or USER.md' in AGENT_ORG
    assert 'Current work' in AGENT_ORG
    assert 'Run from Mission Control' not in AGENT_ORG
    assert 'Operational footprint' not in AGENT_ORG
    assert 'tab === "profile"' not in AGENT_ORG
    assert 'tab === "permissions"' not in AGENT_ORG
    assert '/* Simplified Agent Details drawer */' in CSS
    assert '.agent-capability-row' in CSS
