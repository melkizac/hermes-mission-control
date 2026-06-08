from uuid import uuid4

from test_multi_user_phase1 import load_app
from test_multi_user_phase2_phase3 import make_user


def test_capability_risk_policy_normalizes_secret_access_and_exposes_actionable_blocker():
    import capability_registry

    governance = capability_registry.capability_governance_payload(["network", "requires-secret", "external-publish"])

    assert governance["riskLevels"] == ["network", "secret-access", "external-publish"]
    assert governance["primaryRisk"] == "external-publish"
    assert governance["approvalRequired"] is True
    assert governance["approvalAuthority"] == "melverick"
    assert governance["approvalStatus"] == "pending"
    assert governance["actionableBlocker"]["requiredApprover"] == "melverick"
    assert "Melverick" in governance["actionableBlocker"]["message"]
    assert "enable" in governance["blockedActions"]
    assert "external-publish" in governance["blockedActions"]


def test_risky_capability_registers_pending_and_enable_is_blocked_until_approval(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    admin = app.authenticate_user("melverick", "admin-secret")

    cap_id = f"cap-social-publisher-{uuid4().hex}"
    registered, status = app.capability_registry_register_payload(admin, cap_id, {
        "id": cap_id,
        "type": "api-connector",
        "name": "social-publisher",
        "displayName": "Social Publisher",
        "governance": {"riskLevels": ["external-publish"]},
    })

    assert status == 201
    assert registered["capability"]["status"] == "awaiting-approval"
    assert registered["capability"]["enabled"] is False
    assert registered["capability"]["policyEvidence"]["approvalAuthority"] == "melverick"
    assert registered["capability"]["policyEvidence"]["actionableBlocker"]["code"] == "capability_approval_required"

    blocked, blocked_status = app.capability_registry_status_payload(admin, cap_id, "enable", {})

    assert blocked_status == 409
    assert blocked["status"] == "blocked"
    assert blocked["blockedCapability"]["blocker"]["requiredApprover"] == "melverick"
    assert "POST /api/capabilities/<id>/approval-request" in blocked["nextAction"]

    approved, approve_status = app.capability_registry_status_payload(admin, cap_id, "approve", {"decisionNote": "approved for launch"})
    assert approve_status == 200
    assert approved["capability"]["governance"]["approvalStatus"] == "approved"

    enabled, enable_status = app.capability_registry_status_payload(admin, cap_id, "enable", {})
    assert enable_status == 200
    assert enabled["capability"]["enabled"] is True


def test_non_melverick_admin_cannot_approve_destructive_or_external_publish(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    melverick = app.authenticate_user("melverick", "admin-secret")
    other = make_user(app, "ops-admin@example.com", password="secret", name="Ops Admin", role="admin")

    cap_id = f"cap-dns-rotator-{uuid4().hex}"
    created, status = app.capability_registry_register_payload(melverick, cap_id, {
        "id": cap_id,
        "type": "internal-tool",
        "name": "dns-rotator",
        "displayName": "DNS Rotator",
        "governance": {"riskLevels": ["destructive"]},
    })
    assert status == 201
    assert created["capability"]["policyEvidence"]["approvalAuthority"] == "melverick"

    blocked, blocked_status = app.capability_registry_status_payload(other, cap_id, "approve", {})

    assert blocked_status == 409
    assert blocked["blockedCapability"]["blocker"]["requiredApprover"] == "melverick"
    assert "Melverick approval required" in blocked["error"]
