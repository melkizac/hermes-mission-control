from pathlib import Path

ROOT = Path('/opt/hermes-mission-control/source')
SLIDE_OVER = ROOT / 'src/components/SlideOverDrawer.tsx'
CSS_PATH = ROOT / 'src/styles/app.css'


def test_shared_slide_over_drawer_uses_agent_style_tab_scroll_controls():
    source = SLIDE_OVER.read_text(encoding='utf-8')

    assert 'useRef' in source
    assert 'tabRailRef.current?.scrollBy({ left: direction * 220, behavior: "smooth" })' in source
    assert 'className="mc-drawer-tab-rail"' in source
    assert 'aria-label="Scroll tabs left"' in source
    assert 'aria-label="Scroll tabs right"' in source
    assert '<nav className="mc-drawer-tabs" ref={tabRailRef}>' in source
    assert 'aria-current={activeTab === item ? "page" : undefined}' in source


def test_shared_drawer_tabs_hide_native_scrollbar_and_match_agent_drawer_style():
    css = CSS_PATH.read_text(encoding='utf-8')

    assert '.mc-drawer-tab-rail {' in css
    assert 'grid-template-columns: 44px minmax(0, 1fr) 44px;' in css
    assert '.mc-drawer-tab-arrow {' in css
    assert 'border-radius: 999px;' in css
    assert 'scrollbar-width: none;' in css
    assert '.mc-drawer-tabs::-webkit-scrollbar { display: none; }' in css
    assert '.mc-drawer-tabs button.on::after' in css
    assert 'capability-detail-drawer .mc-drawer-tabs { overflow-x: auto; justify-content: flex-start; scrollbar-width: thin; }' not in css
