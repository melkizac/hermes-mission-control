import importlib.util
import sys
from pathlib import Path

APP_PATH = Path('/opt/hermes-mission-control/app.py')
sys.path.insert(0, str(APP_PATH.parent))
spec = importlib.util.spec_from_file_location('mission_control_app', APP_PATH)
assert spec is not None and spec.loader is not None
app = importlib.util.module_from_spec(spec)
spec.loader.exec_module(app)


def seed_kb(tmp_path: Path) -> Path:
    root = tmp_path / 'kb'
    wiki = root / 'wiki'
    raw = root / 'raw'
    schema = root / 'schema'
    (wiki / 'topics').mkdir(parents=True)
    (wiki / 'sources').mkdir(parents=True)
    (wiki / 'companies').mkdir(parents=True)
    raw.mkdir(parents=True)
    schema.mkdir(parents=True)
    (wiki / 'index.md').write_text('# Index\n\n- [[SGQR PayNow Web Integration]]\n', encoding='utf-8')
    (wiki / 'log.md').write_text('## 2026-01-01\nCaptured SGQR evidence.\n', encoding='utf-8')
    (schema / 'WORKFLOW.md').write_text('# Workflow\n\nUse sources before synthesis.\n', encoding='utf-8')
    (wiki / 'topics' / 'sgqr-paynow-web-integration.md').write_text(
        '# SGQR PayNow Web Integration\n\nImplementation guidance linked to [[Nets Source]].\n\napi_key = SHOULD_NOT_LEAK\n',
        encoding='utf-8',
    )
    (wiki / 'sources' / 'nets-source.md').write_text('# Nets Source\n\nEvidence for [[SGQR PayNow Web Integration]].\n', encoding='utf-8')
    (wiki / 'companies' / 'nexius-labs.md').write_text('# Nexius Labs\n\nRelated to [[SGQR PayNow Web Integration]].\n', encoding='utf-8')
    (raw / 'receipt.txt').write_text('raw evidence token=RAW_SECRET', encoding='utf-8')
    (raw / 'receipt.jpg').write_bytes(b'\xff\xd8\xff\xe0\x00\x10JFIF\x00[[\x1eQ\xff\xfe!@$\xff]]\x00\x00')
    return root


def point_app_at_kb(monkeypatch, root: Path):
    monkeypatch.setattr(app, 'SECOND_BRAIN_ROOT', root)
    monkeypatch.setattr(app, 'SECOND_BRAIN_WIKI', root / 'wiki')
    monkeypatch.setattr(app, 'SECOND_BRAIN_INDEX', root / 'wiki' / 'index.md')
    monkeypatch.setattr(app, 'SECOND_BRAIN_LOG', root / 'wiki' / 'log.md')
    monkeypatch.setattr(app, 'SECOND_BRAIN_WORKFLOW', root / 'schema' / 'WORKFLOW.md')


def test_second_brain_context_endpoints_index_search_note_graph_and_health(monkeypatch, tmp_path):
    root = seed_kb(tmp_path)
    point_app_at_kb(monkeypatch, root)

    index = app.second_brain_index_payload({})
    assert index['summary']['wiki_pages'] == 5
    assert index['summary']['raw_sources'] == 2
    assert index['summary']['chunks'] >= 5
    assert {'topics', 'sources', 'companies'} <= set(index['sections'])
    assert index['policy']['mode'] == 'read-only'

    search = app.second_brain_search_payload({'q': ['sgqr']})
    assert search['query'] == 'sgqr'
    assert search['results']
    assert all('SHOULD_NOT_LEAK' not in row['snippet'] for row in search['results'])

    note, status = app.second_brain_note_payload({'path': ['wiki/topics/sgqr-paynow-web-integration.md']})
    assert status == 200
    assert note['note']['title'] == 'SGQR PayNow Web Integration'
    assert note['note']['relative_path'] == 'wiki/topics/sgqr-paynow-web-integration.md'
    assert 'SHOULD_NOT_LEAK' not in note['note']['content']
    assert 'Nets Source' in note['note']['links']
    assert any('sources/nets-source.md' in backlink['relative_path'] for backlink in note['note']['backlinks'])
    assert note['context_actions'][0]['id'] == 'attach-to-chat'

    blocked, blocked_status = app.second_brain_note_payload({'path': ['../../etc/passwd']})
    assert blocked_status == 400
    assert blocked['error'] == 'invalid path'

    graph = app.second_brain_graph_payload({})
    assert any(node['id'] == 'wiki/topics/sgqr-paynow-web-integration.md' for node in graph['nodes'])
    assert any(edge['target'] == 'wiki/topics/sgqr-paynow-web-integration.md' for edge in graph['edges'])
    assert all(edge['source'] != 'raw/receipt.jpg' for edge in graph['edges'])
    assert all('\ufffd' not in str(edge.get('label', '')) for edge in graph['edges'])
    raw_jpg = next(item for item in index['raw_sources'] if item['relative_path'] == 'receipt.jpg')
    assert raw_jpg['is_text'] is False
    assert raw_jpg['links'] == []
    assert raw_jpg['preview'] == ''

    health = app.second_brain_health_payload({})
    assert health['health']['status'] in {'healthy', 'needs-attention'}
    assert any(check['label'] == 'Semantic-search-ready chunks' for check in health['health']['checks'])
    assert health['write_workflows']['status'] == 'planned-read-only'
