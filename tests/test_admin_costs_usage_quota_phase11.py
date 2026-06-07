from test_multi_user_phase1 import load_app
from test_multi_user_phase2_phase3 import make_user


def test_phase11_usage_attribution_groups_routine_costs_by_workspace_user_agent_class_and_model(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    admin = app.authenticate_user("melverick", "admin-secret")
    acme = make_user(app, "acme@example.com", name="Acme")

    routines = [
        (admin, {
            "id": "platform-runtime-maintenance",
            "name": "Platform runtime maintenance",
            "routine_type": "platform",
            "runtime_id": "rt-platform",
            "agent_id": "devops",
            "agent_class": "platform",
        }, {
            "run_type": "routine",
            "model": "gpt-5.5",
            "provider": "openai",
            "token_usage": {"input_tokens": 1000, "output_tokens": 250, "reasoning_tokens": 50},
            "estimated_cost_usd": 0.42,
        }),
        (acme, {
            "id": "workspace-deep-research",
            "name": "Workspace deep research",
            "routine_type": "workspace",
            "workspace_id": acme["workspace_id"],
            "runtime_id": "rt-acme",
            "agent_id": "researcher",
            "agent_class": "workspace",
        }, {
            "run_type": "research",
            "model": "gpt-4.1-mini",
            "provider": "openai",
            "connector_id": "web-search",
            "research_run": {"id": "research-acme", "depth": "deep", "source_count": 12},
            "browser_evidence": {"sessions": [{"id": "browser-acme", "duration_minutes": 3.5, "actions": 18}]},
            "file_extraction": {"count": 2, "size_bytes": 2048},
            "token_usage": {"input_tokens": 2000, "output_tokens": 500},
            "estimated_cost_usd": 0.25,
        }),
        (acme, {
            "id": "personal-daily-digest",
            "name": "Personal daily digest",
            "routine_type": "personal",
            "agent_id": "personal-assistant",
        }, {
            "run_type": "routine",
            "model": "gpt-4.1-nano",
            "provider": "openai",
            "token_usage": {"input_tokens": 300, "output_tokens": 80},
            "estimated_cost_usd": 0.03,
        }),
    ]

    for identity, payload, metadata in routines:
        created, create_status = app.upsert_workflow_routine(identity, payload)
        assert create_status == 200, created
        executed, run_status = app.execute_workflow_routine(identity, created["routine"]["id"], metadata)
        assert run_status == 200, executed
        usage = executed["run"]["usage"]
        assert usage["attribution"]["model"] == metadata["model"]
        assert usage["metrics"]["estimated_cost_usd"] == metadata["estimated_cost_usd"]

    costs = app.get_costs({"days": ["30"]})

    labels = {row["label"] for row in costs["by_agent_class"]}
    assert {"Platform agents", "Workspace agents", "Personal agents"}.issubset(labels)
    assert any(row["workspace_id"] == acme["workspace_id"] and row["cost"] >= 0.25 for row in costs["by_workspace"])
    assert any(row["user_id"] == acme["user"]["id"] and row["cost"] >= 0.28 for row in costs["by_user"])
    assert any(row["model"] == "gpt-4.1-mini" and row["provider"] == "openai" for row in costs["by_model_provider"])
    assert costs["research_usage"]["runs"] == 1
    assert costs["research_usage"]["by_depth"]["deep"]["runs"] == 1
    assert costs["browser_usage"]["runs"] == 1
    assert costs["browser_usage"]["actions"] == 18
    workspace_usage = next(row for row in costs["usage_records"] if row["routine_id"] == "workspace-deep-research")
    assert workspace_usage["workspace_id"] == acme["workspace_id"]
    assert workspace_usage["user_id"] == acme["user"]["id"]
    assert workspace_usage["agent_class"] == "workspace"
    assert workspace_usage["connector_id"] == "web-search"
    assert workspace_usage["file_extraction_size_bytes"] == 2048


def test_phase11_quota_blocks_before_execution_and_creates_audit_event(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    user = make_user(app, "quota@example.com", name="Quota")

    created, create_status = app.upsert_workflow_routine(user, {
        "id": "quota-blocked-research",
        "name": "Quota blocked research",
        "routine_type": "workspace",
        "workspace_id": user["workspace_id"],
        "agent_id": "researcher",
        "agent_class": "workspace",
        "quota_impact": {
            "run_type": "research",
            "research_depth": "deep",
            "estimated_cost_usd": 0.20,
            "browser_minutes": 2,
        },
        "quota_policy": {
            "workspace": {"max_estimated_cost_usd": 0.10},
            "research_depth": {"deep": {"remaining_runs": 0}},
            "browser": {"remaining_minutes": 1},
        },
    })
    assert create_status == 200, created

    result, status = app.execute_workflow_routine(user, "quota-blocked-research", {
        "run_type": "research",
        "model": "gpt-4.1-mini",
        "provider": "openai",
        "research_run": {"id": "rq", "depth": "deep"},
        "estimated_cost_usd": 0.20,
        "browser_evidence": {"sessions": [{"duration_minutes": 2, "actions": 3}]},
    })

    assert status == 403
    assert result["status"] == "blocked"
    assert result["quota"]["decision"] == "blocked"
    assert result["run"]["status"] == "blocked"
    assert result["run"]["usage"]["metrics"]["estimated_cost_usd"] == 0.20
    events = app.list_workspace_audit_events({}, user)["events"]
    quota_events = [event for event in events if event["action"] == "quota.execution_blocked"]
    assert quota_events
    assert quota_events[0]["evidence"]["quota"]["decision"] == "blocked"
    assert not [event for event in events if event["action"] == "workflow_routine.executed" and event["resource_id"] == "quota-blocked-research"]


def test_phase11_costs_usage_ui_is_governance_home_for_research_browser_and_quota():
    repo = "/opt/hermes-mission-control/source"
    nav_rail = open(f"{repo}/src/components/NavRail.tsx", encoding="utf-8").read()
    cost_dashboard = open(f"{repo}/src/views/CostDashboard.tsx", encoding="utf-8").read()

    assert "Costs / Usage" in nav_rail
    assert "Quota" in nav_rail
    assert "Browser Evidence" not in nav_rail
    assert "Research Runs" not in nav_rail
    assert "Platform agents" in cost_dashboard
    assert "Workspace agents" in cost_dashboard
    assert "Personal agents" in cost_dashboard
    assert "Research usage" in cost_dashboard
    assert "Browser usage" in cost_dashboard
    assert "Quota enforcement" in cost_dashboard
