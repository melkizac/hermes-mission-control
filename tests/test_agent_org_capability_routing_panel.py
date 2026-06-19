from pathlib import Path

SRC = Path('/opt/hermes-mission-control/source/src')
AGENT_ORG = (SRC / 'views/AgentOrg.tsx').read_text(encoding='utf-8')
APP_CSS = (SRC / 'styles/app.css').read_text(encoding='utf-8')
NAV_RAIL = (SRC / 'components/NavRail.tsx').read_text(encoding='utf-8')


def test_digital_coworker_capability_panel_has_required_governance_fields():
    required_labels = [
        'Digital Coworker Capability & Routing Panel',
        'Role',
        'Owns',
        'Can do safely/default',
        'Needs approval for',
        'Evidence expected',
        'Escalation/review path',
        'Current load',
        'Why this owner',
    ]

    for label in required_labels:
        assert label in AGENT_ORG

    assert 'capability-routing-card' in AGENT_ORG
    assert 'routing-helper-copy' in AGENT_ORG
    assert 'approval-gated by default' in AGENT_ORG


def test_digital_coworker_panel_represents_canonical_coworkers():
    canonical_labels = [
        'Melkizac / default',
        'Andrej / dev-ops',
        'Enrico / content-ops',
        'LinkedIn Growth',
        'Second Brain',
        'Project & Task Coordinator',
        'Email Attention Ops',
        'Nexius Lead Agent',
    ]

    for label in canonical_labels:
        assert label in AGENT_ORG

    assert 'External posts, DMs, emails, publishing, destructive production changes, sensitive data movement, legal/business commitments, and high-impact changes remain approval-gated.' in AGENT_ORG
    assert 'Avoid treating agents as interchangeable: route by domain ownership, approval boundary, and expected evidence.' in AGENT_ORG


def test_capability_panel_is_visible_from_workforce_navigation_and_styled():
    assert '{ key: "agent-org", label: "Capabilities", icon: "agentOrg" }' in NAV_RAIL
    assert '.capability-routing-panel' in APP_CSS
    assert '.capability-routing-card' in APP_CSS
    assert '.routing-field-grid' in APP_CSS
