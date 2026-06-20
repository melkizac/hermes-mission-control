from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
NAV = ROOT / "src/components/NavRail.tsx"


def test_workforce_has_org_chart_and_capabilities_submenu():
    nav = NAV.read_text()

    assert '{ key: "agent-org", label: "Org Chart", icon: "agentOrg" }' in nav
    assert '{ key: "agent-org", label: "Capabilities", icon: "agentOrg" }' not in nav
    assert 'const workforceSelectorKeys: ViewKey[] = ["skills", "tools", "plugins", "memory", "reflections"];' in nav
    assert '<span className="nav-text">Capabilities</span>' in nav
    assert 'role="menu" aria-label="Capabilities"' in nav


def test_capabilities_submenu_items_are_ordered_as_requested():
    nav = NAV.read_text()
    workforce_block = nav.split('label: "Workforce"', 1)[1].split('label: "System"', 1)[0]
    expected_order = [
        'label: "Agents"',
        'label: "Org Chart"',
        'label: "Skills"',
        'label: "Tools"',
        'label: "Plugins"',
        'label: "Memory"',
        'label: "Reflections"',
        'label: "Approvals"',
    ]
    positions = [workforce_block.index(label) for label in expected_order]
    assert positions == sorted(positions)


def test_capabilities_submenu_stays_expanded_when_child_route_is_active():
    nav = NAV.read_text()

    assert 'const workforceMenuExpanded = !collapsed && (workforceMenuOpen || workforceSelectorActive);' in nav
    assert 'aria-expanded={workforceMenuExpanded}' in nav
    assert 'workforceMenuExpanded && (' in nav
    assert 'className={"nav-right-icon workforce-chevron" + (workforceMenuExpanded ? " open" : "")}' in nav
    assert 'setWorkforceMenuOpen(false);' not in nav[nav.index('role="menu" aria-label="Capabilities"'):nav.index('const active = isRouteItem(it) && view === it.key;', nav.index('role="menu" aria-label="Capabilities"'))]
