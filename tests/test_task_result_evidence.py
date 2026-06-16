import importlib.util
import json
from pathlib import Path

ROOT = Path('/opt/hermes-mission-control')
APP_PATH = ROOT / 'app.py'


def load_app():
    spec = importlib.util.spec_from_file_location('mission_control_app_task_result_evidence_tests', APP_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def dump(payload):
    return json.dumps(payload, sort_keys=True)


def test_task_result_details_derives_safe_evidence_and_strips_secret_urls():
    app = load_app()
    details = app.task_result_details(json.dumps({
        'taskId': 't_example',
        'summary': 'Completed with api_key=super-secret-value',
        'verification': {'api_readback': '200 OK token=hidden-value'},
        'sources': [{
            'id': 'src-1',
            'title': 'Signed source',
            'url': 'https://example.com/source.pdf?token=hidden-value&expires=soon',
            'citation': {'health': 'complete'},
            'processing': {'status': 'indexed'},
        }],
        'artifacts': [{
            'id': 'deck-1',
            'title': 'Readback deck',
            'previewUrl': 'https://cdn.example.com/render.png?signature=hidden-value',
            'qaStatus': 'passed',
            'apiReadback': 'rendered password=hidden-value',
            'checks': ['opened', 'read back title'],
        }],
        'evidence': [{
            'type': 'api_readback',
            'title': 'API readback',
            'summary': 'Bearer hidden-value',
            'url': 'https://api.example.com/runs/abc?api_key=hidden-value',
            'runId': 'run-123',
        }],
    }))

    assert details is not None
    payload = dump(details)
    assert 'super-secret-value' not in payload
    assert 'hidden-value' not in payload
    assert '?token=' not in payload
    assert '?signature=' not in payload
    assert '?api_key=' not in payload
    assert '[REDACTED]' in payload

    evidence = details['evidence']
    types = {item['type'] for item in evidence}
    assert {'api_readback', 'verification_log', 'source_processing_log', 'artifact_validation'} <= types
    for item in evidence:
        assert item.get('createdAt')
        assert item.get('type')
        assert item.get('summary') is not None
        assert item.get('reference')
    artifact_item = next(item for item in evidence if item['type'] == 'artifact_validation')
    assert artifact_item['verificationStatus'] == 'passed'
    assert artifact_item['url'] == 'https://cdn.example.com/render.png'
    assert artifact_item['checks'] == ['opened', 'read back title']
    source_item = next(item for item in evidence if item['type'] == 'source_processing_log')
    assert source_item['reference'] == 'https://example.com/source.pdf'
    assert details['sources'][0]['url'] == 'https://example.com/source.pdf'


def test_task_mission_result_payload_normalizes_runtime_evidence_references():
    app = load_app()
    task = {
        'id': 't_example',
        'title': 'Evidence task',
        'body': 'Inspect outputs.',
        'status': 'done',
        'assignee': 'devops',
        'tenant': 'project:test',
        'created_at': '2026-06-08T08:00:00Z',
        'updated_at': '2026-06-08T08:05:00Z',
    }
    result = app.task_mission_result_payload(
        task,
        details={'summary': 'Done', 'evidence': []},
        comments=[{'author': 'devops', 'body': 'Manual check token=hidden-value', 'created_at': '2026-06-08T08:03:00Z'}],
        events=[{'kind': 'updated', 'payload': {'status': 'done', 'api_key': 'hidden-value'}, 'created_at': '2026-06-08T08:04:00Z'}],
        runs=[{'id': 17, 'status': 'completed', 'outcome': 'done', 'started_at': '2026-06-08T08:01:00Z'}],
    )

    payload = dump(result)
    assert 'hidden-value' not in payload
    assert '[REDACTED]' in payload
    assert result['evidence']
    assert any(item.get('runId') == '17' for item in result['evidence'])
    for item in result['evidence']:
        assert item.get('createdAt')
        assert item.get('type')
        assert item.get('summary') is not None
        assert item.get('reference')
