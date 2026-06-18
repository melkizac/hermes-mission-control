import json
from pathlib import Path

from test_multi_user_phase1 import load_app
from test_multi_user_phase2_phase3 import make_user


def test_v016_runtime_registration_exposes_native_console_and_adapter_capabilities(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    token_payload, status = app.create_runtime_connector_token({"label": "Hermes v0.16", "allowed_types": ["hermes"]})
    assert status == 201
    headers = {"Authorization": f"Bearer {token_payload['secret']}", "Host": "hmc.test", "X-Forwarded-Proto": "https"}

    registered, status = app.runtime_connect_register({
        "framework": "hermes",
        "runtime_id": "client-a",
        "name": "Client A Hermes",
        "version": "0.16.0",
        "native_console_url": "https://client-a.example.com/dashboard",
        "remote_gateway_url": "https://client-a.example.com/v1",
        "dashboard_auth_mode": "portal",
        "hermes_release_date": "2026-06-16",
        "console_mode_policy": "supervise",
        "profile_id": "client-a",
        "profile_name": "Client A",
        "capabilities": {
            "managed_files": True,
            "cron": True,
            "kanban": True,
            "async_delegation": True,
            "approvals": True,
        },
    }, headers)

    assert status == 201
    runtime = next(r for r in app.list_runtime_connectors(headers)["runtimes"] if r["id"] == registered["display_id"])
    assert runtime["native_console_url"] == "https://client-a.example.com/dashboard"
    assert runtime["remote_gateway_url"] == "https://client-a.example.com/v1"
    assert runtime["dashboard_auth_mode"] == "portal"
    assert runtime["hermes_version"] == "0.16.0"
    assert runtime["hermes_release_date"] == "2026-06-16"
    assert runtime["profile_id"] == "client-a"
    assert runtime["profile_name"] == "Client A"
    assert runtime["console_mode_policy"] == "supervise"
    assert runtime["adapter"]["name"] == "HermesRuntimeAdapter"
    assert {"managed_files", "cron", "kanban", "async_delegation", "approvals"} <= set(runtime["capabilities"])
    assert {"managed_files", "cron", "kanban", "async_delegation", "approvals"} <= set(runtime["capability_flags"])
    assert "open_native_console" in runtime["safe_actions"]


def test_hmc_embeds_vps_hermes_desktop_from_admin_runtime_nav():
    app = Path("/opt/hermes-mission-control/source/src/App.tsx").read_text(encoding="utf-8")
    nav = Path("/opt/hermes-mission-control/source/src/components/NavRail.tsx").read_text(encoding="utf-8")
    desktop = Path("/opt/hermes-mission-control/source/src/views/HermesDesktopAdmin.tsx").read_text(encoding="utf-8")

    assert '{ key: "desktop-gateway", label: "Hermes Desktop", icon: "dashboard" }' in nav
    assert 'view === "desktop-gateway" && <HermesDesktopAdmin />' in app
    assert 'const desktopGatewayPath = "/desktop-gateway/sessions"' in desktop
    assert 'className="hermes-desktop-frame"' in desktop
    assert 'HMC remains the governance, approvals, evidence, and audit layer.' in desktop


def test_v016_runtime_artifact_locator_normalizes_remote_and_external_artifacts(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)

    managed = app.normalize_artifact_locator({
        "id": "artifact-1",
        "kind": "hermes_managed_file",
        "runtime_id": "remote-hermes-client-a",
        "profile_id": "client-a",
        "download_url": "https://client-a.example.com/files/artifact-1",
        "evidence_hash": "sha256:abc123",
        "redaction_status": "safe",
    })
    runtime_file = app.normalize_artifact_locator({"path": "/runtime/output/report.md"}, runtime_id="remote-hermes-client-a", profile_id="client-a")
    external = app.normalize_artifact_locator({"url": "https://example.com/report"}, runtime_id="remote-hermes-client-a")

    assert managed == {
        "kind": "hermes_managed_file",
        "runtime_id": "remote-hermes-client-a",
        "profile_id": "client-a",
        "download_url": "https://client-a.example.com/files/artifact-1",
        "path": None,
        "url": None,
        "evidence_hash": "sha256:abc123",
        "redaction_status": "safe",
        "metadata": {"id": "artifact-1", "locator_status": {"url": "missing", "download_url": "safe", "path": "missing"}},
    }
    assert runtime_file["kind"] == "runtime_file"
    assert runtime_file["path"] == "/runtime/output/report.md"
    assert runtime_file["runtime_id"] == "remote-hermes-client-a"
    assert external["kind"] == "external_url"
    assert external["url"] == "https://example.com/report"


def test_v016_artifact_locator_redacts_secret_urls_and_unsafe_local_paths(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)

    secret_url = app.normalize_artifact_locator({
        "kind": "external_url",
        "url": "https://client-a.example.com/report?token=SECRET&view=1&signature=abc",
        "download_url": "javascript:alert('x')",
    }, runtime_id="remote-hermes-client-a", profile_id="client-a")
    local_secret = app.normalize_artifact_locator({"path": "/root/.hermes/profiles/dev-ops/.env"})
    unsafe_runtime = app.normalize_artifact_locator({"path": "/root/.hermes/output/report.md"}, runtime_id="remote-hermes-client-a")

    assert secret_url["url"] == "https://client-a.example.com/report?view=1"
    assert secret_url["download_url"] is None
    assert secret_url["redaction_status"] == "redacted"
    assert "SECRET" not in json.dumps(secret_url)
    assert "signature=abc" not in json.dumps(secret_url)
    assert local_secret["path"] is None
    assert local_secret["redaction_status"] == "redacted"
    assert local_secret["metadata"]["filename"] == ".env"
    assert unsafe_runtime["path"] is None
    assert unsafe_runtime["metadata"]["locator_status"]["path"] == "unsafe-runtime-path"


def test_v016_runtime_artifact_ui_does_not_render_unsafe_protocol_links():
    foundation = Path("/opt/hermes-mission-control/source/src/components/MissionFoundation.tsx").read_text(encoding="utf-8")

    assert "safeArtifactHref" in foundation
    assert "javascript:" not in foundation
    assert "artifact.download_url" in foundation
    assert "artifact.redaction_status" in foundation


def test_v016_run_tree_preserves_async_child_status_completion_cause_and_runtime_profile(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    monkeypatch.setattr(app, "KANBAN_DB", tmp_path / "kanban.db")
    con = app.ensure_kanban_tables()
    now = 1_700_000_000
    for task_id, title in [("parent", "Parent"), ("child", "Child")]:
        con.execute(
            """
            INSERT INTO tasks (id,title,body,assignee,status,priority,created_by,created_at,workspace_kind,result,consecutive_failures,skills,model_override)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (task_id, title, "body", "devops", "running", 50, "test", now, "scratch", "", 0, json.dumps(["kanban-worker"]), "gpt-test"),
        )
    con.execute("INSERT INTO task_links(parent_id, child_id) VALUES (?,?)", ("parent", "child"))
    metadata = {
        "async_status": "detached",
        "completion_cause": "runtime_lost",
        "runtime_id": "remote-hermes-client-a",
        "profile_id": "client-a",
        "spawned_by": "delegate_task",
    }
    con.execute(
        "INSERT INTO task_runs(task_id,profile,step_key,status,started_at,ended_at,outcome,summary,metadata) VALUES (?,?,?,?,?,?,?,?,?)",
        ("child", "client-a", "delegate", "running", now, None, "detached", "child still running", json.dumps(metadata)),
    )
    con.commit(); con.close()

    payload, status = app.task_run_tree_response("parent")

    assert status == 200
    run = payload["run_tree"]["root"]["children"][0]["runs"][0]
    assert run["async_status"] == "detached"
    assert run["completion_cause"] == "runtime_lost"
    assert run["runtime_id"] == "remote-hermes-client-a"
    assert run["profile_id"] == "client-a"
    assert run["spawned_by"] == "delegate_task"


def test_v016_routine_records_scheduler_profile_ownership_and_duplicate_guard(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    admin = app.authenticate_user("melverick", "admin-secret")
    operator = make_user(app, "operator@example.com", name="Operator")

    result, status = app.upsert_workflow_routine(admin, {
        "id": "client-a-daily-brief",
        "name": "Client A daily brief",
        "routine_type": "workspace",
        "workspace_id": operator["workspace_id"],
        "runtime_id": "remote-hermes-client-a",
        "profile_id": "client-a",
        "scheduler_source": "hermes_cron",
        "hermes_cron_job_id": "cron-client-a-brief",
        "delivery_target": "origin",
        "duplicate_execution_guard": "client-a:daily-brief:0-9-*",
        "last_run_evidence": {"status": "not-run"},
    })

    assert status == 200
    routine = result["routine"]
    assert routine["profile_id"] == "client-a"
    assert routine["scheduler_source"] == "hermes_cron"
    assert routine["hermes_cron_job_id"] == "cron-client-a-brief"
    assert routine["delivery_target"] == "origin"
    assert routine["duplicate_execution_guard"] == "client-a:daily-brief:0-9-*"
    assert routine["last_run_evidence"] == {"status": "not-run"}

    duplicate, status = app.upsert_workflow_routine(admin, {
        "id": "client-a-daily-brief-copy",
        "name": "Duplicate daily brief",
        "routine_type": "workspace",
        "workspace_id": operator["workspace_id"],
        "runtime_id": "remote-hermes-client-a",
        "profile_id": "client-a",
        "scheduler_source": "dashboard",
        "duplicate_execution_guard": "client-a:daily-brief:0-9-*",
    })
    assert status == 409
    assert duplicate["ok"] is False
    assert "duplicate" in duplicate["error"].lower()


def test_v016_approval_policy_includes_memory_skill_model_provider_governance(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    _admin = app.authenticate_user("melverick", "admin-secret")
    operator = make_user(app, "operator@example.com", name="Operator")
    policy = app.default_approval_governance_policy()

    for action in [
        "memory_write",
        "skill_create",
        "skill_update",
        "skill_delete",
        "connector_credential_change",
        "model_provider_change",
        "external_send",
        "external_post",
        "external_purchase",
        "external_delete",
        "destructive_system_action",
        "sensitive_file_edit",
    ]:
        decision = app.evaluate_approval_policy(operator, {"action": action, "platform_policy": policy})
        assert decision["decision"] == "approval_required"
        assert decision["matched_level"] == "platform"


def test_v016_runtime_ui_preserves_control_plane_native_console_boundary():
    view = Path("/opt/hermes-mission-control/source/src/views/Runtimes.tsx").read_text(encoding="utf-8")
    types = Path("/opt/hermes-mission-control/source/src/types.ts").read_text(encoding="utf-8")

    assert "Open Native Hermes Console" in view
    assert "Mission Control remains the governance, assignment, approval, evidence, and audit layer" in view
    assert "runtime.native_console_url" in view
    assert "runtime.remote_gateway_url" not in view  # gateway URL stays out of the default operator surface
    assert "HermesRuntimeAdapterRecord" in types
    assert "DashboardAuthMode" in types


def test_linkedin_growth_brand_content_policy_requires_enrico_review(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)

    policy = app.linkedin_growth_brand_content_policy({
        "assignee": "linkedin-growth",
        "title": "Draft high-visibility LinkedIn comment for campaign positioning",
        "body": "Prepare final copy and decide if this is on-brand for Melverick.",
    })

    assert policy["required"] is True
    assert policy["reviewer_agent_id"] == "content-ops"
    assert "brand_content_judgement" in policy["scope"]
    assert "high_visibility_linkedin_action" in policy["triggers"]

    low_risk = app.linkedin_growth_brand_content_policy({
        "assignee": "linkedin-growth",
        "title": "Find ASEAN SME posts worth commenting on",
        "body": "Discover ICP targets and draft lightweight internal comment options under 50 words.",
    })
    assert low_risk["required"] is False


def test_linkedin_growth_brand_content_gate_blocks_completion_until_enrico_approval(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    monkeypatch.setattr(app, "KANBAN_DB", tmp_path / "kanban.db")

    created, status = app.create_task({
        "id": "linkedin-brand-gate",
        "title": "Draft high-visibility LinkedIn campaign comment",
        "body": "LinkedIn Growth should prepare final campaign-linked copy and brand judgement.",
        "assignee": "linkedin-growth",
        "status": "review",
        "result": {"summary": "Draft ready", "evidence_required": False},
    })
    assert status == 201

    blocked, status = app.update_task("linkedin-brand-gate", {"status": "done"})
    assert status == 409
    assert blocked["error"] == "completion blocked by pending Enrico brand/content review"
    assert "Enrico/content-ops review required" in blocked["blocking_reasons"][0]

    con = app.ensure_kanban_tables()
    con.execute(
        "INSERT INTO task_comments(task_id,author,body,created_at) VALUES (?,?,?,?)",
        ("linkedin-brand-gate", "Enrico / content-ops", "Approved for brand/content judgement.", 1_700_000_001),
    )
    con.commit(); con.close()

    completed, status = app.update_task("linkedin-brand-gate", {"status": "done"})
    assert status == 200
    assert completed["task"]["status"] == "done"
