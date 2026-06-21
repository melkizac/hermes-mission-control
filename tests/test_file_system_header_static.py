from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_file_system_header_uses_consistent_workspace_header_action():
    view = (ROOT / "src/views/FileSystem.tsx").read_text()

    assert 'className="fs-hero"' in view
    assert 'className="task-icon-action dark"' in view
    assert 'aria-label="Refresh files"' in view
    assert '>\n          Refresh\n        </button>' not in view


def test_file_system_header_styles_match_standard_workspace_pages():
    css = (ROOT / "src/styles/app.css").read_text()
    fs_block = css.split('/* ---------------- FILE SYSTEM ---------------- */', 1)[1].split('.fs-root-grid', 1)[0]

    assert 'padding: 26px 32px 40px;' in fs_block
    assert 'background: linear-gradient(180deg, #fbfcff 0%, #f5f7fb 100%);' in fs_block
    assert 'margin-bottom: 20px;' in fs_block
    assert 'font-size: 29px;' in fs_block
    assert 'background: linear-gradient(135deg' not in fs_block
    assert 'color: #fff;' not in fs_block
    assert 'box-shadow: 0 18px 50px' not in fs_block
