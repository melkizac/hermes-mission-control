from pathlib import Path
import importlib.util
import json
import sys

SRC = Path('/opt/hermes-mission-control/source')
JOB = SRC / 'scripts' / 'browser_funnel_check_job.py'


def read(path):
    return Path(path).read_text(encoding='utf-8')


def load_job():
    spec = importlib.util.spec_from_file_location('hmc_browser_funnel_check_job', JOB)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class FakeProducer:
    def __init__(self, commands_by_poll=None):
        self.calls = []
        self.commands_by_poll = list(commands_by_poll or [])

    def poll_controls(self):
        self.calls.append(('poll_controls',))
        if self.commands_by_poll:
            return self.commands_by_poll.pop(0)
        return {'commands': []}


class FakeTaskClient:
    def __init__(self):
        self.created = []
        self.updated = []

    def create_task(self, payload):
        self.created.append(payload)
        return {'ok': True, 'task': {'id': payload.get('id') or 'task-created'}}

    def update_task(self, task_id, payload):
        self.updated.append((task_id, payload))
        return {'ok': True, 'task': {'id': task_id, **payload}}


def test_phase14_job_file_exists_and_documents_production_contract():
    assert JOB.exists(), 'Phase 14 should add scripts/browser_funnel_check_job.py'
    text = read(JOB)
    for needle in [
        'class MissionControlTaskClient',
        'class FunnelCheckTarget',
        'def load_targets',
        'def run_target',
        'def run_batch',
        'create_task',
        'update_task',
        'browser_funnel_check_probe',
        'poll_for_operator_command',
        'NO_SUBMIT',
    ]:
        assert needle in text


def test_phase14_load_targets_supports_json_list_and_single_dict(tmp_path):
    job = load_job()
    config = tmp_path / 'targets.json'
    config.write_text(json.dumps([
        {'label': 'Contact form', 'url': 'https://example.com/contact', 'project': 'Demo', 'expected': 'lead capture form'},
        {'label': 'Pricing CTA', 'url': 'https://example.org/pricing'},
    ]))
    targets = job.load_targets(config)
    assert [t.label for t in targets] == ['Contact form', 'Pricing CTA']
    assert targets[0].project == 'Demo'
    assert targets[0].expected == 'lead capture form'
    single = tmp_path / 'single.json'
    single.write_text(json.dumps({'label': 'Single', 'url': 'https://example.net'}))
    assert job.load_targets(single)[0].label == 'Single'


def test_phase14_result_payload_has_task_evidence_approval_gate_and_next_action():
    job = load_job()
    target = job.FunnelCheckTarget(label='Contact form', url='https://example.com/contact', project='Demo', expected='lead capture form')
    summary = {
        'status': 'blocked_before_submit',
        'finalUrl': 'https://example.com/contact',
        'domain': 'example.com',
        'screenshotPath': '/tmp/shot.png',
        'formsDetected': 1,
        'submitCandidates': 1,
        'noSubmit': True,
    }
    payload = job.task_result_payload(target, summary, 'session-1')
    assert payload['status'] == 'blocked'
    assert payload['summary'].startswith('Safe browser funnel check')
    assert payload['evidence'][0]['kind'] == 'browser-session'
    assert any(item.get('kind') == 'screenshot' and item.get('path') == '/tmp/shot.png' for item in payload['evidence'])
    assert payload['approval_gates'][0]['status'] == 'pending'
    assert 'Review Browser Activity' in payload['next_actions'][0]
    assert payload['verification']['NO_SUBMIT'] == 'true'


def test_phase14_run_target_creates_task_runs_probe_and_updates_result(monkeypatch, tmp_path):
    job = load_job()
    target = job.FunnelCheckTarget(label='Contact form', url='https://example.com/contact', project='Demo', expected='lead capture form')
    task_client = FakeTaskClient()
    producer = FakeProducer()
    summary = {
        'ok': True,
        'status': 'blocked_before_submit',
        'finalUrl': 'https://example.com/contact',
        'domain': 'example.com',
        'screenshotPath': str(tmp_path / 'shot.png'),
        'formsDetected': 1,
        'submitCandidates': 1,
        'noSubmit': True,
    }
    monkeypatch.setattr(job, 'build_producer', lambda session_id, task_id=None: producer)
    monkeypatch.setattr(job, 'run_funnel_check', lambda url, producer, screenshot_dir, timeout_ms: summary)

    result = job.run_target(target, task_client=task_client, screenshot_dir=tmp_path, batch_id='batch-1', timeout_ms=1000)

    assert result['status'] == 'blocked_before_submit'
    assert task_client.created[0]['status'] == 'running'
    assert task_client.created[0]['tenant'] == 'Demo'
    assert task_client.created[0]['id'] == result['taskId']
    assert task_client.updated[-1][0] == result['taskId']
    assert task_client.updated[-1][1]['status'] == 'blocked'
    updated_result = json.loads(task_client.updated[-1][1]['result'])
    assert updated_result['evidence'][0]['sourceId'] == result['sessionId']
    assert [c[0] for c in producer.calls].count('poll_controls') >= 2


def test_phase14_run_target_honors_stop_command_before_probe(monkeypatch, tmp_path):
    job = load_job()
    target = job.FunnelCheckTarget(label='Stop me', url='https://example.com/contact')
    task_client = FakeTaskClient()
    producer = FakeProducer(commands_by_poll=[{'commands': [{'type': 'stop'}], 'status': 'stopped'}])
    called = {'probe': False}
    monkeypatch.setattr(job, 'build_producer', lambda session_id, task_id=None: producer)
    def fake_probe(*args, **kwargs):
        called['probe'] = True
        return {}
    monkeypatch.setattr(job, 'run_funnel_check', fake_probe)

    result = job.run_target(target, task_client=task_client, screenshot_dir=tmp_path, batch_id='batch-stop', timeout_ms=1000)

    assert result['status'] == 'stopped_by_operator'
    assert called['probe'] is False
    assert task_client.updated[-1][1]['status'] == 'blocked'
    assert 'Operator stop/takeover command' in task_client.updated[-1][1]['result']


def test_phase14_run_batch_returns_all_targets(monkeypatch, tmp_path):
    job = load_job()
    targets = [job.FunnelCheckTarget(label='A', url='https://example.com/a'), job.FunnelCheckTarget(label='B', url='https://example.com/b')]
    monkeypatch.setattr(job, 'run_target', lambda target, **kwargs: {'label': target.label, 'status': 'blocked_before_submit'})
    result = job.run_batch(targets, task_client=FakeTaskClient(), screenshot_dir=tmp_path, batch_id='batch')
    assert result['ok'] is True
    assert result['total'] == 2
    assert [item['label'] for item in result['results']] == ['A', 'B']
