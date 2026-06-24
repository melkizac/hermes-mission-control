from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_backend_exposes_cron_usage_by_job_and_daily_spend():
    app = (ROOT / "backend/app.py").read_text()

    assert "def cron_usage_for_jobs" in app
    assert "def parse_cron_session_job_id" in app
    assert "usage_by_job" in app
    assert "daily_spend" in app
    assert "total_estimated_cost_usd" in app
    assert "estimated_cost_usd" in app
    assert "input_tokens" in app
    assert "output_tokens" in app


def test_routines_page_renders_usage_metrics_without_new_endpoint():
    view = (ROOT / "src/views/Automations.tsx").read_text()
    types = (ROOT / "src/types.ts").read_text()

    assert "daily_spend" in types
    assert "usage_by_job" in types
    assert "Cron spend" in view
    assert "Token use" in view
    assert "Daily spend" in view
    assert "automation.usage" in view
    assert "summary?.usage" in view
