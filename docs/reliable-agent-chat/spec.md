# Reliable Agent Chat Specification

## Intent

Make Hermes Mission Control the primary operator-to-agent communication surface on desktop and mobile, with explicit delivery state and recovery from browser or backend interruption.

## Acceptance criteria

- An accepted message has a stable request ID and durable delivery record.
- Repeating the same request ID does not execute the agent twice.
- Concurrent agent replies cannot overwrite one another.
- A backend restart never silently drops an accepted request; interrupted work is visible and retryable.
- Request bodies and attachments have enforced size limits.
- Chat remains usable at a 390 x 844 mobile viewport with safe-area-aware composer controls.
- The app is installable as a standalone PWA shell.

## Non-goals

- Claiming mathematical 100% availability.
- Multi-region failover or external managed queue infrastructure in this local-first loop.
- Replacing the Hermes runtime's own persistence model.

## Evidence

Backend regression tests, frontend build, feature-contract check, mobile browser screenshot, API/source inspection, and Graphify refresh.
