from pathlib import Path


def test_approval_policy_ui_documents_capability_taxonomy_and_actionable_blockers():
    source = Path('/opt/hermes-mission-control/source/src/views/AdminSetupPage.tsx').read_text(encoding='utf-8')

    assert 'Capability risk taxonomy' in source
    for risk in ['read-only', 'local-write', 'network', 'secret-access', 'external-publish', 'production-control', 'destructive']:
        assert risk in source
    assert 'Melverick approval' in source
    assert 'blockedCapability.blocker.message' in source
    assert 'requiredApprover' in source
    assert 'nextAction' in source
