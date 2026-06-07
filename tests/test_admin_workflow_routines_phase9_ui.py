from pathlib import Path

SRC = Path('/opt/hermes-mission-control/source/src')


def read(rel):
    return (SRC / rel).read_text(encoding='utf-8')


def test_phase9_routine_admin_ui_links_governed_runs_to_audit_detail():
    page = read('views/Automations.tsx')

    assert 'automation.last_run.run_detail_url' in page
    assert 'Open run detail' in page
    assert 'Browser evidence' in page
    assert 'Research artifact linkage' in page


def test_phase9_routine_admin_ui_surfaces_governance_scope_and_filters():
    page = read('views/Automations.tsx')

    assert 'Platform governed' in page
    assert 'Workspace governed' in page
    assert 'Personal governed' in page
    assert 'connector gate' in page
    assert 'Approval ${policyCount(automation.approval_policy_dependency)}' in page
    assert 'Quota ${policyCount(automation.quota_policy)}' in page
