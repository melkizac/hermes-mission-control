from pathlib import Path

SRC = Path('/opt/hermes-mission-control/source/src')


def read(rel):
    return (SRC / rel).read_text(encoding='utf-8')


def test_step3_replaces_admin_placeholders_with_admin_setup_page():
    app = read('App.tsx')

    assert 'import { AdminSetupPage } from "./views/AdminSetupPage";' in app
    for kind in [
        'users-workspaces',
        'shared-agent-templates',
        'desktop-gateway',
        'approval-policy',
        'quota',
    ]:
        assert f'<AdminSetupPage kind="{kind}" />' in app

    assert 'title="Users & Workspaces" blurb=' not in app
    assert 'title="Shared Agent Templates" blurb=' not in app
    assert 'title="Desktop Gateway" blurb=' not in app
    assert 'title="Approval Policy" blurb=' not in app
    assert 'title="Quota" blurb=' not in app


def test_admin_setup_pages_have_real_cards_links_and_boundaries():
    page = read('views/AdminSetupPage.tsx')

    expected_titles = [
        'User Access',
        'Agent Platform Admin',
        'Shared Agent Templates',
        'Desktop Gateway',
        'Approval Policy',
        'Quota',
    ]
    for title in expected_titles:
        assert f'title: "{title}"' in page

    # Step 3 pages should guide admins to existing operational routes, not dead scaffolds.
    for route in ['settings', 'audit', 'costs', 'agent-org', 'skills', 'agents', 'runtimes', 'tools', 'approvals', 'board', 'automations']:
        assert f'target: "{route}"' in page

    assert 'SOUL.md' in page
    assert '/api/admin/agent-platform' in page
    assert '/api/admin/agent-templates' in page
    assert 'Template registry' in page
    assert 'Editing a template does not overwrite user-owned agent SOUL.md files.' in page
    assert 'Planned API: /api/admin/users' in page
    assert 'Planned API: /api/admin/approval-policy' in page
    assert 'Planned API: /api/admin/quota' in page
    assert 'No user deletion or role mutation controls are exposed' in page
    assert 'No live desktop action is triggered from this page' in page
    assert 'No unaudited quota mutation is possible' in page


def test_step3_admin_setup_styles_are_scrollable_and_responsive():
    css = read('styles/app.css')

    assert '.admin-setup-page' in css
    assert '.admin-setup-grid' in css
    assert 'grid-template-columns: minmax(0, 1fr) minmax(320px, .34fr);' in css
    assert '@media (max-width: 1180px)' in css
    assert '.admin-setup-card' in css
