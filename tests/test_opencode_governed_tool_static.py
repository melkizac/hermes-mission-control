import importlib.util
import sys
from pathlib import Path


def load_source_app(monkeypatch, tmp_path):
    app_root = tmp_path / 'mission-control'
    app_root.mkdir()
    monkeypatch.setenv('HMC_APP_ROOT', str(app_root))
    monkeypatch.setenv('HMC_APP_DB', str(app_root / 'mission_control.db'))
    module_name = 'hmc_source_app_opencode_test'
    spec = importlib.util.spec_from_file_location(
        module_name,
        '/opt/hermes-mission-control/source/backend/app.py',
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_opencode_cli_is_exposed_as_governed_tool_and_capability(monkeypatch, tmp_path):
    fake_bin = tmp_path / 'bin'
    fake_bin.mkdir()
    opencode = fake_bin / 'opencode'
    opencode.write_text('#!/bin/sh\necho 1.17.11\n', encoding='utf-8')
    opencode.chmod(0o755)
    monkeypatch.setenv('PATH', f'{fake_bin}:{Path("/usr/bin")}')

    app = load_source_app(monkeypatch, tmp_path)

    records = app.installed_tool_records()
    opencode_tool = next(record for record in records if record['id'] == 'cli:opencode')
    assert opencode_tool['name'] == 'OpenCode CLI'
    assert opencode_tool['enabled'] is True
    assert opencode_tool['install']['command'] == 'opencode'
    assert opencode_tool['install']['wrapperType'] == 'autonomous-coding-cli'

    capability = app.normalize_tool_capability_source(opencode_tool)
    assert capability['id'] == 'cli-tool:cli:opencode'
    assert capability['displayName'] == 'OpenCode CLI'
    assert capability['installMethod']['wrapperType'] == 'autonomous-coding-cli'
    assert capability['health']['state'] == 'passing'
    assert '1.17.11' in capability['health']['checkSummary']
    assert capability['governance']['approvalStatus'] == 'approved'
    assert capability['governance']['approvalAuthority'] == 'melverick'
    assert capability['governance']['riskLevels'] == ['local-write', 'network', 'secret-access']
    assert 'unscoped-workdir-run' in capability['governance']['blockedActions']
    assert 'local-filesystem-write' in capability['permissions']
