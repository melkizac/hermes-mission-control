# Reliable Agent Chat Handoff

## Implemented

- SQLite delivery ledger keyed by idempotent request ID.
- Delivery states returned by the lightweight status endpoint.
- Explicit restart reconciliation to `interrupted` rather than silent loss.
- Concurrency-safe overlay persistence.
- Request-body ceiling and existing attachment ceiling verification.
- Accepted/working state in the composer.
- Installable PWA metadata and mobile safe-area/chat sizing rules.

## Run

Build with `npm.cmd run build`. Run focused regression tests with `uv run --with pytest pytest -q tests/test_reliable_agent_chat.py`.

## Before production rollout

1. Run the mobile browser check at 390 x 844 and on one real iOS/Android device.
2. Deploy behind HTTPS so the PWA and session security operate correctly.
3. Back up `chat-delivery.db` with the application state.
4. Add an external supervised worker/queue if in-flight turns must resume automatically after process death.
5. Address the previously identified arbitrary-file-download, gateway-token, and attachment-authorization security findings.
