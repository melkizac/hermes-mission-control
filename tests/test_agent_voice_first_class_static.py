from pathlib import Path

ROOT = Path('/opt/hermes-mission-control/source')
SRC = ROOT / 'src'


def read(rel):
    return (SRC / rel).read_text(encoding='utf-8')


def test_agent_voice_is_first_class_workspace_route():
    app = read('App.tsx')
    permissions = read('services/uiPermissions.ts')
    deep_links = read('services/deepLinks.ts')
    nav = read('components/NavRail.tsx')

    assert 'view === "agent-voice" && <AgentVoice />' in app
    assert 'view !== "agent-voice"' in app  # mobile must not collapse this route into chat-only mode
    assert '"agent-voice"' in permissions
    assert '"agent-voice"' in deep_links
    assert '{ key: "agent-voice", label: "Agent Voice", icon: "mic" }' in nav


def test_chat_composer_mic_opens_agent_voice_instead_of_dead_end_disabled_control():
    chat_thread = read('components/ChatThread.tsx')

    assert 'setView("agent-voice")' in chat_thread
    assert 'aria-label="Open Agent Voice visualizer"' in chat_thread
    assert 'Voice input unavailable' not in chat_thread


def test_agent_voice_declares_product_boundary_and_has_demo_qa_path():
    voice = read('views/AgentVoice.tsx')
    css = read('styles/app.css')

    assert '<h1>Agent Voice</h1>' in voice
    assert 'First-class voice workspace' in voice
    assert 'Product boundary' in voice
    assert 'Composer dictation and automatic send remain out of scope' in voice
    assert 'Demo mode' in voice
    assert 'getUserMedia' in voice
    assert '.agent-voice-page' in css
    assert 'Agent Voice mobile final overrides' in css
