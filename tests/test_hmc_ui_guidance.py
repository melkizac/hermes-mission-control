from pathlib import Path
import importlib.util
import sys

ROOT = Path('/opt/hermes-mission-control/source')
SCRIPT = ROOT / 'scripts/hmc_ui_guidance.py'
DOC = ROOT / 'docs/HMC_UI_DECISION_LIBRARY.md'
AGENTS = ROOT / 'AGENTS.md'


def load_module():
    spec = importlib.util.spec_from_file_location('hmc_ui_guidance', SCRIPT)
    assert spec is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_hmc_ui_guidance_library_has_curated_records_for_core_surfaces():
    module = load_module()
    keys = {record.key for record in module.RECORDS}

    assert 'task-drawer' in keys
    assert 'model-router' in keys
    assert 'approval-queue' in keys
    assert 'operator-dashboard' in keys
    assert 'navigation' in keys


def test_hmc_ui_guidance_routes_model_router_queries_to_governance_not_vanity_cards():
    module = load_module()
    top_score, top_record = module.score_records('model routing provider fallback cost approval governance')[0]

    assert top_score > 0
    assert top_record.key == 'model-router'
    assert 'governance infrastructure' in top_record.title
    assert 'vanity model gallery' in top_record.title
    assert any('silently change production behavior' in item for item in top_record.avoid)
    assert any('credential source without exposing secrets' in item for item in top_record.adopt)


def test_hmc_ui_guidance_routes_task_evidence_queries_to_task_drawer():
    module = load_module()
    top_score, top_record = module.score_records('task detail drawer evidence blocker cockpit result')[0]

    assert top_score > 0
    assert top_record.key == 'task-drawer'
    assert 'primary proof/evidence cockpit' in top_record.title
    assert any('json parsing' in item.lower() for item in top_record.avoid)


def test_hmc_ui_decision_library_documents_external_repo_boundary_and_query_command():
    text = DOC.read_text(encoding='utf-8')

    assert 'nextlevelbuilder/ui-ux-pro-max-skill' in text
    assert 'does **not** import the external repo' in text
    assert 'python3 scripts/hmc_ui_guidance.py "task detail drawer evidence"' in text
    assert 'Model routing UI is governance infrastructure' in text


def test_agents_file_instructs_querying_hmc_ui_guidance_before_ui_edits():
    text = AGENTS.read_text(encoding='utf-8')

    assert 'HMC UI guidance query-first workflow' in text
    assert 'python3 scripts/hmc_ui_guidance.py "<screen or UI change>"' in text
    assert 'docs/HMC_UI_DECISION_LIBRARY.md' in text
