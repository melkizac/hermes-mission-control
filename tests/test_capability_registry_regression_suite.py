import importlib
import json
import sqlite3
import sys
from pathlib import Path
from uuid import uuid4

from test_multi_user_phase1 import load_app
from test_multi_user_phase2_phase3 import make_user

ROOT = Path('/opt/hermes-mission-control')
SRC = ROOT / 'source' / 'src'


def load_capability_registry_for_current_env():
    sys.modules.pop('capability_registry', None)
    return importlib.import_module('capability_registry')


def _fake_agent(agent_id='devops'):
    return {
        'id': agent_id,
        'name': 'DevOps Builder',
        'squad': 'Builders',
        'status': 'idle',
        'skills': [{'id': 'kanban-worker', 'name': 'kanban-worker', 'source': 'Hermes'}],
        'tools': [{'id': 'browser', 'name': 'Browser automation', 'kind': 'mcp-server', 'enabled': True, 'toolCount': 4}],
        'profile_details': {
            'profile_id': agent_id,
            'plugins': {'items': [{'id': 'platforms/telegram', 'name': 'Telegram gateway', 'enabled': True, 'status': 'enabled'}]},
        },
    }


def test_capability_registry_schema_bootstraps_tables_indexes_and_json_columns(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    admin = app.authenticate_user('melverick', 'admin-secret')
    load_capability_registry_for_current_env()

    payload, status = app.capability_registry_list_payload({}, admin)
    assert status == 200
    assert 'capabilities' in payload

    con = sqlite3.connect(app.APP_DB)
    try:
        tables = {row[0] for row in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        assert {
            'capability_sources',
            'capability_intake_records',
            'capability_evidence',
            'capability_assignments',
            'capability_approvals',
            'capability_health_checks',
            'capability_audit_events',
        } <= tables

        source_columns = {row[1] for row in con.execute('PRAGMA table_info(capability_sources)')}
        intake_columns = {row[1] for row in con.execute('PRAGMA table_info(capability_intake_records)')}
        assert {'install_method_json', 'governance_json', 'permissions_json', 'health_json', 'evidence_json', 'assignment_json', 'rollback_json', 'audit_json'} <= source_columns
        assert {'risk_levels_json', 'install_method_json', 'permissions_json', 'health_plan_json', 'evidence_json', 'assigned_agents_json', 'rollback_notes_json'} <= intake_columns

        indexes = {row[1] for row in con.execute('PRAGMA index_list(capability_sources)')}
        assert {'idx_capability_sources_type', 'idx_capability_sources_status', 'idx_capability_sources_workspace', 'idx_capability_sources_profile'} <= indexes
    finally:
        con.close()


def test_capability_api_auth_blocks_anonymous_and_non_admin_mutations(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    viewer = make_user(app, 'viewer@example.com', password='viewer-secret', name='Viewer', role='viewer')

    for payload, status in [
        app.capability_registry_list_payload({}, None),
        app.capability_registry_assess_payload(None, {'sourceRef': 'black', 'sourceType': 'python-package'}),
        app.capability_registry_intake_list_payload({}, None),
        app.capability_registry_matrix_payload({}, None),
    ]:
        assert status == 401
        assert payload['ok'] is False

    cap_id = f'cap-auth-regression-{uuid4().hex}'
    registered, register_status = app.capability_registry_register_payload(viewer, cap_id, {'id': cap_id, 'type': 'cli-tool', 'name': 'auth-regression'})
    sandboxed, sandbox_status = app.capability_registry_sandbox_payload(viewer, 'missing-intake', {'mode': 'dry-run'})
    assert register_status == 403
    assert sandbox_status == 403
    assert registered['ok'] is False
    assert sandboxed['ok'] is False


def test_intake_assessor_and_direct_intake_summary_redact_secret_access(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    admin = app.authenticate_user('melverick', 'admin-secret')
    capability_registry = load_capability_registry_for_current_env()

    assessment, assess_status = app.capability_registry_assess_payload(admin, {
        'sourceType': 'cli-tool',
        'sourceUri': 'https://example.com/tool?token=super-secret',
        'permissions': ['network'],
        'requiredSecrets': [{'name': 'API_TOKEN', 'value': 'super-secret'}],
    })
    assert assess_status == 200
    assert assessment['assessment']['sourceUri'] == 'https://example.com/tool?token=[REDACTED]'
    assert 'super-secret' not in str(assessment)
    assert 'secret-access' in assessment['assessment']['governance']['riskLevels']

    intake = capability_registry.create_capability_intake_record({
        'id': f'intake-secret-regression-{uuid4().hex}',
        'title': 'Secret regression',
        'sourceType': 'api-connector',
        'status': 'awaiting-approval',
        'riskLevels': ['secret-access'],
    })
    listed = capability_registry.list_capability_intake_records({'q': intake['id']})
    assert listed['summary']['total'] == 1
    assert listed['summary']['awaitingApproval'] == 1
    assert listed['summary']['requiringSecrets'] == 1

    legacy_filtered = capability_registry.list_capability_intake_records({'risk': 'requires-secret', 'q': intake['id']})
    normalized_filtered = capability_registry.list_capability_intake_records({'risk': 'secret-access', 'q': intake['id']})
    assert [row['id'] for row in legacy_filtered['intake']] == [intake['id']]
    assert [row['id'] for row in normalized_filtered['intake']] == [intake['id']]

    con = capability_registry.ensure_capability_registry_tables()
    try:
        con.execute(
            'UPDATE capability_intake_records SET risk_levels_json=? WHERE id=?',
            (json.dumps(['requires-secret']), intake['id']),
        )
        con.commit()
    finally:
        con.close()
    legacy_row_filtered = capability_registry.list_capability_intake_records({'risk': 'requires-secret', 'q': intake['id']})
    normalized_row_filtered = capability_registry.list_capability_intake_records({'risk': 'secret-access', 'q': intake['id']})
    assert [row['id'] for row in legacy_row_filtered['intake']] == [intake['id']]
    assert [row['id'] for row in normalized_row_filtered['intake']] == [intake['id']]


def test_existing_hub_ingestion_matrix_keeps_skills_tools_plugins_and_registry_records(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    admin = app.authenticate_user('melverick', 'admin-secret')
    monkeypatch.setattr(app, 'list_agents_payload', lambda identity=None: [_fake_agent('devops')])

    cap_id = f'cap-matrix-regression-{uuid4().hex}'
    created, create_status = app.capability_registry_register_payload(admin, cap_id, {
        'id': cap_id,
        'type': 'cli-tool',
        'name': 'matrix-regression',
        'displayName': 'Matrix Regression Tool',
        'governance': {'riskLevels': ['read-only'], 'approvalStatus': 'not-required'},
        'assignment': {'assignedAgents': [{'id': 'devops', 'name': 'DevOps Builder'}]},
    })
    assert create_status == 201, created

    payload, status = app.capability_registry_matrix_payload({'agent': ['devops']}, admin)
    assert status == 200
    row = payload['matrix'][0]
    by_source = {(cap['source'], cap['type']) for cap in row['capabilities']}
    assert ('Hermes', 'skill') in by_source
    assert ('profile-config', 'mcp-server') in by_source
    assert ('profile-plugin', 'plugin') in by_source
    assert ('registry', 'cli-tool') in by_source
    assert payload['summary']['skills'] >= 1
    assert payload['summary']['tools'] >= 2
    assert payload['summary']['registry'] >= 1


def test_owned_app_networth_tracker_registry_entry_is_privacy_safe_and_filterable(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    admin = app.authenticate_user('melverick', 'admin-secret')
    capability_registry = load_capability_registry_for_current_env()

    alias_created = capability_registry.create_capability_record({
        'id': f'owned-alias-{uuid4().hex}',
        'type': 'owned-app',
        'name': 'Owned alias regression',
        'status': 'registered',
    })
    assert alias_created['type'] == 'owned_app'

    payload, status = app.capability_registry_list_payload({'type': ['owned_app'], 'q': ['NetWorth']}, admin)
    assert status == 200
    assert payload['summary']['total'] == 1
    record = payload['capabilities'][0]
    assert record['id'] == 'owned_app:networth-tracker'
    assert record['type'] == 'owned_app'
    assert record['displayName'] == 'NetWorth Tracker'
    assert record['sourceUri'] == 'https://mez.melverick.com'
    assert record['sourceLabel'] == 'Owned App Registry'
    assert record['ownerKind'] == 'personal'
    assert record['visibility'] == 'admin-only'
    assert record['installMethod']['requiredSecrets'] == []
    assert record['installMethod']['kind'] == 'owned-app-adapter'
    assert record['installMethod']['wrapperType'] == 'local_script'
    assert record['installMethod']['adapterPath']['decision'] == 'local_script_first'
    assert record['installMethod']['adapterPath']['broadWritesAllowedByDefault'] is False
    assert record['installMethod']['adapterPath']['dryRunRequiredForWrites'] is True
    assert record['governance']['dataBoundary'] == 'financial-private'
    assert record['governance']['approvalAuthority'] == 'melverick'
    assert record['governance']['adapterPolicy']['defaultWrapper'] == 'local_script'
    assert 'broad_write_tool' in record['governance']['adapterPolicy']['forbiddenWrapperTypes']
    assert 'broad-write-tool' in record['governance']['blockedActions']
    assert 'production-control' in record['governance']['riskLevels']
    assert record['assignment']['assignedAgents'][0]['id'] == 'devops'

    leaked = str(record).lower()
    for forbidden in ['password', 'api_key', 'apikey', 'token=', 'bearer ', 'connection string', 'account balance', 'raw position']:
        assert forbidden not in leaked

    viewer = make_user(app, 'viewer-owned-app@example.com', password='viewer-secret', name='Viewer', role='viewer')
    hidden, hidden_status = app.capability_registry_list_payload({'type': ['owned_app'], 'q': ['NetWorth']}, viewer)
    assert hidden_status == 200
    assert hidden['summary']['total'] == 0

    alias_filtered, alias_status = app.capability_registry_list_payload({'type': ['owned-app'], 'category': ['personal-finance']}, admin)
    assert alias_status == 200
    assert [row['id'] for row in alias_filtered['capabilities']] == ['owned_app:networth-tracker']


def test_owned_app_assessment_defaults_to_local_script_and_gated_adapter_path(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    admin = app.authenticate_user('melverick', 'admin-secret')

    assessment, status = app.capability_registry_assess_payload(admin, {
        'sourceType': 'owned-app',
        'sourceUri': 'https://mez.melverick.com',
        'id': 'networth-tracker',
        'name': 'NetWorth Tracker',
        'businessDomain': 'personal-finance',
        'sensitivityLevels': ['financial_private', 'production_control'],
    })

    assert status == 200
    assessed = assessment['assessment']
    assert assessed['sourceType'] == 'owned_app'
    assert assessed['sourceLabel'] == 'Owned App Registry'
    assert assessed['suggestedWrapperType'] == 'local_script'
    assert assessed['installMethod']['kind'] == 'owned-app-adapter'
    assert assessed['installMethod']['wrapperType'] == 'local_script'
    assert assessed['installMethod']['requiredSecrets'] == []
    assert assessed['installMethod']['adapterPath']['broadWritesAllowedByDefault'] is False
    assert assessed['installMethod']['adapterPath']['dryRunRequiredForWrites'] is True
    assert assessed['governance']['adapterPolicy']['defaultWrapper'] == 'local_script'
    assert 'hermes_tool_readonly' in assessed['governance']['adapterPolicy']['allowedWrapperTypes']
    assert 'broad_write_tool' in assessed['governance']['adapterPolicy']['forbiddenWrapperTypes']
    assert 'broad-write-tool' in assessed['governance']['blockedActions']
    assert 'production-control' in assessed['governance']['riskLevels']
    assert 'password' not in str(assessed).lower()
    assert 'api_key' not in str(assessed).lower()


def test_sandbox_runner_governance_gate_blocks_unapproved_and_persists_redacted_success(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    admin = app.authenticate_user('melverick', 'admin-secret')
    intake_id = f'intake-sandbox-regression-{uuid4().hex}'

    created, create_status = app.capability_registry_intake_payload(admin, {
        'id': intake_id,
        'title': 'Sandbox regression',
        'status': 'awaiting-approval',
        'sourceType': 'cli-tool',
        'sourceRef': 'demo-tool',
        'installMethod': {'kind': 'manual', 'commandPreview': 'demo-tool --help'},
        'healthPlan': {'smokeTestCommand': 'demo-tool --help'},
        'rollbackNotes': {'uninstallSteps': ['remove generated wrapper/config']},
    })
    assert create_status == 201, created

    blocked, blocked_status = app.capability_registry_sandbox_payload(admin, intake_id, {'mode': 'dry-run'})
    assert blocked_status == 409
    assert blocked['status'] == 'blocked'

    approved, approve_status = app.capability_registry_intake_payload(admin, {'id': intake_id, 'status': 'approved'})
    assert approve_status == 200, approved

    result, sandbox_status = app.capability_registry_sandbox_payload(admin, intake_id, {
        'mode': 'temp',
        'command': ['python', '-c', "print('api_key=super-secret')"],
        'timeoutSeconds': 5,
    })
    assert sandbox_status == 200
    assert result['ok'] is True
    assert result['intake']['status'] == 'installed'
    assert result['intake']['healthPlan']['lastSandboxRun']['state'] == 'passing'
    assert result['intake']['evidence'][-1]['redacted'] is True
    assert 'super-secret' not in str(result)


def test_sandbox_runner_does_not_inherit_ambient_process_secrets(tmp_path, monkeypatch):
    load_app(tmp_path, monkeypatch)
    capability_registry = load_capability_registry_for_current_env()
    monkeypatch.setenv('HMC_SANDBOX_SHOULD_NOT_LEAK', 'ambient-secret')

    result = capability_registry.run_capability_sandbox(
        {
            'id': 'intake-env-isolation',
            'title': 'Env isolation',
            'status': 'approved',
            'sourceType': 'cli-tool',
            'sourceRef': 'env-check',
            'installMethod': {'kind': 'manual', 'commandPreview': 'python -c env'},
            'healthPlan': {'smokeTestCommand': 'python -c env'},
            'rollbackNotes': {'uninstallSteps': ['remove generated wrapper/config']},
        },
        mode='temp',
        command=['python', '-c', "import os; print(os.environ.get('HMC_SANDBOX_SHOULD_NOT_LEAK', 'missing'))"],
        timeout_seconds=5,
    )

    assert result['ok'] is True
    assert result['stdout'].strip() == 'missing'
    assert 'ambient-secret' not in str(result)


def test_sandbox_runner_venv_setup_uses_minimal_environment(tmp_path, monkeypatch):
    load_app(tmp_path, monkeypatch)
    capability_registry = load_capability_registry_for_current_env()
    monkeypatch.setenv('HMC_SANDBOX_SHOULD_NOT_LEAK', 'ambient-secret')

    result = capability_registry.run_capability_sandbox(
        {
            'id': 'intake-venv-env-isolation',
            'title': 'Venv env isolation',
            'status': 'approved',
            'sourceType': 'python-package',
            'sourceRef': 'env-check',
            'installMethod': {'kind': 'pip', 'commandPreview': 'python -c env'},
            'healthPlan': {'smokeTestCommand': 'python -c env'},
            'rollbackNotes': {'uninstallSteps': ['remove generated wrapper/config']},
        },
        mode='venv',
        command=['python', '-c', "import os; print(os.environ.get('HMC_SANDBOX_SHOULD_NOT_LEAK', 'missing'))"],
        timeout_seconds=10,
    )

    assert result['ok'] is True
    assert result['stdout'].strip() == 'missing'
    assert 'ambient-secret' not in str(result)


def test_capability_registry_ui_regression_covers_rendering_api_client_and_hub_labels():
    view = (SRC / 'views' / 'CapabilityRegistry.tsx').read_text(encoding='utf-8')
    context_panel = (SRC / 'components' / 'ContextPanel.tsx').read_text(encoding='utf-8')
    admin_setup = (SRC / 'views' / 'AdminSetupPage.tsx').read_text(encoding='utf-8')
    client = (SRC / 'services' / 'httpHermesClient.ts').read_text(encoding='utf-8')
    types = (SRC / 'types.ts').read_text(encoding='utf-8')

    for text in [
        'OSS INTAKE WIZARD',
        'Submit URL, package, or image source',
        'Approval required before install/run',
        'Open Skills Hub',
        'Open Tools Hub',
        'Open Plugins Hub',
        'Health/evidence',
        'Audit trail',
    ]:
        assert text in view

    assert 'assessCapabilitySource' in client
    assert 'createCapabilityIntake' in client
    assert 'runCapabilitySandbox' in client
    assert 'assignCapability' in client
    assert 'unassignCapability' in client
    assert 'CapabilityRegistryRecord' in types
    assert 'CapabilityAssessmentResponse' in types
    assert 'CapabilitySandboxResponse' in types
    assert 'Capability risk taxonomy' in admin_setup
    assert 'Workspace capability matrix' in context_panel
