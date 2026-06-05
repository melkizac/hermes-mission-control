from pathlib import Path

CSS = Path('/opt/hermes-mission-control/source/src/styles/app.css')


def css():
    return CSS.read_text(encoding='utf-8')


def test_main_reserves_top_chrome_space_for_fixed_user_admin_and_bell_controls():
    text = css()

    assert '--top-chrome-reserve: 72px;' in text
    assert '.main { flex: 1; min-width: 0; overflow: hidden; display: flex; padding-top: var(--top-chrome-reserve); }' in text
    assert '.top-right-actions { position: fixed; top: 14px;' in text


def test_full_height_views_are_reduced_by_top_chrome_reserve():
    text = css()

    assert 'height: calc(100vh - var(--top-chrome-reserve));' in text
    assert 'height: calc(100dvh - var(--top-chrome-reserve));' in text
    assert '.mc { flex: 1; display: grid;' in text
    assert '.center { background: #fff; display: flex;' in text
