from pathlib import Path


ROOT = Path("/opt/hermes-mission-control/source")
SCRIPT = ROOT / "scripts" / "headroom_safe_benchmark.py"
PLAN = ROOT / "docs" / "HEADROOM_SAFE_INTEGRATION_PLAN.md"
PROPOSAL = ROOT / "docs" / "HEADROOM_SAFE_PREVIEW_PROPOSAL.md"


def test_headroom_benchmark_is_offline_synthetic_and_blocks_proxy_wrap_modes():
    text = SCRIPT.read_text(encoding="utf-8")

    assert "build_synthetic_cases" in text
    assert "headroom_modes_not_used" in text
    assert '"wrap"' in text
    assert '"proxy"' in text
    assert '"mcp"' in text
    assert "global provider interception" in text
    assert "subprocess" not in text
    assert "os.environ" not in text
    assert "/root/.hermes/.env" in text
    assert "/root/.hermes/auth.json" in text
    assert "/root/.ssh" in text


def test_headroom_benchmark_reports_required_metrics_and_raw_reference_fidelity():
    text = SCRIPT.read_text(encoding="utf-8")

    for metric in [
        "tokens_before",
        "tokens_after",
        "tokens_saved",
        "compression_ratio",
        "latency_ms",
        "retrieval_complete_from_raw_store",
        "fidelity_status",
        "raw_ref_id",
    ]:
        assert metric in text

    for category in ["logs", "json_tool_output", "code_excerpt", "rag_chunk", "markdown_source_note"]:
        assert category in text


def test_headroom_plan_and_proposal_preserve_disabled_preview_only_policy():
    plan = PLAN.read_text(encoding="utf-8")
    proposal = PROPOSAL.read_text(encoding="utf-8")
    combined = plan + "\n" + proposal

    assert "sandbox evaluation only" in combined
    assert "disabled-by-default" in combined
    assert "compress_context_preview" in combined
    assert "Do not run `headroom wrap`" in combined
    assert "Do not put Headroom in front of production provider traffic" in combined
    assert "Compressed output is working context only" in combined
    assert "Andrej/dev-ops" in combined
