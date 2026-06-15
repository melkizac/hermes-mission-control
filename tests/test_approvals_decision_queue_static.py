from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_TSX = ROOT / "src" / "App.tsx"
APPROVALS_TSX = ROOT / "src" / "views" / "Approvals.tsx"
TYPES_TS = ROOT / "src" / "types.ts"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_needs_attention_bell_uses_inbox_decision_summary_language():
    src = read(APP_TSX)
    assert "pendingDecisionCount" in src
    assert 'const pendingFromSummary = Number(summary?.drafted ?? 0) + Number(summary?.ready ?? 0);' in src
    assert "void loadApprovalCount();\n    const timer = window.setTimeout" in src
    assert 'aria-label={`Needs Attention: ${pendingDecisionCount} approval decision' in src
    assert 'title={countLabel}' in src


def test_approvals_cards_show_decision_state_project_agent_and_evidence():
    src = read(APPROVALS_TSX)
    assert "function decisionState" in src
    assert "function projectRelation" in src
    assert "function evidencePreview" in src
    assert 'className="inbox-decision-group"' in src
    assert '<span>Project</span>' in src
    assert '<span>Agent</span>' in src
    assert '<span>Evidence</span>' in src
    assert 'No evidence attached — approval disabled until evidence is visible.' in src


def test_approve_is_guarded_by_visible_evidence_and_snooze_is_explicitly_disabled():
    src = read(APPROVALS_TSX)
    assert "function hasEvidence" in src
    assert "const canApproveSelected = selected ? hasEvidence(selected) : false;" in src
    assert 'disabled={!hasEvidence(item)}' in src
    assert 'title={!hasEvidence(item) ? "Evidence is required before approval" : "Approve"}' in src
    assert 'Snooze' in src
    assert 'disabled title="Snooze is not supported by the current inbox API yet"' in src


def test_inbox_metadata_type_supports_project_and_evidence_fields():
    src = read(TYPES_TS)
    assert "project_id?: string | null;" in src
    assert "project_name?: string | null;" in src
    assert "task_id?: string | null;" in src
    assert "evidence?: string | null;" in src
    assert "evidence_url?: string | null;" in src
