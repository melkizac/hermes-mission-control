from pathlib import Path
import importlib.util
import sys

ROOT = Path('/opt/hermes-mission-control')
SRC = ROOT / 'source'
PROBE = SRC / 'scripts' / 'browser_funnel_check_probe.py'
HELPER = SRC / 'scripts' / 'browser_funnel_check_playwright.cjs'


def read(path):
    return Path(path).read_text(encoding='utf-8')


def load_probe():
    spec = importlib.util.spec_from_file_location('hmc_browser_funnel_check_probe', PROBE)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class FakeProducer:
    def __init__(self):
        self.calls = []

    def session_started(self, title, url):
        self.calls.append(('session_started', title, url))
        return {'ok': True}

    def navigated(self, url, title=None, summary=None):
        self.calls.append(('navigated', url, title, summary))
        return {'ok': True}

    def screenshot_captured(self, url=None, path=None, title='Browser screenshot', summary=None):
        self.calls.append(('screenshot_captured', url, path, title, summary))
        return {'ok': True}

    def final_evidence(self, url=None, title='Final browser evidence', summary=None):
        self.calls.append(('final_evidence', url, title, summary))
        return {'ok': True}

    def before_external_action(self, action_type, url=None, title=None, summary=None):
        self.calls.append(('before_external_action', action_type, url, title, summary))
        return {'requiresApproval': True}

    def poll_controls(self):
        self.calls.append(('poll_controls',))
        return {'commands': []}


def test_phase13_probe_and_playwright_helper_exist_and_import_producer():
    assert PROBE.exists(), 'Phase 13 should add scripts/browser_funnel_check_probe.py'
    assert HELPER.exists(), 'Phase 13 should add scripts/browser_funnel_check_playwright.cjs'
    probe_text = read(PROBE)
    helper_text = read(HELPER)
    for needle in [
        'from browser_runtime_producer import BrowserRuntimeProducer, MissionControlEventClient',
        'def run_funnel_check',
        'def ensure_safe_target',
        'before_external_action("submit"',
        'final_evidence',
        'poll_controls',
        'NO_SUBMIT',
    ]:
        assert needle in probe_text
    for needle in ['require("playwright")', 'chromium.launch', 'page.goto', 'page.screenshot', 'forms.length']:
        assert needle in helper_text


def test_phase13_safe_target_guard_blocks_dangerous_or_account_sensitive_urls():
    probe = load_probe()
    for url in [
        'https://www.linkedin.com/feed/',
        'https://accounts.google.com/',
        'http://localhost:19080/app',
        'file:///etc/passwd',
    ]:
        try:
            probe.ensure_safe_target(url)
        except ValueError as exc:
            assert 'safe public website funnel check' in str(exc)
        else:
            raise AssertionError(f'{url} should be blocked by safe target guard')
    assert probe.ensure_safe_target('https://example.com/contact') == 'https://example.com/contact'


def test_phase13_probe_emits_real_browser_sequence_and_never_submits(monkeypatch, tmp_path):
    probe = load_probe()
    fake = FakeProducer()
    result = {
        'ok': True,
        'url': 'https://example.com/contact',
        'finalUrl': 'https://example.com/contact',
        'domain': 'example.com',
        'title': 'Example contact',
        'screenshotPath': str(tmp_path / 'shot.png'),
        'forms': [{'action': '/contact', 'method': 'post', 'inputs': 3}],
        'submitCandidates': 1,
        'noSubmit': True,
    }
    monkeypatch.setattr(probe, 'run_playwright_probe', lambda url, screenshot_dir, timeout_ms: result)

    summary = probe.run_funnel_check(
        url='https://example.com/contact',
        producer=fake,
        screenshot_dir=tmp_path,
        timeout_ms=1000,
    )

    call_names = [call[0] for call in fake.calls]
    assert call_names == [
        'session_started',
        'poll_controls',
        'navigated',
        'screenshot_captured',
        'final_evidence',
        'before_external_action',
    ]
    assert fake.calls[-1][1] == 'submit'
    assert summary['status'] == 'blocked_before_submit'
    assert summary['noSubmit'] is True
    assert summary['formsDetected'] == 1
    assert summary['submitCandidates'] == 1


def test_phase13_probe_completes_without_submit_gate_when_no_forms(monkeypatch, tmp_path):
    probe = load_probe()
    fake = FakeProducer()
    monkeypatch.setattr(probe, 'run_playwright_probe', lambda url, screenshot_dir, timeout_ms: {
        'ok': True,
        'url': 'https://example.com/',
        'finalUrl': 'https://example.com/',
        'domain': 'example.com',
        'title': 'Example',
        'screenshotPath': str(tmp_path / 'shot.png'),
        'forms': [],
        'submitCandidates': 0,
        'noSubmit': True,
    })

    summary = probe.run_funnel_check('https://example.com/', producer=fake, screenshot_dir=tmp_path, timeout_ms=1000)

    assert 'before_external_action' not in [call[0] for call in fake.calls]
    assert summary['status'] == 'completed_no_form_submit_boundary'
    assert summary['noSubmit'] is True
