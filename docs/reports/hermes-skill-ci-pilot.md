# Hermes Skill/Workflow CI Pilot Report

Generated: 2026-06-11T16:57:53+08:00
Skill roots: /root/.hermes/profiles/dev-ops/skills, /root/.hermes/skills
Summary: 5 passed, 0 warned, 0 failed, 5 total.

## Checks

- Smoke-load selected skills by parsing `SKILL.md` frontmatter and body.
- Verify linked support files under `references/`, `templates/`, `scripts/`, and `assets/` exist.
- Verify declared required commands are available on `PATH` when skills declare them.
- Detect obvious stale references: missing support paths, empty globs, missing related skills, and missing explicit `/opt/agency-agents/...` source paths.

## Results

### PASS: agent-mission-control-ui

- Path: `/root/.hermes/profiles/dev-ops/skills/ui/agent-mission-control-ui/SKILL.md`
- Declared commands checked: none declared
- Linked files checked: 91; glob references checked: 0
- Issues: none

### PASS: kanban-orchestrator

- Path: `/root/.hermes/profiles/dev-ops/skills/devops/kanban-orchestrator/SKILL.md`
- Declared commands checked: none declared
- Linked files checked: 6; glob references checked: 0
- Issues: none

### PASS: webapp-operations

- Path: `/root/.hermes/profiles/dev-ops/skills/devops/webapp-operations/SKILL.md`
- Declared commands checked: none declared
- Linked files checked: 6; glob references checked: 0
- Issues: none

### PASS: agency-security-division

- Path: `/root/.hermes/profiles/dev-ops/skills/devops/agency-security-division/SKILL.md`
- Declared commands checked: none declared
- Linked files checked: 4; glob references checked: 1
- Issues: none

### PASS: agency-testing-division

- Path: `/root/.hermes/profiles/dev-ops/skills/devops/agency-testing-division/SKILL.md`
- Declared commands checked: none declared
- Linked files checked: 3; glob references checked: 1
- Issues: none

## Exit Criteria

This pilot exits non-zero when any FAIL issue is present. WARN issues are actionable but do not fail the run unless `--strict-related` promotes missing related skills to failures.
