from pathlib import Path

ROOT = Path('/opt/hermes-mission-control/source')
SRC = ROOT / 'src'


def read(rel):
    return (SRC / rel).read_text(encoding='utf-8')


def test_phase0_domain_types_define_work_result_and_risk_primitives():
    types = read('types.ts')

    expected_exports = [
        'export type WorkItemKind',
        'export type RiskLevel',
        'export interface WorkItemRef',
        'export interface EvidenceRecord',
        'export interface MissionArtifact',
        'export interface ApprovalGate',
        'export interface MissionResult',
        'export interface PhaseCheckpoint',
    ]
    for needle in expected_exports:
        assert needle in types

    for risk in ['"safe"', '"approval-required"', '"external-facing"', '"destructive"', '"account-sensitive"']:
        assert risk in types

    for artifact_kind in ['"file"', '"link"', '"screenshot"', '"report"', '"diff"', '"message"']:
        assert artifact_kind in types


def test_phase0_shared_foundation_components_exist_and_are_accessible():
    foundation = read('components/MissionFoundation.tsx')

    expected_components = [
        'export function ProvenanceChips',
        'export function RiskBadges',
        'export function ArtifactCard',
        'export function EvidenceTimeline',
        'export function ResultSummaryPanel',
        'export function PhaseCheckpointCard',
    ]
    for needle in expected_components:
        assert needle in foundation

    for accessibility_marker in ['aria-label="Open artifact"', 'aria-label="Evidence timeline"', 'aria-label="Phase checkpoint"']:
        assert accessibility_marker in foundation


def test_phase0_foundation_styles_are_tokenized_and_namespaced():
    styles = read('styles/app.css')

    expected_classes = [
        '.mc-foundation-chips',
        '.mc-risk-badges',
        '.mc-artifact-card',
        '.mc-evidence-timeline',
        '.mc-result-summary',
        '.mc-phase-checkpoint',
    ]
    for needle in expected_classes:
        assert needle in styles

    assert 'var(--panel)' in styles
    assert 'var(--border)' in styles
