from test_multi_user_phase1 import load_app
from test_multi_user_phase2_phase3 import make_user


def create_routine_run(app, identity, payload, metadata):
    result, status = app.upsert_workflow_routine(identity, payload)
    assert status == 200, result
    executed, run_status = app.execute_workflow_routine(identity, result["routine"]["id"], metadata)
    assert run_status == 200, executed
    return executed["run"]


def test_phase10_personal_run_detail_is_visible_to_owner_not_other_user(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    acme = make_user(app, "acme@example.com", name="Acme")
    beta = make_user(app, "beta@example.com", name="Beta")

    run = create_routine_run(app, acme, {
        "id": "acme-personal-research",
        "name": "Acme personal research",
        "routine_type": "personal",
        "agent_id": "melkizac",
    }, {
        "browser_evidence": {"sessions": [{"id": "browser-acme", "title": "Acme browser evidence", "screenshot": {"path": "/tmp/acme.png"}}]},
        "research_run": {"id": "research-acme", "title": "Acme private research", "sources": [{"id": "internal", "label": "Internal docs"}]},
        "artifacts": [{"id": "artifact-acme", "kind": "report", "title": "Acme report", "path": "/tmp/acme-report.md"}],
    })

    owner_detail, owner_status = app.workspace_run_detail(acme, run["id"])
    other_detail, other_status = app.workspace_run_detail(beta, run["id"])

    assert owner_status == 200
    assert owner_detail["run"]["id"] == run["id"]
    assert owner_detail["run"]["browser_evidence"]["sessions"][0]["id"] == "browser-acme"
    assert owner_detail["run"]["research_run"]["id"] == "research-acme"
    assert owner_detail["run"]["artifacts"][0]["id"] == "artifact-acme"
    assert other_status == 404
    assert "not found" in other_detail["error"].lower()


def test_phase10_workspace_authorized_user_can_see_workspace_run_content(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    acme_owner = make_user(app, "acme-owner@example.com", name="Acme")
    acme_peer = make_user(app, "acme-peer@example.com", name="Acme Peer")
    # Force the second user into the same workspace to represent a workspace-authorized teammate.
    acme_peer["workspace_id"] = acme_owner["workspace_id"]
    acme_peer["workspace"] = acme_owner["workspace"]

    run = create_routine_run(app, acme_owner, {
        "id": "acme-workspace-browser-research",
        "name": "Acme workspace browser research",
        "routine_type": "workspace",
        "workspace_id": acme_owner["workspace_id"],
        "agent_id": "devops",
    }, {
        "browser_evidence": {"sessions": [{"id": "browser-workspace", "title": "Workspace browser evidence"}]},
        "research_run": {"id": "research-workspace", "title": "Workspace research"},
    })

    history = app.list_workspace_run_history({}, acme_peer)
    detail, status = app.workspace_run_detail(acme_peer, run["id"])

    assert run["id"] in {item["id"] for item in history["runs"]}
    assert status == 200
    assert detail["run"]["scope"] == "workspace"
    assert detail["contextual_access"]["surfaces"] == ["audit", "approval", "costs", "quota", "workspace-runtime-console"]
    assert detail["run"]["research_run"]["id"] == "research-workspace"


def test_phase10_research_policy_ladder_enforces_quota_approval_and_roles(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    user = make_user(app, "researcher@example.com", role="user", name="Researcher")
    admin = app.authenticate_user("melverick", "admin-secret")

    basic = app.evaluate_research_policy(user, {"mode": "basic"})
    deep_over_quota = app.evaluate_research_policy(user, {"mode": "deep", "quota": {"remaining_deep_runs": 0}})
    browser_needs_approval = app.evaluate_research_policy(user, {"mode": "browser", "quota": {"remaining_browser_runs": 2}})
    download_restricted = app.evaluate_research_policy(user, {"mode": "download", "approval": False})
    internal_docs_denied = app.evaluate_research_policy(user, {"mode": "basic", "use_internal_docs": True})
    internal_docs_admin = app.evaluate_research_policy(admin, {"mode": "basic", "use_internal_docs": True})

    assert basic["decision"] == "allowed"
    assert deep_over_quota["decision"] == "blocked"
    assert "quota" in deep_over_quota["reason"].lower()
    assert browser_needs_approval["decision"] == "approval_required"
    assert download_restricted["decision"] == "blocked"
    assert internal_docs_denied["decision"] == "blocked"
    assert internal_docs_admin["decision"] == "allowed"


def test_phase10_admin_nav_has_contextual_not_standalone_evidence_research_items(tmp_path, monkeypatch):
    repo = "/opt/hermes-mission-control/source"
    ui_permissions = open(f"{repo}/src/services/uiPermissions.ts", encoding="utf-8").read()
    nav_rail = open(f"{repo}/src/components/NavRail.tsx", encoding="utf-8").read()

    admin_only_block = ui_permissions.split("export const adminOnlyViews", 1)[1].split("]);", 1)[0]
    assert '"browser-ops"' not in admin_only_block
    assert '"research-runs"' not in admin_only_block
    assert "Browser Evidence" not in nav_rail
    assert "Research Evidence" not in nav_rail
