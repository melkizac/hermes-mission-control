# Plan

1. Add a SQLite delivery ledger keyed by request ID.
2. Make registration idempotent and preserve delivery state across restarts.
3. Serialize overlay read-modify-write operations.
4. Enforce HTTP request and attachment limits.
5. Expose delivery state through the lightweight message-status API and render it in chat.
6. Harden the existing mobile-only chat layout and PWA metadata.
7. Verify backend contracts, build, mobile viewport, and graph impact.
