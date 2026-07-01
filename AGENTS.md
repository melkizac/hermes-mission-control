# HMC Agent Instructions

## Engineering loop

Use this loop for HMC implementation, debugging, and review work. Keep it visible in the final response when the task involves code, tests, workflow behavior, or product-facing UI.

1. Clarify the work with Spec Kit-style thinking when the request is product-shaped, ambiguous, risky, or approval-sensitive: capture intent, acceptance criteria, non-goals, assumptions, and required evidence before execution.
2. Query Graphify before broad code searches or architecture claims. Use the graph to narrow likely files and relationships, then verify important conclusions against source files and tests.
3. For bugs, follow a diagnosis loop: reproduce the failure, isolate the smallest cause, form a hypothesis, instrument or inspect evidence, fix narrowly, and add or update a regression check when practical.
4. For features, prefer a test-first or contract-first path when practical: define or update the relevant test, feature contract, acceptance check, or static guard before broad implementation.
5. Apply Ponytail-lite scope discipline: make the smallest reversible change that satisfies the acceptance criteria, reuse existing HMC patterns, avoid new abstractions until they remove proven complexity, and preserve complete operator/admin workflows.
6. Verify with the strongest relevant checks available for the change: unit tests, targeted pytest files, `npm run check:feature-contract`, `npm run build`, browser checks, or command/output evidence. If a check cannot run, state why and use the best available substitute.
7. Score the result from 1-10 before stopping. A score above 9 means the change is implemented, verified, scoped, and documented well enough for handoff. If the score is 9 or lower, keep iterating: identify the biggest gap, improve it, rerun the relevant check, and score again.
8. Refresh Graphify after meaningful source changes that alter architecture, major call paths, shared models, or workflow surfaces.

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
