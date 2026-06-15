# Mission Control PR Hygiene Workflow

Use this workflow for every new Mission Control change. The goal is simple: keep Git clean, isolate changes, and prevent implemented features from disappearing during cleanup or conflict resolution.

## Default rule

Every new change gets its own narrow PR. Do not batch unrelated UI, backend, cleanup, and deployment changes into one branch.

Good PR scopes:

- `fix/task-board-advanced-filter`
- `feat/account-settings-page`
- `cleanup/admin-nav-labels`
- `chore/backend-source-sync`

Bad PR scopes:

- `cleanup-everything`
- `latest-updates`
- `misc-fixes`
- `big-refactor`

## Before starting a PR

1. Confirm the repo and branch:

```bash
git status --short
git branch --show-current
git remote -v
```

2. If the tree is dirty, classify changes first:

```bash
git diff --stat
git diff --name-only
```

3. Do not build on top of unrelated dirty work. Either:

- finish and PR the current work;
- stash it;
- create a separate branch/worktree for the new task.

## PR branch loop

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
git checkout -b <type>/<short-scope>
```

Then follow the loop:

```text
Intent -> inspect context -> make small change -> run focused checks -> adjust -> summarize evidence
```

## PR body requirements

Every PR must include:

```text
Touched routes/files:

Capabilities changed:

Capabilities intentionally preserved:

Feature Contract impact:
- [ ] No user-visible capability removed
- [ ] Any removal/replacement is explicitly approved below

Checks run:
- [ ] npm run build
- [ ] pytest/static checks, if applicable
- [ ] browser/API smoke for touched routes, if applicable

Conflict handling:
- [ ] Branch updated from latest main before merge
- [ ] Conflicts resolved in this PR branch
- [ ] Checks rerun after conflict resolution

Deployment notes:

Rollback notes:
```

## Before merge

Update the PR branch from latest `main` and resolve conflicts there:

```bash
git fetch origin
git checkout <branch>
git rebase origin/main
# or: git merge origin/main
```

Then rerun the checks. Do not merge based on a pre-conflict build.

## Merge order

Merge one PR at a time:

```text
Update PR 1 from main -> verify -> merge
Update PR 2 from main -> verify -> merge
Update PR 3 from main -> verify -> merge
```

Do not batch-commit multiple PRs to main without rerunning checks after each merge/update.

## Cleanup PR extra rule

Cleanup PRs are high-risk because they can remove features without causing Git conflicts. They must include a feature-preservation checklist copied from `docs/MISSION_CONTROL_FEATURE_CONTRACT.md` for every touched route.

For example, a `/tasks` cleanup must prove search/status/owner/project filtering still exists, and must document where board/source advanced filtering lives or why its replacement was approved.

## Completion evidence

A final implementation report should include:

- branch and commit;
- files changed;
- checks run and results;
- page/API smoke evidence;
- whether production was deployed;
- rollback notes;
- blockers or known gaps.
