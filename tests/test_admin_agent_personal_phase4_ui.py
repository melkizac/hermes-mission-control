from pathlib import Path

SRC = Path('/opt/hermes-mission-control/source/src')


def read(rel):
    return (SRC / rel).read_text(encoding='utf-8')


def test_phase4_admin_ui_explains_personal_workspace_boundary():
    page = read('views/AdminSetupPage.tsx')

    assert 'Personal agents are private productivity helpers owned by one user.' in page
    assert 'Workspace agents are company-capable digital coworkers assigned by Admin.' in page
    assert 'Company-system access must be requested for promotion, not granted automatically.' in page
    assert 'Personal vs Workspace boundary' in page


def test_phase4_frontend_types_include_personal_owner_and_promotion_metadata():
    page = read('views/AdminSetupPage.tsx')

    assert 'owner_user_id?: string | null;' in page
    assert 'owner_workspace_id?: string | null;' in page
    assert 'promotion_request?: PersonalAgentPromotionRequest;' in page
    assert 'restricted_domains?: string[];' in page
