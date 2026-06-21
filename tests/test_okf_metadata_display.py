import importlib.util
import sys
from pathlib import Path

ROOT = Path('/opt/hermes-mission-control/source')
BACKEND_APP = ROOT / 'backend' / 'app.py'
SRC = ROOT / 'src'


def load_backend_app(name='hmc_backend_okf_metadata_tests'):
    spec = importlib.util.spec_from_file_location(name, BACKEND_APP)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def point_app_at_kb(app, root: Path):
    app.SECOND_BRAIN_ROOT = root
    app.SECOND_BRAIN_WIKI = root / 'wiki'
    app.SECOND_BRAIN_INDEX = root / 'wiki' / 'index.md'
    app.SECOND_BRAIN_LOG = root / 'wiki' / 'log.md'
    app.SECOND_BRAIN_WORKFLOW = root / 'schema' / 'WORKFLOW.md'


def test_okf_frontmatter_metadata_is_normalized_and_path_constrained(tmp_path):
    app = load_backend_app('hmc_backend_okf_metadata_parser')
    root = tmp_path / 'kb'
    topic = root / 'wiki' / 'topics' / 'open-knowledge-format.md'
    project = root / 'wiki' / 'projects' / 'hermes-mission-control.md'
    source = root / 'wiki' / 'sources' / 'google-okf.md'
    topic.parent.mkdir(parents=True)
    project.parent.mkdir(parents=True)
    source.parent.mkdir(parents=True)
    (root / 'schema').mkdir(parents=True)
    topic.write_text('''---\ntype: topic\ntitle: Open Knowledge Format\nstatus: active\nowner: Melverick Ng\nupdated: 2026-06-19\ntags:\n  - open-knowledge-format\n  - hmc\n---\n# Open Knowledge Format\n\nSummary body.\n''')
    project.write_text('''---\ntype: project\ntitle: Hermes Mission Control\nstatus: active\nowner: Melverick Ng\nprimary_agent: Melkizac\nengineering_owner: Andrej\nupdated: 2026-06-19\ntags: [hmc, mission-control]\n---\n# Hermes Mission Control\n''')
    source.write_text('''---\ntype: source\ntitle: Google OKF announcement\nsource_url: https://example.com/okf\npublisher: Google Cloud\npublished: 2026-06-18\nretrieved: 2026-06-19\nraw_path: raw/sources/google-okf.html\nsha256: abc123\n---\n# Source\n''')

    point_app_at_kb(app, root)
    item = app.second_brain_file_item(topic, app.SECOND_BRAIN_WIKI, 'wiki')
    assert item['okf_metadata'] == {
        'type': 'topic',
        'title': 'Open Knowledge Format',
        'status': 'active',
        'owner': 'Melverick Ng',
        'updated': '2026-06-19',
        'tags': ['open-knowledge-format', 'hmc'],
    }
    assert item['okf_source_path'] == 'wiki/topics/open-knowledge-format.md'
    assert 'content' not in item['okf_metadata']

    source_item = app.second_brain_file_item(source, app.SECOND_BRAIN_WIKI, 'wiki')
    assert source_item['okf_metadata']['source_url'] == 'https://example.com/okf'
    assert source_item['okf_metadata']['publisher'] == 'Google Cloud'
    assert source_item['okf_metadata']['raw_path'] == 'raw/sources/google-okf.html'
    assert source_item['okf_metadata']['sha256'] == 'abc123'

    note, status = app.second_brain_note_payload({'path': ['wiki/projects/hermes-mission-control.md']})
    assert status == 200
    assert note['policy']['mode'] == 'read-only'
    assert note['note']['okf_metadata']['primary_agent'] == 'Melkizac'
    assert note['note']['okf_metadata']['engineering_owner'] == 'Andrej'

    blocked, blocked_status = app.second_brain_note_payload({'path': ['../../etc/passwd']})
    assert blocked_status == 400


def test_projects_payload_attaches_okf_metadata_to_kb_project_pages(tmp_path):
    app = load_backend_app('hmc_backend_okf_metadata_projects')
    root = tmp_path / 'kb'
    project = root / 'wiki' / 'projects' / 'hermes-mission-control.md'
    project.parent.mkdir(parents=True)
    (root / 'wiki' / 'topics').mkdir(parents=True)
    (root / 'schema').mkdir(parents=True)
    project.write_text('''---\ntype: project\ntitle: Hermes Mission Control\nstatus: active\nowner: Melverick Ng\nprimary_agent: Melkizac\nengineering_owner: Andrej\nupdated: 2026-06-19\ntags:\n  - hmc\n---\n# Hermes Mission Control\n\nProject page body.\n''')
    point_app_at_kb(app, root)
    app.PROJECTS_CACHE_TTL_SECONDS = 0

    payload = app.list_projects({})
    mission = next(project for project in payload['projects'] if project['id'] == 'mission-control')
    okf_items = [item for item in mission['knowledge'] if item.get('okf_metadata')]
    assert okf_items
    assert okf_items[0]['okf_metadata']['type'] == 'project'
    assert okf_items[0]['okf_metadata']['engineering_owner'] == 'Andrej'
    assert okf_items[0]['okf_source_path'] == 'wiki/projects/hermes-mission-control.md'


def test_okf_metadata_is_rendered_read_only_in_existing_hmc_surfaces():
    memory_view = (SRC / 'views' / 'MemoryContext.tsx').read_text(encoding='utf-8')
    projects_view = (SRC / 'views' / 'Projects.tsx').read_text(encoding='utf-8')
    types = (SRC / 'types.ts').read_text(encoding='utf-8')

    assert 'okf_metadata' in types
    assert 'OKF metadata' in memory_view
    assert 'Read-only frontmatter' in memory_view
    assert 'note.note.okf_metadata' in memory_view
    assert 'OKF metadata' in projects_view
    assert 'item.okf_metadata' in projects_view
    okf_card = memory_view[memory_view.find('function OkfMetadataCard'):memory_view.find('export function MemoryContext')]
    assert 'input' not in okf_card
    assert 'textarea' not in okf_card
