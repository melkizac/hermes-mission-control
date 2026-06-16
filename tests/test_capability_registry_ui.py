from pathlib import Path

ROOT = Path('/opt/hermes-mission-control')
SRC = ROOT / 'source' / 'src'
APP = ROOT / 'app.py'


def read_src(rel: str) -> str:
    return (SRC / rel).read_text(encoding='utf-8')


def test_capability_registry_view_is_registered_and_admin_visible():
    types = read_src('types.ts')
    app = read_src('App.tsx')
    nav = read_src('components/NavRail.tsx')
    perms = read_src('services/uiPermissions.ts')
    deep_links = read_src('services/deepLinks.ts')

    assert '"capabilities"' in types
    assert 'import { CapabilityRegistry } from "./views/CapabilityRegistry";' in app
    assert 'view === "capabilities" && <CapabilityRegistry />' in app

    admin_block = nav.split('const adminConsoleGroups', 1)[1].split('// S1 route preservation note', 1)[0]
    workspace_block = nav.split('const simplifiedWorkspaceGroups', 1)[1].split('const adminConsoleGroups', 1)[0]
    assert '{ key: "capabilities", label: "Capability Registry", icon: "setup" }' in admin_block
    assert 'label: "Capability Registry"' not in workspace_block

    admin_only = perms.split('export const adminOnlyViews = new Set<ViewKey>([', 1)[1].split(']);', 1)[0]
    workspace_views = perms.split('export const workspaceViews = new Set<ViewKey>([', 1)[1].split(']);', 1)[0]
    assert '"capabilities"' in admin_only
    assert '"capabilities"' not in workspace_views

    assert '"capabilities"' in deep_links
    assert '"capabilities"]' in deep_links or '"capabilities"' in deep_links.split('const adminViews = new Set<ViewKey>([', 1)[1]


def test_capability_registry_intake_api_route_exists_before_detail_fallback():
    app = APP.read_text(encoding='utf-8')
    assert 'def capability_registry_intake_list_payload' in app
    intake_index = app.index("parsed.path == '/api/capabilities/intake'")
    detail_index = app.index("parsed.path.startswith('/api/capabilities/')")
    assert intake_index < detail_index
    assert 'capability_registry_intake_list_payload(parse_qs(parsed.query)' in app

def test_capability_registry_oss_intake_wizard_surfaces_assessment_and_gates_actions():
    view = read_src('views/CapabilityRegistry.tsx')
    client = read_src('services/httpHermesClient.ts')
    types = read_src('types.ts')

    assert 'OSS INTAKE WIZARD' in view
    assert 'Submit URL, package, or image source' in view
    assert 'accept="image/*"' in view
    assert 'assessCapabilitySource' in view
    assert 'createCapabilityIntake' in view
    assert 'runCapabilitySandbox' in view
    for label in ['Category', 'Source type', 'Install', 'License', 'Maintenance', 'Risk flags', 'Secrets', 'Permissions', 'Wrapper', 'Smoke test', 'Rollback', 'Approval']:
        assert f'label="{label}"' in view
    assert 'disabled={!isApprovedIntake(assessment)}' in view
    assert 'disabled={!approved || runningId === item.id}' in view
    assert 'Approval required before install/run' in view

    assert 'CapabilityAssessmentResponse' in types
    assert 'CapabilitySandboxResponse' in types
    assert 'request<CapabilityAssessmentResponse>("/api/capabilities/assess"' in client
    assert 'request<CapabilityIntakeMutationResponse>("/api/capabilities/intake"' in client
    assert '`/api/capabilities/intake/${encodeURIComponent(id)}/sandbox`' in client


def test_capability_registry_detail_drawer_has_tabs_evidence_redaction_and_source_links():
    view = read_src('views/CapabilityRegistry.tsx')

    for label in ['Overview', 'Setup/install', 'Governance', 'Assigned agents', 'Health/evidence', 'Audit trail', 'Rollback', 'Source']:
        assert label in view
    assert 'capabilityDetailTabs' in view
    assert 'redactSensitive' in view
    assert '•••• redacted' in view
    assert 'Last verified' in view
    assert 'Broken state' in view
    assert 'Health evidence IDs' in view
    assert 'Open Skills Hub' in view
    assert 'Open Tools Hub' in view
    assert 'Open Plugins Hub' in view
    assert 'Open Runtime Connectors' in view
    assert 'width="wide"' in view


def test_capability_registry_source_links_do_not_expose_unsafe_source_uri_hrefs():
    view = read_src('views/CapabilityRegistry.tsx')
    source_link_body = view.split('function sourceLinkFor(record: CapabilityRegistryRecord)', 1)[1].split('function CapabilityRefList', 1)[0]

    assert 'function isSafeExternalSourceUrl' in view
    assert 'url.username || url.password' in view
    assert 'sensitivePattern.test(key) || sensitivePattern.test(value)' in view
    assert 'hasTokenLikeFragment(url.pathname)' in view
    assert 'hasTokenLikeFragment(url.search)' in view
    assert 'isSafeExternalSourceUrl(record.sourceUri)' in source_link_body
    assert 'href: record.sourceUri' not in source_link_body
