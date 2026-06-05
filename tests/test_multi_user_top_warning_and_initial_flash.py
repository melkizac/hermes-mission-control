from pathlib import Path

SRC = Path('/opt/hermes-mission-control/source/src')


def read(rel):
    return (SRC / rel).read_text(encoding='utf-8')


def test_dashboard_top_warning_pill_removed_because_bell_owns_attention_count():
    chat = read('views/MissionControl.tsx')
    dashboard = read('views/Dashboard.tsx')

    assert 'safe-pill' not in dashboard
    assert 'safe-pill' not in chat
    assert 'healthWarnings.length ? `${healthWarnings.length} warning' not in dashboard
    assert '<section className="attention-strip cockpit-alerts">' in dashboard
    assert '<section className="attention-strip cockpit-alerts">' not in chat


def test_shell_gates_authenticated_ui_until_identity_is_loaded_to_prevent_old_ui_flash():
    app = read('App.tsx')
    store = read('services/store.tsx')

    assert 'const { view, setView, me, loading } = useStore();' in app
    assert 'if (loading && !me)' in app
    assert 'app-loading-screen' in app
    assert 'const [loading, setLoading] = useState(true);' in store


def test_needs_attention_bell_computes_full_attention_signal_not_approval_count_only():
    app = read('App.tsx')

    assert 'const [attentionCount, setAttentionCount] = useState(0);' in app
    assert 'loadAttentionCount' in app
    assert '/api/status' in app
    assert '/api/inbox' in app
    assert '/api/task-board' in app
    assert '/api/automations' in app
    assert 'blockedTasks' in app
    assert 'failedRoutines' in app
    assert 'apiOk' in app
    assert 'gatewayOk' in app
    assert 'const attentionCount = approvals.length;' not in app
