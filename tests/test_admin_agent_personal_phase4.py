from test_multi_user_phase1 import load_app
from test_multi_user_phase2_phase3 import make_user


def ids(payload):
    return {agent["id"] for agent in payload["agents"]}


def test_phase4_personal_agent_is_private_to_owner_and_runnable_only_by_owner(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    owner = make_user(app, "owner@example.com", name="Owner")
    other = make_user(app, "other@example.com", name="Other")

    created, status = app.create_personal_agent(owner, {"name": "Inbox Helper", "description": "Drafts personal replies"})

    assert status == 201
    personal = created["agent"]
    assert personal["agent_class"] == "personal"
    assert personal["owner_user_id"] == owner["user"]["id"]
    assert personal["visibility"] == "owner-only"
    assert personal["selected"] is True
    assert personal["permissions"]["can_assign_to_users"] is False
    assert personal["id"] in ids(app.list_agent_directory(owner))
    assert personal["id"] not in ids(app.list_agent_directory(other))

    owner_route, owner_status = app.resolve_agent_runtime_route(owner, personal["id"])
    other_route, other_status = app.resolve_agent_runtime_route(other, personal["id"])
    assert owner_status == 200
    assert owner_route["agent_id"] == personal["id"]
    assert owner_route["agent_class"] == "personal"
    assert other_status == 403
    assert "owner" in other_route["error"].lower() or "available" in other_route["error"].lower()


def test_phase4_personal_agent_policy_strips_company_transaction_domains_by_default(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    owner = make_user(app, "owner@example.com", name="Owner")

    created, status = app.create_personal_agent(owner, {
        "name": "CRM Helper",
        "capabilities": ["chat", "draft", "crm", "accounting", "research"],
        "policy_metadata": {"connector_policy": {"transaction_domains": ["crm", "accounting"]}},
        "requested_company_access": ["crm", "accounting"],
    })

    assert status == 201
    agent = created["agent"]
    connector_policy = agent["policy_metadata"]["connector_policy"]
    assert connector_policy["transaction_domains"] == []
    assert connector_policy["default_access"] == "personal-productivity-only"
    assert connector_policy["restricted_domains"] == ["erp", "crm", "hr", "accounting"]
    assert "crm" not in agent["capabilities"]
    assert "accounting" not in agent["capabilities"]
    assert set(agent["capabilities"]) <= {"chat", "draft", "summarize", "research"}
    assert agent["policy_metadata"]["promotion_request"]["status"] == "pending-admin-review"
    assert agent["policy_metadata"]["promotion_request"]["requested_domains"] == ["crm", "accounting"]


def test_phase4_owner_can_edit_personal_agent_but_not_convert_to_workspace(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    owner = make_user(app, "owner@example.com", name="Owner")
    other = make_user(app, "other@example.com", name="Other")
    created, status = app.create_personal_agent(owner, {"name": "Draft Bot"})
    assert status == 201
    aid = created["agent"]["id"]

    updated, update_status = app.update_personal_agent(owner, aid, {"name": "Personal Draft Bot", "capabilities": ["summarize", "hr"]})
    denied, denied_status = app.update_personal_agent(other, aid, {"name": "Stolen"})
    convert, convert_status = app.update_personal_agent(owner, aid, {"agent_class": "workspace"})

    assert update_status == 200
    assert updated["agent"]["name"] == "Personal Draft Bot"
    assert updated["agent"]["agent_class"] == "personal"
    assert updated["agent"]["capabilities"] == ["summarize"]
    assert denied_status == 403
    assert convert_status == 400
    assert "promotion" in convert["error"].lower()


def test_phase4_admin_promotion_placeholder_converts_personal_to_workspace_with_audit(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    admin = app.authenticate_user("melverick", "admin-secret")
    owner = make_user(app, "owner@example.com", name="Owner")
    created, status = app.create_personal_agent(owner, {"name": "Ops Helper", "requested_company_access": ["crm"]})
    assert status == 201

    promoted, promote_status = app.admin_promote_personal_agent(admin, created["agent"]["id"], {"name": "Workspace Ops Helper"})

    assert promote_status == 200
    agent = promoted["agent"]
    assert agent["agent_class"] == "workspace"
    assert agent["visibility"] == "workspace-assigned"
    assert agent["owner_user_id"] == owner["user"]["id"]
    assert agent["policy_metadata"]["promotion"]["from_agent_class"] == "personal"
    assert "crm" in agent["policy_metadata"]["connector_policy"]["transaction_domains"]
    events = app.list_workspace_audit_events({}, admin)["events"]
    assert "admin_promote_personal_agent" in [event["action"] for event in events]
