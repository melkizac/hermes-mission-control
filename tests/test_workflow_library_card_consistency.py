from pathlib import Path

ROOT = Path('/opt/hermes-mission-control/source')
WORKFLOW_PATH = ROOT / 'src/views/WorkflowLibrary.tsx'
CSS_PATH = ROOT / 'src/styles/app.css'


def test_workflow_drawer_uses_standard_x_close_button():
    workflow = WORKFLOW_PATH.read_text(encoding='utf-8')
    detail_section = workflow[workflow.index('{selected && ('):workflow.index('</aside>')]

    assert 'className="mc-drawer-close"' in detail_section
    assert '>×</button>' in detail_section
    assert '>Close</button>' not in detail_section


def test_workflow_grid_cards_do_not_render_inline_funnel_configuration_panel():
    workflow = WORKFLOW_PATH.read_text(encoding='utf-8')
    grid_section = workflow[workflow.index('<section className="workflow-grid">'):workflow.index('{workflows.length === 0')]

    assert 'workflow-funnel-target' not in grid_section
    assert 'Schedule recurring check' not in grid_section
    assert 'Launch workflow' in grid_section


def test_funnel_configuration_lives_in_detail_drawer_only():
    workflow = WORKFLOW_PATH.read_text(encoding='utf-8')
    detail_section = workflow[workflow.index('{selected && ('):workflow.index('</aside>')]

    assert 'selected.id === "website-funnel-check"' in detail_section
    assert 'workflow-funnel-settings' in detail_section
    assert 'Schedule recurring check' in detail_section


def test_workflow_cards_keep_compact_alignment_even_when_row_height_stretches():
    css = CSS_PATH.read_text(encoding='utf-8')

    assert '.workflow-card { background: var(--panel); border: 1px solid var(--line); border-radius: 20px; padding: 14px; box-shadow: 0 14px 34px rgba(20,26,38,.06); display: grid; gap: 12px; align-content: start; }' in css
    assert '.workflow-card-main { border: 0; background: transparent; text-align: left; display: grid; gap: 10px; align-content: start; color: var(--ink); }' in css
    assert '.workflow-launch { justify-self: start; align-self: start; }' in css
    assert '.workflow-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; }' in css
    assert 'line-height: 1; font-weight: 800;' in css
