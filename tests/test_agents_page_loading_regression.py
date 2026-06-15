from pathlib import Path

APP = Path('/opt/hermes-mission-control/app.py').read_text(encoding='utf-8')
AGENT_PAYLOAD_FN = APP[APP.index('def agent_payload('):APP.index('\n\ndef list_agents_payload', APP.index('def agent_payload('))]
LIST_AGENTS_FN = APP[APP.index('def list_agents_payload('):APP.index('\n\ndef agent_activity_connect', APP.index('def list_agents_payload('))]


def test_agent_roster_payload_is_lightweight_for_page_loads():
    assert 'message_limit=None' in AGENT_PAYLOAD_FN
    assert 'if message_limit is not None:' in AGENT_PAYLOAD_FN
    assert 'messages = messages[-int(message_limit):]' in AGENT_PAYLOAD_FN
    assert 'agent_roster_profile_ids(include_default=True)' in LIST_AGENTS_FN
    assert 'return [agent_summary_payload(profile_id, st=shared_status) for profile_id in agent_roster_profile_ids(include_default=True)]' in LIST_AGENTS_FN
    assert "agent_payload('default', st=shared_status, include_artifacts=False, message_limit=80)" not in LIST_AGENTS_FN
    assert "agent_payload('devops', st=shared_status, include_artifacts=False, message_limit=80)" not in LIST_AGENTS_FN


def test_agent_detail_payload_uses_bounded_lightweight_hot_route():
    route_section = APP[APP.index("elif parsed.path.startswith('/api/agents/'):"):APP.index("elif parsed.path == '/api/approvals':", APP.index("elif parsed.path.startswith('/api/agents/')"))]
    assert 'agent_payload(agent_id, st=agent_list_status_payload(), include_artifacts=False, chat_channel_id=chat_channel_id, identity=identity, route=route if isinstance(route, dict) else None, message_limit=160, include_runtime_details=False)' in route_section
    assert 'message_limit=80' not in route_section
