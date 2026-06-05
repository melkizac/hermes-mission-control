from pathlib import Path

SRC = Path('/opt/hermes-mission-control/source')
DOCS_TSX = SRC / 'src/views/MissionControlDocs.tsx'
DOCS_MD = SRC / 'docs/HERMES_MISSION_CONTROL.md'


def test_live_docs_has_mission_control_glossary_page():
    text = DOCS_TSX.read_text(encoding='utf-8')
    assert 'id: "glossary"' in text
    assert 'label: "Glossary"' in text
    assert 'Mission Control terminology and relationship map' in text
    for term in [
        'Intent',
        'Goal',
        'Project',
        'Mission',
        'Task',
        'Workflow',
        'Routine',
        'Automation',
        'Skill',
        'Tool',
        'Connector',
        'Runtime',
        'Approval Gate',
        'Blocker',
        'Output / Artifact',
        'Evidence',
        'Audit Log',
        'Run',
        'Agent',
        'AI Workforce',
    ]:
        assert term in text
    for relationship in [
        'Intent → Goal → Project / Mission → Tasks → Outputs / Evidence',
        'Workflow = reusable process template',
        'Routine = scheduled or recurring execution',
        'Routine is the user-facing term; automation is the technical implementation',
        'Skill = reusable know-how; tool = execution capability',
        'Approval Gate = approve/reject checkpoint; human task = manual action',
    ]:
        assert relationship in text


def test_markdown_documentation_has_glossary_contract():
    text = DOCS_MD.read_text(encoding='utf-8')
    assert '## Glossary: Mission Control terminology' in text
    assert '### Relationship map' in text
    for phrase in [
        '**Intent**: Raw user request in plain language.',
        '**Goal**: Structured business outcome Hermes is trying to achieve.',
        '**Project**: Persistent container for related goals, missions, tasks, evidence, and routines.',
        '**Mission**: Specific execution effort or run designed to achieve a goal.',
        '**Routine**: Scheduled or recurring Hermes work.',
        '**Automation**: Technical implementation behind a routine, such as cron, webhook, or background worker.',
    ]:
        assert phrase in text
