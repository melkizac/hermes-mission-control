from pathlib import Path

SRC = Path('/opt/hermes-mission-control/source/src')


def read(rel):
    return (SRC / rel).read_text(encoding='utf-8')


def test_me_identity_loads_before_optional_dashboard_payloads():
    store = read('services/store.tsx')

    assert 'const nextMe = await client.getMe();' in store
    assert 'setMe(nextMe);' in store
    assert 'Promise.allSettled([client.listAgents(), client.listApprovals()])' in store
    assert 'agentsResult.status === "fulfilled" ? agentsResult.value : []' in store
    assert 'approvalsResult.status === "fulfilled" ? approvalsResult.value : []' in store
