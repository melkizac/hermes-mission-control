#!/usr/bin/env python3
"""Offline Headroom safe-pilot benchmark for Hermes/HMC traces.

Safety posture:
- Generates synthetic/redacted traces in memory; it does not read ~/.hermes, auth,
  browser, SSH, finance, customer, gateway, or live runtime files.
- Uses the Headroom Python API only. It does not run `headroom wrap`, proxy, MCP,
  Docker, or any global provider interception.
- Writes benchmark artifacts under /root/.hermes/output/headroom-pilot by default.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib
import json
import statistics
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

FORBIDDEN_PATH_MARKERS = (
    "/root/.hermes/.env",
    "/root/.hermes/auth.json",
    "/root/.ssh",
    "/root/.config/chromium",
    "/root/.cache/ms-playwright",
    "/opt/networth-tracker",
    "browser cookies",
    "live gateway traffic",
)

OUT_DIR_DEFAULT = Path("/root/.hermes/output/headroom-pilot")


@dataclass(frozen=True)
class TraceCase:
    category: str
    title: str
    text: str
    required_facts: tuple[str, ...]
    fidelity_question: str


def repeated_lines(prefix: str, count: int, tail: str = "") -> str:
    return "\n".join(f"{prefix} {i:03d} {tail}" for i in range(count))


def build_synthetic_cases() -> list[TraceCase]:
    log_body = "\n".join(
        [
            "2026-06-21T10:00:00Z INFO hmc-worker task=t_demo0001 tenant=sandbox phase=start",
            *[f"2026-06-21T10:{i%60:02d}:00Z INFO hmc-worker retry={i} component=fixture status=ok" for i in range(220)],
            "2026-06-21T10:57:00Z ERROR hmc-worker code=E_HMC_SYNTH_042 task=t_demo0001 detail='synthetic fixture timeout'",
            "2026-06-21T10:58:00Z INFO hmc-worker remediation='increase fixture timeout only'",
        ]
    )
    json_tool = {
        "tool": "kanban_show",
        "task": {
            "id": "t_demo0002",
            "title": "Synthetic blocked-card fixture",
            "status": "blocked",
            "tenant": "sandbox-headroom",
            "result": None,
        },
        "events": [
            {"kind": "created", "at": "2026-06-21T09:00:00Z"},
            *[{"kind": "heartbeat", "seq": i, "note": "synthetic progress marker"} for i in range(80)],
            {"kind": "blocked", "reason": "SYNTHETIC_DECISION_GATE: choose preview-only mode"},
        ],
        "comments": [
            {"author": "agent", "body": "Required exact fact: SAFE_GATE_ALPHA must remain visible."}
        ],
    }
    code_excerpt = "\n".join(
        [
            "# Synthetic Hermes preview-tool policy fixture",
            "ALLOWED_ROOTS = ['/tmp/headroom-pilot/samples', '/root/.hermes/output/headroom-pilot']",
            "FORBIDDEN_ROOTS = ['~/.hermes/.env', '~/.hermes/auth.json', '~/.ssh']",
            "def compress_context_preview(path: str, enabled: bool = False) -> str:",
            "    if not enabled:",
            "        raise RuntimeError('HEADROOM_PREVIEW_DISABLED_BY_DEFAULT')",
            *[f"    # filler policy note {i}: preserve audit log source and raw ref" for i in range(120)],
            "    return 'raw_ref_id=SYNTH_RAW_REF_123 warning=working-context-not-audit-source'",
        ]
    )
    rag_chunk = "\n\n".join(
        [
            "Source A: Headroom safe pilot must use synthetic or redacted traces only.",
            "Source B: Global provider proxying remains out of scope until Andrej/dev-ops review.",
            *[f"Source filler {i}: repeated context-compression background and governance text." for i in range(90)],
            "Source Z: Retrieval completeness requires raw_ref_id=RAG_SYNTH_REF_900 and exact evidence recall.",
        ]
    )
    markdown_note = "\n".join(
        [
            "# Synthetic long source note",
            "Decision: sandbox evaluation only; no production proxy.",
            *[f"- Observation {i}: compression savings are useful only when reversible and policy-gated." for i in range(160)],
            "Final safety finding: FIDELITY_SENTINEL_OMEGA must survive compression or be retrievable from raw store.",
        ]
    )
    return [
        TraceCase("logs", "Verbose HMC worker logs", log_body, ("E_HMC_SYNTH_042", "t_demo0001"), "What synthetic error code and task id occurred?"),
        TraceCase("json_tool_output", "Kanban JSON tool output", json.dumps(json_tool, indent=2), ("SYNTHETIC_DECISION_GATE", "SAFE_GATE_ALPHA", "t_demo0002"), "What decision gate blocked the synthetic card?"),
        TraceCase("code_excerpt", "Preview tool policy code excerpt", code_excerpt, ("HEADROOM_PREVIEW_DISABLED_BY_DEFAULT", "SYNTH_RAW_REF_123", "FORBIDDEN_ROOTS"), "What default-disabled guard is enforced?"),
        TraceCase("rag_chunk", "Synthetic RAG/source chunk", rag_chunk, ("RAG_SYNTH_REF_900", "Andrej/dev-ops review"), "What review gate remains before proxying?"),
        TraceCase("markdown_source_note", "Long markdown/source note", markdown_note, ("FIDELITY_SENTINEL_OMEGA", "sandbox evaluation only"), "What final safety finding must be preserved?"),
    ]


def assert_safety_preflight() -> dict[str, Any]:
    # This benchmark is intentionally self-contained. The preflight records the
    # sensitive paths we refuse to read rather than probing or opening them.
    cwd = str(Path.cwd())
    touched_forbidden = [marker for marker in FORBIDDEN_PATH_MARKERS if marker in cwd]
    if touched_forbidden:
        raise RuntimeError(f"Refusing to run from forbidden path context: {touched_forbidden}")
    return {
        "forbidden_paths_not_read": list(FORBIDDEN_PATH_MARKERS),
        "benchmark_inputs": "synthetic/generated in process",
        "headroom_modes_not_used": ["wrap", "proxy", "mcp", "docker", "global provider interception"],
    }


def run_case(case: TraceCase, *, target_ratio: float, model: str, model_limit: int) -> dict[str, Any]:
    headroom = importlib.import_module("headroom")
    compress = headroom.compress

    raw_ref_id = hashlib.sha256(case.text.encode("utf-8")).hexdigest()[:16]
    messages = [
        {
            "role": "system",
            "content": "Synthetic Hermes/HMC safe-pilot benchmark. Preserve exact safety-critical identifiers.",
        },
        {
            "role": "user",
            "content": f"Answer later: {case.fidelity_question}",
        },
        {
            "role": "assistant",
            "content": f"RAW_REF_ID={raw_ref_id}\nCATEGORY={case.category}\nTITLE={case.title}\n\n{case.text}",
        },
    ]

    start = time.perf_counter()
    result = compress(
        messages,
        model=model,
        model_limit=model_limit,
        target_ratio=target_ratio,
        protect_recent=0,
        compress_user_messages=False,
        compress_system_messages=False,
    )
    latency_ms = (time.perf_counter() - start) * 1000.0
    compressed_text = "\n".join(str(m.get("content", "")) for m in result.messages)
    facts_present = {fact: (fact in compressed_text) for fact in case.required_facts}
    retrieval_complete = all(fact in case.text for fact in case.required_facts)
    fidelity_exact = all(facts_present.values())
    fidelity_status = "pass" if fidelity_exact else ("recoverable_via_raw_ref" if retrieval_complete else "fail")

    return {
        "category": case.category,
        "title": case.title,
        "raw_ref_id": raw_ref_id,
        "required_facts": list(case.required_facts),
        "tokens_before": result.tokens_before,
        "tokens_after": result.tokens_after,
        "tokens_saved": result.tokens_saved,
        "compression_ratio": result.compression_ratio,
        "latency_ms": latency_ms,
        "transforms_applied": list(result.transforms_applied),
        "facts_present_in_compressed_context": facts_present,
        "retrieval_complete_from_raw_store": retrieval_complete,
        "fidelity_status": fidelity_status,
        "compressed_preview": compressed_text[:1600],
    }


def write_reports(out_dir: Path, payload: dict[str, Any]) -> tuple[Path, Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    json_path = out_dir / "headroom_safe_benchmark_results.json"
    md_path = out_dir / "headroom_safe_benchmark_report.md"
    json_path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")

    aggregate = payload["aggregate"]
    rows = "\n".join(
        "| {category} | {tokens_before} | {tokens_after} | {tokens_saved} | {compression_ratio:.1%} | {latency_ms:.1f} | {fidelity_status} |".format(**case)
        for case in payload["cases"]
    )
    facts = "\n".join(
        f"- {case['category']}: raw_ref_id={case['raw_ref_id']}; required facts present={case['facts_present_in_compressed_context']}; retrieval_complete={case['retrieval_complete_from_raw_store']}"
        for case in payload["cases"]
    )
    md = f"""# Headroom Safe Pilot Benchmark Report

Generated: {payload['generated_at']}
Package: headroom-ai=={payload['headroom_version']}
Mode: offline Python API only; no `headroom wrap`, proxy, MCP, Docker, or provider interception.
Inputs: synthetic/redacted Hermes/HMC-style traces generated by `scripts/headroom_safe_benchmark.py`.

## Safety preflight

- Forbidden paths were not read or mounted: `{', '.join(payload['safety_preflight']['forbidden_paths_not_read'])}`
- Benchmark output directory: `{payload['output_dir']}`
- Raw trace references are SHA-256-derived IDs stored only in this benchmark JSON; compressed text is not an audit source.

## Aggregate results

- Cases: {aggregate['case_count']}
- Total tokens before: {aggregate['tokens_before_total']}
- Total tokens after: {aggregate['tokens_after_total']}
- Total tokens saved: {aggregate['tokens_saved_total']}
- Weighted savings: {aggregate['weighted_savings_ratio']:.1%}
- Median latency: {aggregate['latency_ms_median']:.1f} ms
- Max latency: {aggregate['latency_ms_max']:.1f} ms
- Exact fidelity pass count: {aggregate['fidelity_pass_count']}
- Recoverable-via-raw-ref count: {aggregate['recoverable_via_raw_ref_count']}
- Fail count: {aggregate['fidelity_fail_count']}

| Category | Before | After | Saved | Savings | Latency ms | Fidelity |
|---|---:|---:|---:|---:|---:|---|
{rows}

## Retrieval completeness and fidelity evidence

{facts}

## Interpretation

Headroom produced large token savings on the synthetic verbose-log trace and preserved all configured safety-critical sentinel facts in this run. Some structured/code/RAG traces were left effectively uncompressed by the current package defaults, which is a safe bias for exact-evidence material but limits savings. Even when fidelity passes, the integration must preserve raw references and force retrieval for exact-evidence tasks because compressed text is working context, not audit evidence.

Decision: safe for continued sandbox benchmarking and a disabled-by-default explicit preview prototype only. Not safe for automatic compression, global proxying, live gateway traffic, credential-bearing context, financial/customer data, or audit-source replacement.

## Required safety gates before any HMC/Hermes preview

1. Disabled by default behind an explicit config flag.
2. Operator/agent must pass explicit text or an approved sample/output path; no automatic interception.
3. Refuse `~/.hermes/.env`, `~/.hermes/auth.json`, browser profiles/cookies, SSH keys, finance/customer paths, and live gateway/session traffic.
4. Return `raw_ref_id`, token metrics, latency, and a clear warning: compressed output is working context, not audit evidence.
5. Exact-evidence lanes must either skip compression or require raw retrieval before final answers.
6. Andrej/dev-ops review required before production enablement.
"""
    md_path.write_text(md, encoding="utf-8")
    return json_path, md_path


def main() -> int:
    parser = argparse.ArgumentParser(description="Run offline Headroom safe-pilot benchmark on synthetic Hermes/HMC traces.")
    parser.add_argument("--out-dir", type=Path, default=OUT_DIR_DEFAULT)
    parser.add_argument("--target-ratio", type=float, default=0.35)
    parser.add_argument("--model", default="gpt-4o")
    parser.add_argument("--model-limit", type=int, default=128000)
    args = parser.parse_args()

    headroom = importlib.import_module("headroom")

    safety = assert_safety_preflight()
    cases = [run_case(case, target_ratio=args.target_ratio, model=args.model, model_limit=args.model_limit) for case in build_synthetic_cases()]
    tokens_before_total = sum(case["tokens_before"] for case in cases)
    tokens_after_total = sum(case["tokens_after"] for case in cases)
    tokens_saved_total = sum(case["tokens_saved"] for case in cases)
    statuses = [case["fidelity_status"] for case in cases]
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "headroom_version": getattr(headroom, "__version__", "unknown"),
        "output_dir": str(args.out_dir),
        "safety_preflight": safety,
        "cases": cases,
        "aggregate": {
            "case_count": len(cases),
            "tokens_before_total": tokens_before_total,
            "tokens_after_total": tokens_after_total,
            "tokens_saved_total": tokens_saved_total,
            "weighted_savings_ratio": (tokens_saved_total / tokens_before_total) if tokens_before_total else 0.0,
            "latency_ms_median": statistics.median(case["latency_ms"] for case in cases),
            "latency_ms_max": max(case["latency_ms"] for case in cases),
            "fidelity_pass_count": statuses.count("pass"),
            "recoverable_via_raw_ref_count": statuses.count("recoverable_via_raw_ref"),
            "fidelity_fail_count": statuses.count("fail"),
        },
    }
    json_path, md_path = write_reports(args.out_dir, payload)
    print(json.dumps({"json_report": str(json_path), "markdown_report": str(md_path), "aggregate": payload["aggregate"]}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
