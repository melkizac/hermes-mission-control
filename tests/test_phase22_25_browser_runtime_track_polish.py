from pathlib import Path
import importlib.util
import json
import sys

ROOT = Path('/opt/hermes-mission-control')
SRC = ROOT / 'source' / 'src'
APP = ROOT / 'app.py'


def src(rel):
    return (SRC / rel).read_text()


def load_app():
    sys.path.insert(0, str(ROOT))
    spec = importlib.util.spec_from_file_location('hmc_app_phase22_25', APP)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def patch_store(app, tmp_path):
    app.BROWSER_CONNECTORS = tmp_path / 'browser_connectors.json'
    app.BROWSER_CONNECTORS.write_text(json.dumps({'connectors': []}))


def approved_desktop_connector(app):
    created, status = app.upsert_browser_connector_config({
        'id': 'desktop-phase22-25',
        'label': 'Desktop Phase 22-25 gate',
        'type': 'desktop-browser',
        'baseUrl': 'local-playwright',
        'approved': True,
    })
    assert status in (200, 201)
    connector = created['connector']
    app.browser_connector_action(connector['id'], {'action': 'dry_run_probe', 'dryRunConfirmed': True})
    return connector['id']


def test_connector_payload_exposes_probe_history_policy_and_completion_without_enabling(tmp_path):
    app = load_app()
    patch_store(app, tmp_path)
    cid = approved_desktop_connector(app)

    probe_summary = {
        'status': 'blocked_before_submit',
        'finalUrl': 'https://httpbingo.org/forms/post',
        'domain': 'httpbingo.org',
        'screenshotPath': '/uploads/browser-connector-probes/phase22.png',
        'formsDetected': 1,
        'submitCandidates': 1,
        'noSubmit': True,
    }
    app.run_desktop_browser_probe_job = lambda url, session_id, screenshot_dir, timeout_ms=20000: probe_summary
    result, status = app.browser_connector_probe(cid, {'targetUrl': 'https://httpbingo.org/forms/post', 'dryRunConfirmed': True, 'noSubmit': True})
    assert status == 200
    connector = result['connector']
    assert connector['enabled'] is False
    assert connector['lastProbe']['status'] == 'blocked_before_submit'
    assert connector['lastProbe']['browserActivityUrl'].startswith('/app?view=browser-ops&session=')
    assert connector['probeHistory'][0]['screenshotPath'] == '/uploads/browser-connector-probes/phase22.png'
    assert connector['probeHistory'][0]['archived'] is False

    payload = app.browser_connectors_payload()
    assert payload['productionPolicy']['enablementStatus'] == 'blocked'
    assert payload['productionPolicy']['noSubmit'] is True
    assert 'submit/post/send/purchase' in payload['productionPolicy']['blockedActions']
    assert payload['browserTrackCompletion']['currentPhase'] == 'Phase 25'
    assert payload['browserTrackCompletion']['readyForAccountSensitive'] is False
    assert any(item['label'] == 'Evidence drill-through' and item['status'] == 'ready' for item in payload['browserTrackCompletion']['checklist'])
    assert any(item['label'] == 'Production external actions' and item['status'] == 'blocked' for item in payload['browserTrackCompletion']['checklist'])


def test_probe_archive_action_preserves_audit_history_and_keeps_connector_disabled(tmp_path):
    app = load_app()
    patch_store(app, tmp_path)
    cid = approved_desktop_connector(app)
    app.run_desktop_browser_probe_job = lambda *args, **kwargs: {
        'status': 'blocked_before_submit',
        'finalUrl': 'https://httpbingo.org/forms/post',
        'domain': 'httpbingo.org',
        'screenshotPath': '/uploads/browser-connector-probes/archive.png',
        'formsDetected': 1,
        'submitCandidates': 1,
        'noSubmit': True,
    }
    app.browser_connector_probe(cid, {'targetUrl': 'https://httpbingo.org/forms/post', 'dryRunConfirmed': True, 'noSubmit': True})

    archived, status = app.browser_connector_action(cid, {'action': 'archive_probe', 'probeId': 'latest', 'archivedBy': 'test operator'})
    assert status == 200
    connector = archived['connector']
    assert connector['enabled'] is False
    assert connector['lastProbe']['archived'] is True
    assert connector['probeHistory'][0]['archived'] is True
    assert connector['probeHistory'][0]['screenshotPath'] == '/uploads/browser-connector-probes/archive.png'
    assert 'archived for hygiene' in connector['probeHistory'][0]['archiveReason']


def test_browser_activity_and_routines_ui_expose_deep_polish_contracts():
    browser_ops = src('views/BrowserOperations.tsx')
    automations = src('views/Automations.tsx')
    types = src('types.ts')
    docs = src('views/MissionControlDocs.tsx')
    css = src('styles/app.css')

    # Phase 22 evidence drill-through: actual image/link evidence, not only placeholders.
    assert 'browser-screenshot-image' in browser_ops
    assert 'Open screenshot evidence' in browser_ops
    assert 'External action boundary' in browser_ops
    assert 'data-testid="browser-final-evidence-link"' in browser_ops
    assert 'new URLSearchParams(window.location.search).get("session")' in browser_ops

    # Phase 23 probe history/archive controls.
    assert 'Probe history' in automations
    assert 'Archive old probe evidence' in automations
    assert 'archive_probe' in automations
    assert 'probeHistory' in types

    # Phase 24 explicit production policy surface, still blocked.
    assert 'Production enablement policy' in automations
    assert 'submit/post/send/purchase blocked' in automations
    assert 'account-sensitive blocked' in automations
    assert 'productionPolicy' in types

    # Phase 25 completion summary/checklist and operator next actions.
    assert 'Browser runtime track completion' in automations
    assert 'Ready for supervised dry-runs; not ready for account-sensitive autonomy' in automations
    assert 'browserTrackCompletion' in types
    assert 'Phase 25 · Browser runtime track completion and UX polish' in docs

    # Deep UX polish: clearer card hierarchy, empty/loading/accessibility/mobile hooks.
    assert 'connector-command-center' in automations
    assert 'connector-policy-card' in automations
    assert 'aria-label="Production connector policy and completion status"' in automations
    assert '.connector-command-center' in css
    assert '.browser-screenshot-image' in css
    assert '@media (max-width: 720px)' in css
