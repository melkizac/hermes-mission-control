from pathlib import Path
import importlib.util
import json
import sys

ROOT = Path('/opt/hermes-mission-control')
SRC = ROOT / 'source'
PRODUCER = SRC / 'scripts' / 'browser_runtime_producer.py'


def read(path):
    return Path(path).read_text(encoding='utf-8')


def load_producer():
    spec = importlib.util.spec_from_file_location('hmc_browser_runtime_producer', PRODUCER)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class FakeMissionControlClient:
    def __init__(self):
        self.events = []
        self.commands = []

    def post_event(self, event):
        self.events.append(event)
        return {'ok': True, 'session': event}

    def poll_control(self, session_id):
        self.commands.append(('poll_control', session_id))
        return {'sessionId': session_id, 'commands': [{'type': 'stop', 'status': 'requested'}]}


def test_phase12_producer_module_exists_with_event_client_contract():
    assert PRODUCER.exists(), 'Phase 12 should add scripts/browser_runtime_producer.py'
    text = read(PRODUCER)
    for needle in [
        'class BrowserRuntimeProducer',
        'def session_started',
        'def navigated',
        'def screenshot_captured',
        'def before_external_action',
        'def final_evidence',
        'def poll_controls',
        'POST /api/browser-sessions/events',
        'not-found',
    ]:
        assert needle in text


def test_phase12_producer_derives_domains_and_emits_navigation_screenshot_and_final_evidence():
    producer_mod = load_producer()
    client = FakeMissionControlClient()
    producer = producer_mod.BrowserRuntimeProducer(
        client=client,
        session_id='browserbase-run-123',
        runtime_id='browserbase',
        runtime_label='Browserbase cloud browser',
        agent_id='linkedin-growth',
        agent_name='LinkedIn Growth',
        task_id='task-browser-123',
    )

    producer.session_started('LinkedIn browser research', 'https://www.linkedin.com/feed/')
    producer.navigated('https://www.linkedin.com/company/nexius-labs/')
    producer.screenshot_captured(url='https://evidence.example/s1.png', title='LinkedIn company page screenshot')
    producer.final_evidence(url='https://www.linkedin.com/company/nexius-labs/', title='Final browser URL')

    assert len(client.events) == 4
    assert client.events[0]['status'] == 'active'
    assert client.events[0]['currentDomain'] == 'linkedin.com'
    assert client.events[1]['action']['type'] == 'navigation'
    assert client.events[2]['screenshot']['url'] == 'https://evidence.example/s1.png'
    assert client.events[3]['status'] == 'completed'
    assert client.events[3]['finalEvidence']['url'] == 'https://www.linkedin.com/company/nexius-labs/'
    assert all(event['sessionId'] == 'browserbase-run-123' for event in client.events)
    assert all(event['taskId'] == 'task-browser-123' for event in client.events)


def test_phase12_external_submit_post_send_purchase_actions_pause_and_request_approval():
    producer_mod = load_producer()
    client = FakeMissionControlClient()
    producer = producer_mod.BrowserRuntimeProducer(client=client, session_id='approval-run-1', runtime_id='browserbase')

    for action_type in ['submit', 'post', 'send', 'purchase']:
        response = producer.before_external_action(
            action_type,
            url=f'https://example.com/{action_type}',
            title=f'Attempted {action_type}',
            summary='Agent reached an external-facing browser boundary.',
        )
        assert response['requiresApproval'] is True
        event = client.events[-1]
        assert event['status'] == 'blocked'
        assert event['approvalRequired'] is True
        assert event['action']['type'] == action_type
        assert event['action']['approvalRequired'] is True
        assert 'approval' in event['approvalReason'].lower()


def test_phase12_producer_can_poll_stop_takeover_controls_without_claiming_execution():
    producer_mod = load_producer()
    client = FakeMissionControlClient()
    producer = producer_mod.BrowserRuntimeProducer(client=client, session_id='control-run-1')

    controls = producer.poll_controls()

    assert client.commands == [('poll_control', 'control-run-1')]
    assert controls['commands'][0]['type'] == 'stop'
    assert controls['commands'][0]['status'] == 'requested'


def test_phase12_event_client_treats_missing_session_poll_as_no_controls():
    producer_mod = load_producer()

    class MissingSessionClient(producer_mod.MissionControlEventClient):
        def __init__(self):
            self._authenticated = False
        def authenticate(self):
            self._authenticated = True
        def _request(self, path, method='GET', payload=None):
            class NotFound(Exception):
                code = 404
            raise NotFound('missing')

    client = MissingSessionClient()
    controls = client.poll_control('new-session-before-first-event')

    assert controls == {'sessionId': 'new-session-before-first-event', 'commands': [], 'status': 'not-found'}
