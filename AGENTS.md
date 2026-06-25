# HMC Agent Instructions

## Graphify query-first workflow

A local, code-only Graphify graph is maintained in `graphify-out/` to reduce token-heavy repo scans.

Before broad searches or reading many files for HMC architecture questions, first query the graph:

```bash
graphify query "<question>" --graph graphify-out/graph.json --budget 1500
```

Use Graphify to narrow context, then verify important conclusions against source files/tests. Do **not** treat graph output as the final source of truth.

Good first-pass queries:

```bash
graphify query "where is the task detail drawer implemented" --graph graphify-out/graph.json --budget 1500
graphify query "what connects backend tasks to the UI" --graph graphify-out/graph.json --budget 1500
graphify path "Task" "AgentOrg" --graph graphify-out/graph.json
```

Refresh the graph after meaningful code changes:

```bash
/root/.local/share/uv/tools/graphifyy/bin/python scripts/build_hmc_graphify_graph.py
graphify cluster-only . --graph graphify-out/graph.json --no-label --no-viz
```

This HMC graph is intentionally code-only: it excludes docs, generated bundles, uploaded assets, runtime DB/state, and images so refreshes use local AST extraction only and require no LLM/API semantic extraction.

## HMC UI guidance query-first workflow

A curated HMC UI decision library lives at `docs/HMC_UI_DECISION_LIBRARY.md` with a local search helper:

```bash
python3 scripts/hmc_ui_guidance.py "<screen or UI change>"
python3 scripts/hmc_ui_guidance.py --screen task-drawer
python3 scripts/hmc_ui_guidance.py --screen model-router
```

Before changing Mission Control UI, query this guidance for the target screen/change and apply its acceptance checklist. This is the HMC-specific adaptation of useful ideas from `nextlevelbuilder/ui-ux-pro-max-skill`; do **not** install the external skill/CLI wholesale or import its generic design aesthetics.

Use the guidance especially for task/detail drawers, dashboards, model routing, approval queues, workflow/routine drawers, dense tables/logs, agent roster/capability pages, memory/knowledge pages, navigation, and mobile chat/voice surfaces. Verify final changes against source/tests/browser behavior; the guidance narrows decisions but is not a substitute for real implementation verification.
