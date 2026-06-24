# Headroom Safe Preview Proposal for Hermes/HMC

Date: 2026-06-21
Related plan: `docs/HEADROOM_SAFE_INTEGRATION_PLAN.md`
Benchmark artifacts: `/root/.hermes/output/headroom-pilot/headroom_safe_benchmark_report.md`, `/root/.hermes/output/headroom-pilot/headroom_safe_benchmark_results.json`

## Recommendation

Proceed only with a disabled-by-default explicit preview capability named `compress_context_preview`. Do not run Headroom as a global provider proxy, wrapper, production MCP server, or automatic interceptor.

The benchmark shows useful token savings on synthetic Hermes/HMC-style traces, but the integration must preserve raw references and metric evidence because compressed text is not an audit source.

## Proposed capability

`compress_context_preview` should accept exactly one of:

- explicit text supplied by the operator/agent, or
- a file path inside an approved sample/output directory.

It should return:

- compressed working-context text,
- `raw_ref_id` for retrieving the original,
- token counts before/after,
- token savings ratio,
- compression latency,
- fidelity/retrieval warnings,
- a mandatory warning: `Compressed output is working context only and must not replace raw audit evidence.`

## Default safety posture

- Feature flag: off by default, for example `HERMES_HEADROOM_PREVIEW_ENABLED=false`.
- No automatic interception of prompts, tools, gateway traffic, or provider calls.
- No `headroom wrap` in agent runtimes.
- No Headroom proxy base URL for OpenAI/Anthropic/Codex/Claude traffic.
- No production MCP registration until after review.
- No Docker Compose sidecars such as Qdrant/Neo4j for the pilot.

## Path and data restrictions

The preview tool must refuse:

- `~/.hermes/.env`
- `~/.hermes/auth.json`
- browser profiles/cookies
- SSH keys and `~/.ssh`
- finance/customer/private data paths
- live gateway/session traffic
- raw messaging exports unless explicitly redacted
- screenshots, receipts, legal/compliance source packs, or any exact-evidence artifact unless the mode is reversible-only and raw retrieval is mandatory

Approved pilot paths should be limited to:

- `/tmp/headroom-pilot/`
- `/root/.hermes/output/headroom-pilot/`
- future checked-in synthetic fixtures under the repository, if added by review

## HMC visibility requirements

HMC should surface, per preview run:

- whether compression was applied,
- which policy allowed it,
- raw reference ID,
- before/after token counts,
- latency,
- required-fact/fidelity status,
- retrieval status,
- warning that raw evidence remains canonical.

## Gates before production runtime integration

1. Offline benchmark passes on synthetic/redacted traces.
2. Andrej/dev-ops reviews the harness, policy, and artifacts.
3. Exact-evidence lanes are tagged and default to no compression or reversible-only compression.
4. A retrieval test proves raw evidence can be recovered from every compressed preview.
5. Secret/path refusal tests pass.
6. A limited operator opt-in pilot runs without live provider proxying.
7. Only after measured wins and safety review should tool-level or runtime-level compression be considered.

## Current pilot decision

Safe for sandbox preview design and further offline benchmarking. Not safe for automatic agent runtime compression or production proxying yet.
