import sys
from uuid import uuid4

from test_multi_user_phase1 import load_app


def actions(record):
    return [event.get("action") for event in record.get("auditEvents") or record.get("audit") or []]


def test_capability_registration_status_health_assignment_emit_redacted_audit(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    admin = app.authenticate_user("melverick", "admin-secret")
    cap_id = f"cap-audit-demo-{uuid4().hex}"

    created, create_status = app.capability_registry_register_payload(admin, cap_id, {
        "id": cap_id,
        "type": "cli-tool",
        "name": "audit-demo",
        "displayName": "Audit Demo",
        "status": "registered",
        "evidence": [{"kind": "log", "title": "install log", "summary": "token=supersecret"}],
    })

    assert create_status == 201
    assert "registered" in actions(created["capability"])
    assert "supersecret" not in str(created)

    health, health_status = app.capability_registry_health_payload(admin, cap_id, {
        "state": "failing",
        "checkSummary": "api_key=hidden failure",
        "evidence": {"kind": "log", "title": "health log", "summary": "password=hunter2"},
    })
    assert health_status == 200
    assert "failed_broken" in actions(health["capability"])
    assert "hidden" not in str(health)
    assert "hunter2" not in str(health)

    assigned, assign_status = app.capability_registry_assignment_payload(admin, cap_id, {
        "agentId": "andrej",
        "agent": {"id": "andrej", "name": "Andrej"},
    })
    assert assign_status == 200
    assert "assigned" in actions(assigned["capability"])


def test_intake_lifecycle_and_sandbox_emit_redacted_audit(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    admin = app.authenticate_user("melverick", "admin-secret")
    intake_id = f"intake-audit-demo-{uuid4().hex}"

    created, create_status = app.capability_registry_intake_payload(admin, {
        "id": intake_id,
        "title": "Audit intake",
        "status": "approved",
        "sourceType": "cli-tool",
        "sourceRef": "audit-tool",
        "installMethod": {"kind": "manual", "commandPreview": "audit-tool --token secret-value"},
        "healthPlan": {"smokeTestCommand": "audit-tool --token secret-value"},
        "evidence": [{"kind": "source", "title": "source", "summary": "token=secret-value"}],
    })

    assert create_status == 201
    assert {"intake_submitted", "assessment_completed", "approved"}.issubset(set(actions(created["intake"])))
    assert "secret-value" not in str(created)

    result, sandbox_status = app.capability_registry_sandbox_payload(admin, intake_id, {
        "mode": "temp",
        "command": [sys.executable, "-c", "print('token=runtime-secret')"],
        "timeoutSeconds": 5,
    })

    assert sandbox_status == 200
    assert result["intake"]["status"] == "installed"
    assert "smoke_tested" in actions(result["intake"])
    assert "installed" in actions(result["intake"])
    assert "runtime-secret" not in str(result)
