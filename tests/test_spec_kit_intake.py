import importlib.util
import os
import sys
from pathlib import Path


APP_PATH = Path("/opt/hermes-mission-control/app.py")


def load_app(tmp_path):
    os.environ["HERMES_HOME"] = str(tmp_path / "hermes-home")
    os.environ["HMC_APP_DB"] = str(tmp_path / "mission-control.db")
    sys.modules.pop("auth", None)
    spec = importlib.util.spec_from_file_location("hmc_app_spec_kit_test", APP_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_spec_kit_intake_creates_blocked_parent_artifacts_and_child_tasks(tmp_path):
    app = load_app(tmp_path)

    result, status = app.create_spec_kit_intake(
        {
            "title": "Requirements compiler smoke",
            "intent": "Turn a business ask into structured artifacts before Mission Control workers execute.",
            "projectId": "mission-control",
            "acceptance": "Feature spec exists\nImplementation plan exists\nTask breakdown exists",
            "assignee": "project-task",
            "priority": 50,
        },
        {"username": "pytest"},
    )

    assert status == 201
    assert result["ok"] is True
    assert result["intake"]["artifactCount"] == 3
    assert len(result["intake"]["childTaskIds"]) == 4
    assert len(result["child_tasks"]) == 4

    parent = result["task"]
    assert parent["status"] == "blocked"
    assert parent["tenant"] == "mission-control"
    assert parent["result_details"]["approval_gates"][0]["id"] == "spec-kit-requirements-approval"
    artifact_titles = [artifact["title"] for artifact in parent["result_details"]["artifacts"]]
    assert artifact_titles == ["Feature spec", "Implementation plan", "Task breakdown"]
    assert result["child_tasks"][0]["parents"] == [parent["id"]]


def test_spec_kit_intake_requires_title_and_intent(tmp_path):
    app = load_app(tmp_path)

    missing_title, missing_title_status = app.create_spec_kit_intake({"intent": "has intent"})
    missing_intent, missing_intent_status = app.create_spec_kit_intake({"title": "has title"})

    assert missing_title_status == 400
    assert missing_title["error"] == "title required"
    assert missing_intent_status == 400
    assert missing_intent["error"] == "intent/request required"
