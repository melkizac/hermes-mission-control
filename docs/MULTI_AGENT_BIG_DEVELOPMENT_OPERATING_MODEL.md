# Multi-Agent Big Development Operating Model

Status: canonical operating model  
Created: 2026-06-19  
Owner: Melverick Ng  
Primary orchestrator: Melkizac / default Hermes agent  
Engineering authority: Andrej / DevOps Builder

## Purpose

This page defines how Melverick's AI workforce should handle future large software-development efforts where multiple coding agents may work in parallel on separate branches. It incorporates useful patterns identified from `garrytan/gstack` — spec discipline, architecture review, worktree/branch isolation, PR packaging, QA/review gates, and landing queue visibility — while keeping Hermes Mission Control (HMC), Melkizac, and Andrej as the governing system.

## Core rule

```text
HMC + Melkizac = orchestration, state, evidence, approvals
Andrej = engineering authority, architecture gate, final review/merge
Worker agents = isolated branch execution against explicit specs
GitHub = PR/CI enforcement
Integration branch = staging area before main
```

The team is ready for a disciplined multi-agent pilot and later 5-7 agent execution **only when** this model is used. Do not run unbounded parallel coding where agents infer architecture independently and Andrej cleans up at the end.

## Trigger conditions

Use this model when any of these are true:

- 3+ coding agents or workstreams;
- multiple branches/PRs concurrently;
- merge conflicts or shared contracts are likely;
- production, deployment, database, auth, payments, HMC, or client-facing flows are affected;
- the user asks for a big development project, agent team, parallel branches, or multiple PRs.

## Non-negotiable gates

### Gate 0 — Epic readiness

Melkizac or Project & Task Coordinator creates an HMC project/epic with business goal, target repo/path, base branch, constraints, approval boundaries, expected evidence, integration strategy, and final owner. Final engineering owner is Andrej unless explicitly delegated.

### Gate 1 — Spec pack

Each worker task must have a backlog-ready spec inspired by gstack `/spec`:

- context / why this matters;
- verified current state with file references where possible;
- exact scope and explicit out-of-scope;
- likely files/directories and areas to avoid;
- API/data/schema contracts where relevant;
- dependencies and ordering constraints;
- testable acceptance criteria;
- test plan by layer;
- rollback plan if stateful/risky;
- evidence required for completion.

### Gate 2 — Andrej architecture approval

Before parallel execution starts, Andrej or an Andrej-owned task must approve architecture, integration branch name, branch convention, shared contracts/types/schemas, file ownership boundaries, CI/test commands, deployment/rollback approach, and merge order/dependency graph.

### Gate 3 — Worker branch isolation

Each coding worker gets one task/spec, one branch, one worktree or isolated checkout, one target PR, explicit allowed/disallowed paths, and required evidence checklist.

Recommended branches:

```text
project/<slug>/integration
agent/<slug>/<task>
```

Worker PR target:

```text
agent/<slug>/<task> → project/<slug>/integration
```

Final integration PR target:

```text
project/<slug>/integration → main
```

### Gate 4 — Pre-Andrej review

Before Andrej review, each PR should have build/test/lint output, agent self-check summary, code review pass, security/trust-boundary scan when relevant, browser QA or screenshot evidence for UI work, risk notes, and exact files touched.

### Gate 5 — Andrej final review and merge

Andrej owns technical approval, conflict resolution, merge into integration branch, integration test/debug loop, final PR from integration to main, and production/deployment verification when applicable. Worker agents must not bypass Andrej for high-impact merges into `main`.

## Recommended wave model

1. **Wave 0 — Spike/discovery:** 1-2 agents inspect or prototype; output is evidence and plan, not production merge.
2. **Wave 1 — Foundation:** shared contracts, schemas/types, routing/API shells, design primitives, migration scaffolding, test harnesses.
3. **Wave 2 — Parallel feature branches:** 3-7 worker agents build independent bounded scopes after foundation is stable.
4. **Wave 3 — Integration/hardening:** Andrej or integration owner resolves conflicts, runs full tests, performs E2E/browser verification, updates docs, and prepares final PR.

## HMC fields for big development tasks

Every big-development task should carry: epic ID, owner, engineering authority, repo/path, base branch, target branch, worker branch, worktree path, spec path/issue, dependencies, allowed paths, avoid paths, test commands, evidence, state, and approval gate.

## PR evidence template

```md
## Summary
- ...

## Scope
- Task/spec: ...
- Branch: ...
- Target: project/<slug>/integration

## Files intentionally touched
- `path/to/file` — why

## Evidence
- [ ] Build: `<command>` → pass/fail + output reference
- [ ] Tests: `<command>` → pass/fail + output reference
- [ ] Lint/typecheck: `<command>` → pass/fail + output reference
- [ ] Browser/QA screenshot or URL if UI

## Risks / integration notes
- ...

## Out of scope
- ...
```

## Borrowed gstack capabilities to adapt

Borrow as patterns, not uncontrolled global installation:

| gstack capability | Use in Hermes/HMC |
|---|---|
| `/spec` | Backlog-ready spec creation and child issue/task generation |
| `/autoplan` | Full plan review before build |
| `/plan-eng-review` | Andrej architecture gate pattern |
| worktree branch spawning | Isolated worker execution |
| `/review` / `/codex` / `/cso` | Pre-Andrej review/security gates |
| `/qa` / browser QA | UI verification evidence |
| `/ship` | Standard PR packaging |
| `/landing-report` | HMC merge queue / PR dashboard concept |
| `/land-and-deploy` | Andrej-controlled final landing/deploy checklist |

Avoid wholesale adoption until sandboxed: browser cookie automation, telemetry/community analytics, auto-deploy, and memory layers that conflict with Hermes KB/HMC as source of truth.

## Conflict prevention rules

- Prefer vertical slices with bounded directories.
- Create foundation/shared-contract PRs before feature PRs.
- If two workers must edit the same file, record dependency and merge order before work starts.
- Rebase/refresh worker branches after each foundation merge.
- Use integration branch as the collision zone, not `main`.
- Stop a worker when its spec becomes invalid due to upstream changes; update spec before continuing.

## Scaling policy

Start with 2-3 workers for a pilot. Scale to 5-7 only when specs are crisp, Andrej approved architecture, CI is reliable, integration branch is active, PR evidence quality is consistent, HMC shows all branches/PRs/states, and Andrej is not overloaded by weak PRs.

## Final authority

Melkizac decomposes, routes, tracks, and verifies evidence. Worker agents implement within scope. Reviewer agents flag issues. Andrej approves architecture, final technical correctness, merges, and conflict resolution. Melverick approves business/product direction, external commitments, and high-impact release decisions.
