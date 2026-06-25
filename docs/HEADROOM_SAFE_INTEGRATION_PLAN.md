# Headroom Safe Integration Plan

Date: 2026-06-21
Source repo: https://github.com/chopratejas/headroom
KB source: `/root/.hermes/workspace/kb/wiki/sources/headroom-repo-evaluation-2026-06-21.md`

## Decision

Headroom is approved for **sandbox evaluation only**. It is **not approved** as a live Hermes provider proxy, global agent wrapper, or production MCP server until the benchmark and threat gates below pass.

## Why

Headroom is relevant because Hermes/HMC agents spend context on large tool outputs, logs, file excerpts, and RAG chunks. The useful pattern is reversible, measured compression with raw-evidence retrieval — not hidden lossy summarization.

## Non-negotiable safety rules

1. Do not run `headroom wrap` against live Hermes/Codex/Claude agents yet.
2. Do not put Headroom in front of production provider traffic yet.
3. Do not mount or expose:
   - `~/.hermes/.env`
   - `~/.hermes/auth.json`
   - browser profiles/cookies
   - SSH keys
   - private finance/customer data
   - live gateway session traffic
4. Use synthetic or redacted Hermes/HMC traces for Phase 1.
5. Raw tool output remains the audit source. Compressed text is only working context.
6. Any production enablement requires Andrej/dev-ops review and HMC-visible runtime policy.

## Phase 1 — offline benchmark harness

Build a local benchmark that:

- creates an isolated virtualenv under `/tmp/headroom-pilot/`;
- installs/pins `headroom-ai==0.26.0` only inside that venv;
- runs against redacted sample traces only;
- measures:
  - before/after tokens,
  - compression ratio,
  - latency,
  - retrieval completeness,
  - task-answer fidelity;
- outputs a JSON/Markdown report under `/root/.hermes/output/headroom-pilot/`.

Acceptance criteria:

- No secrets or private runtime files touched.
- No outbound network except package install in setup step; benchmark itself can run offline unless Headroom explicitly requires local model download.
- Report contains at least 5 representative trace categories: logs, JSON tool output, code excerpt, RAG chunk, long markdown/source note.
- Fidelity review flags any lost exact evidence.

## Phase 2 — explicit preview tool only

If Phase 1 passes, create a disabled-by-default Hermes/HMC preview capability:

- name: `compress_context_preview`
- input: explicit text or file path selected by the operator/agent
- output: compressed text + raw reference ID + token savings + warning
- no automatic interception
- no credential access
- no provider proxy

Acceptance criteria:

- Tool does not appear unless a config flag is enabled.
- Tool refuses paths outside approved sample/output directories by default.
- Tool labels compressed output as non-audit working context.

## Phase 3 — governed runtime integration

Only after Phase 2:

- Add HMC runtime policy controls per agent/task type.
- Default exact-evidence lanes to no compression or reversible-only compression.
- Show compression applied, savings, retrieval IDs, and fidelity checks in HMC run/task evidence.

## Explicitly out of scope for first implementation

- Headroom proxy as global OpenAI/Anthropic/Codex base URL.
- Automatic compression of Telegram/WhatsApp/gateway context.
- Compression of financial data, receipts, screenshots, credentials, or customer/private KB sources.
- Running external Docker Compose stack with Qdrant/Neo4j.

## Source-of-truth links

- KB raw evaluation: `/root/.hermes/workspace/kb/raw/notes/headroom-repo-evaluation-2026-06-21.md`
- KB source page: `/root/.hermes/workspace/kb/wiki/sources/headroom-repo-evaluation-2026-06-21.md`
- HMC project note: `/root/.hermes/workspace/kb/wiki/projects/hermes-mission-control.md`
