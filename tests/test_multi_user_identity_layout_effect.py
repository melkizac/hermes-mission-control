from pathlib import Path

SRC = Path('/opt/hermes-mission-control/source/src')


def read(rel):
    return (SRC / rel).read_text(encoding='utf-8')


def test_identity_refresh_uses_layout_effect_before_nav_permission_render():
    store = read('services/store.tsx')

    assert 'useLayoutEffect' in store
    assert 'useLayoutEffect(() => {' in store
    assert 'void refresh();' in store
