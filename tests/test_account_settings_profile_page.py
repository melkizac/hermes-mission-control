from pathlib import Path

SRC = Path('/opt/hermes-mission-control/source/src')


def read(rel):
    return (SRC / rel).read_text(encoding='utf-8')


def test_profile_route_renders_real_account_settings_not_placeholder():
    app = read('App.tsx')
    account = read('views/AccountSettings.tsx')

    assert 'import { AccountSettings } from "./views/AccountSettings";' in app
    assert 'view === "profile" && <AccountSettings />' in app
    assert 'view === "profile" && <Placeholder title="Account Settings"' not in app

    for required_copy in [
        'User Profile',
        'Workspace Preferences',
        '/api/me',
        'Default agent',
        'Default project',
        'Notifications',
        'Timezone',
        'Voice preference',
        'Planned / read-only',
    ]:
        assert required_copy in account

    assert 'This view is scaffolded but not built out yet' not in account


def test_account_settings_uses_authenticated_identity_and_runtime_metadata():
    account = read('views/AccountSettings.tsx')
    types = read('types.ts')

    for identity_field in ['me.user.name', 'me.user.email', 'me.user.role', 'me.workspace.name', 'me.workspace.slug']:
        assert identity_field in account

    for runtime_field in ['hermes_profile', 'runtime', 'agent_access']:
        assert runtime_field in types
        assert runtime_field in account

    assert 'useStore()' in account
    assert 'useEffect' in account
    assert 'fetch(`${window.location.protocol}//${window.location.host}/api/me`' in account


def test_account_settings_styles_exist_for_scrollable_page():
    css = read('styles/app.css')

    for selector in [
        '.account-settings-page',
        '.account-settings-hero',
        '.account-identity-grid',
        '.account-preferences-grid',
        '.account-readonly-pill',
        '.account-kv-list',
    ]:
        assert selector in css
