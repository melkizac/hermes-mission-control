import sys
from uuid import uuid4

import pytest

import capability_registry
from test_multi_user_phase1 import load_app


APPROVED_INTAKE = {
    "id": "intake-sandbox-demo",
    "title": "Sandbox demo",
    "status": "approved",
    "sourceType": "cli-tool",
    "sourceRef": "demo-tool",
    "installMethod": {"kind": "manual", "commandPreview": "demo-tool --help"},
    "healthPlan": {"smokeTestCommand": "demo-tool --help"},
    "rollbackNotes": {"uninstallSteps": ["remove generated wrapper/config"]},
}


def test_sandbox_runner_dry_run_captures_noop_evidence_without_executing():
    result = capability_registry.run_capability_sandbox(
        {**APPROVED_INTAKE, "healthPlan": {"smokeTestCommand": "definitely-not-a-real-command --token abc123"}},
        mode="dry-run",
        timeout_seconds=2,
    )

    assert result["ok"] is True
    assert result["mode"] == "dry-run"
    assert result["executed"] is False
    assert result["command"] == "definitely-not-a-real-command --token [REDACTED]"
    assert result["exitCode"] is None
    assert result["healthEvidence"]["state"] == "dry-run"
    assert result["cleanup"]["performed"] is True
    assert "abc123" not in str(result)


def test_sandbox_runner_captures_failure_exit_code_and_redacts_output():
    result = capability_registry.run_capability_sandbox(
        APPROVED_INTAKE,
        mode="temp",
        command=[sys.executable, "-c", "import sys; print('token=secret-token'); print('api_key=supersecret', file=sys.stderr); sys.exit(7)"],
        timeout_seconds=5,
    )

    assert result["ok"] is False
    assert result["mode"] == "temp"
    assert result["executed"] is True
    assert result["exitCode"] == 7
    assert result["healthEvidence"]["state"] == "failing"
    assert "secret-token" not in str(result)
    assert "supersecret" not in str(result)
    assert "token=[REDACTED]" in result["stdout"]
    assert "api_key=[REDACTED]" in result["stderr"]
    assert result["cleanup"]["performed"] is True


def test_sandbox_runner_times_out_and_cleans_up():
    result = capability_registry.run_capability_sandbox(
        APPROVED_INTAKE,
        mode="temp",
        command=[sys.executable, "-c", "import time; time.sleep(3)"],
        timeout_seconds=0.2,
    )

    assert result["ok"] is False
    assert result["timedOut"] is True
    assert result["exitCode"] is None
    assert result["healthEvidence"]["state"] == "timeout"
    assert result["durationMs"] >= 0
    assert result["cleanup"]["performed"] is True
    assert result["cleanup"]["sandboxExistsAfterCleanup"] is False


def test_sandbox_runner_blocks_unapproved_intake_records():
    with pytest.raises(PermissionError):
        capability_registry.run_capability_sandbox({**APPROVED_INTAKE, "status": "intake"}, mode="dry-run")


def test_sandbox_payload_persists_redacted_evidence_for_approved_intake(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    admin = app.authenticate_user("melverick", "admin-secret")
    intake_id = f"intake-sandbox-api-{uuid4().hex}"
    created, create_status = app.capability_registry_intake_payload(admin, {**APPROVED_INTAKE, "id": intake_id})
    assert create_status == 201
    assert created["intake"]["status"] == "approved"

    result, status = app.capability_registry_sandbox_payload(admin, intake_id, {
        "mode": "temp",
        "command": [sys.executable, "-c", "print('password=hunter2')"],
        "timeoutSeconds": 5,
    })

    assert status == 200
    assert result["ok"] is True
    assert result["sandbox"]["healthEvidence"]["state"] == "passing"
    assert result["intake"]["status"] == "installed"
    assert result["intake"]["healthPlan"]["lastSandboxRun"]["state"] == "passing"
    assert result["intake"]["evidence"][-1]["kind"] == "sandbox-smoke-test"
    assert "hunter2" not in str(result)
