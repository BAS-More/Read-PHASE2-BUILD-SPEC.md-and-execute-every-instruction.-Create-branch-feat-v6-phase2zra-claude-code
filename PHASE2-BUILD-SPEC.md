# EZRA v6 Phase 2 Build Spec: Project Manager Role + Progress Tracking

## Context
You are working on EZRA (עזרא), a multi-agent codebase governance framework for Claude Code.
Repo: C:\Dev\Ezra (github.com/BAS-More/ezra-claude-code)
Current version: 6.0.0
Branch: main (clean). Create a feature branch: feat/v6-phase2-pm
Phase 1 is merged: real-time oversight + unified settings (300 tests, 0 failures).

## Critical Rules
1. ZERO external npm dependencies. Only fs, path, os, crypto, child_process.
2. Never use fake API keys in tests. Use "FAKE_KEY_test_only_not_real" if needed.
3. Run `node tests/run-tests.js` after EVERY change. Fix failures before moving on.
4. ALL tests must pass before commit. Target: 350+ tests, 0 failures.
5. Follow existing code patterns exactly — read existing hooks and commands first.
6. Use 'use strict' in all new JS files.

## What to Build

### 1. NEW FILE: hooks/ezra-pm.js (~400-500 lines)

The Project Manager hook. Hybrid design per AD-007: rule-based for routine checks, AI-ready interface for complex decisions (AI integration deferred to Phase 5).

**Exports (module.exports):**
- `loadProjectState(projectDir)` — reads .ezra/ state, returns structured project object
- `checkMilestones(projectDir)` — compares current state against defined milestones
- `detectStalls(projectDir, thresholdMinutes)` — checks if progress has stalled
- `generateProgressReport(projectDir)` — produces structured progress data
- `calculateHealthTrend(projectDir, lastN)` — reads last N scans, returns trend data
- `checkEscalation(projectDir, failures)` — determines if escalation needed (rule: N consecutive failures)
- `generateDailyReport(projectDir)` — produces daily summary from .ezra/ data
- `updateProgress(projectDir, task, status)` — writes to .ezra/progress/tasks.yaml
- `PM_DEFAULTS` — default PM settings object

**PM_DEFAULTS:**
```javascript
const PM_DEFAULTS = {
  enabled: true,
  mode: 'hybrid',
  routine_checks: 'rule-based',
  complex_decisions: 'ai',
  check_interval: 'every_5_tasks',
  escalation_threshold: 3,
  stall_detection: 30,  // minutes
  daily_report: true,
  weekly_report: true,
  milestones: [],
};
```

**Progress state stored in .ezra/progress/:**
```
.ezra/progress/
├── tasks.yaml          # Task queue with status (pending/active/done/blocked)
├── milestones.yaml     # Milestone definitions and completion status
├── reports/            # Generated reports (daily/weekly)
│   ├── daily-YYYY-MM-DD.yaml
│   └── weekly-YYYY-WNN.yaml
└── escalations.yaml    # Escalation log
```

**loadProjectState reads:**
- .ezra/governance.yaml (project name, phase)
- .ezra/scans/ (latest scan for health score)
- .ezra/decisions/ (count decisions by status)
- .ezra/progress/tasks.yaml (task completion stats)
- .ezra/progress/milestones.yaml (milestone status)
- hooks/ezra-settings.js getOversight() for threshold data

**checkMilestones logic:**
```
For each milestone in milestones.yaml:
  - Evaluate each criterion:
    - 'health_score >= N' → read latest scan, compare
    - 'all_p1_tasks_done' → check tasks.yaml for P1 tasks
    - 'test_coverage >= N' → read from scans if available
    - 'zero_critical_gaps' → check decisions for unresolved gaps
  - Return: { name, criteria, met: boolean[], overall: boolean, percentage }
```

**detectStalls logic:**
```
Read .ezra/progress/tasks.yaml
Find the most recently updated task
If (now - lastUpdate) > thresholdMinutes → stall detected
Return: { stalled: boolean, lastActivity, minutesSinceActivity, stalledTask }
```

**calculateHealthTrend logic:**
```
Read all files in .ezra/scans/ sorted by date
Take the last N scans
Calculate: current, previous, delta, trend ('improving'|'declining'|'stable')
Return: { scores: [...], current, previous, delta, trend }
```

**checkEscalation logic:**
```
Read .ezra/progress/escalations.yaml
Count consecutive failures for the current task
If count >= escalation_threshold → return { escalate: true, reason, count }
Else → return { escalate: false }
```

**Hook protocol (stdin):**
When invoked as a hook (require.main === module):
- Reads JSON from stdin
- Runs generateProgressReport
- Outputs JSON to stdout
- Exits 0

### 2. NEW FILE: hooks/ezra-progress-hook.js (~200-250 lines)

A PostToolUse hook that tracks agent progress automatically.

**Behaviour:**
- Receives PostToolUse events via stdin
- On Write events: logs file change to .ezra/progress/activity.log
- On every 5th file change (configurable via settings.project_manager.check_interval):
  - Runs checkMilestones
  - Runs detectStalls
  - If stall detected → logs warning to stderr
  - If milestone completed → logs to .ezra/progress/milestones.yaml
- Outputs: `{ hookSpecificOutput: { hookEventName: 'PostToolUse', permissionDecision: 'allow' } }`
- Always exits 0 (never blocks, only monitors)

### 3. NEW FILE: commands/ezra/pm.md

Slash command for the Project Manager.

```
---
name: ezra:pm
description: "Project Manager — view progress, milestones, reports, and manage tasks. Shows overall project health, task queue status, and escalation state."
---
```

**Subcommands:**
```
/ezra:pm                    Show project status summary (health, progress %, milestones, stalls)
/ezra:pm tasks              Show task queue with status breakdown
/ezra:pm tasks add <desc>   Add a task to the queue
/ezra:pm tasks done <id>    Mark a task as completed
/ezra:pm milestones         Show milestone status with criteria evaluation
/ezra:pm milestone add      Add a new milestone with criteria
/ezra:pm report             Generate and display daily report
/ezra:pm report weekly      Generate and display weekly report
/ezra:pm escalations        Show escalation log
/ezra:pm stall-check        Run manual stall detection
/ezra:pm health-trend       Show health score trend (last 10 scans)
```

### 4. NEW FILE: commands/ezra/progress.md

Slash command for quick progress view.

```
---
name: ezra:progress
description: "Quick progress dashboard — completion %, active tasks, health trend, next milestone."
---
```

**Behaviour:**
Reads .ezra/progress/ and .ezra/scans/, outputs a compact dashboard:
```
EZRA Progress Dashboard
═══════════════════════════════════════════
Project: <name> | Phase: <phase>
Overall: <N>% complete | Tasks: <done>/<total>
Health: <score>/100 (<trend>) | Last scan: <date>
Next Milestone: <name> (<M>/<N> criteria met)
Stalls: <none|warning>
═══════════════════════════════════════════
```

### 5. NEW FILE: tests/test-v6-pm.js (~500+ lines)

Test suite covering all PM functionality. Follow existing PASSED/FAILED format.

**Required test categories:**
1. PM_DEFAULTS validation (all keys present, correct types, correct defaults)
2. loadProjectState with mock .ezra/ directory
3. checkMilestones with various criteria (health, tasks, coverage)
4. detectStalls with fresh/stale timestamps
5. calculateHealthTrend with mock scan files
6. checkEscalation with various failure counts
7. generateProgressReport returns complete structure
8. generateDailyReport produces valid output
9. updateProgress creates/updates task entries
10. Hook protocol: stdin JSON → stdout JSON → exit 0
11. Progress hook: tracks file changes, triggers checks at interval
12. Edge cases: empty .ezra/, missing files, corrupted yaml

### 6. Update hooks/ezra-settings.js

Add `project_manager` section to DEFAULTS and add `getProjectManager` accessor:

```javascript
project_manager: {
  enabled: true,
  mode: 'hybrid',
  routine_checks: 'rule-based',
  complex_decisions: 'ai',
  ai_provider: 'claude',
  check_interval: 'every_5_tasks',
  escalation_threshold: 3,
  stall_detection: 30,
  daily_report: true,
  weekly_report: true,
  milestones: [],
},
```

Export `getProjectManager(projectDir)`.

### 7. Update Existing Files

**tests/test-structure.js:**
- Update command count: 26 → 28
- Update hook count: 7 → 9

**tests/test-commands.js:**
- Add 'pm' and 'progress' to expected commands list

**tests/run-tests.js:**
- Add V6-PM suite: `{ name: 'V6-PM', script: 'test-v6-pm.js' }`

**README.md:**
- Update command count 26 → 28
- Add /ezra:pm and /ezra:progress to command list
- Update hook count 7 → 9

**CLAUDE.md:**
- Add /ezra:pm, /ezra:progress to command list
- Update counts

**commands/ezra/help.md:**
- Add /ezra:pm and /ezra:progress entries

**skills/ezra/SKILL.md:**
- Add /ezra:pm and /ezra:progress

**bin/cli.js:**
- No version change needed (already 6.0.0)

**package.json:**
- No version change needed (already 6.0.0)

## Acceptance Criteria

1. `node tests/run-tests.js` → ALL GREEN, 0 failures
2. Total test count ≥ 350
3. All 9 hooks present in hooks/ directory
4. All 28 commands present in commands/ezra/
5. ezra-pm.js loadable via require() with all 9 exports
6. ezra-progress-hook.js processes PostToolUse events via stdin
7. Settings DEFAULTS has project_manager section
8. No external dependencies added
9. All existing tests still pass (no regressions)

## Execution Order

1. Read existing hooks and commands to learn patterns
2. Create feature branch: `git checkout -b feat/v6-phase2-pm`
3. Update hooks/ezra-settings.js (add project_manager defaults + accessor)
4. Create hooks/ezra-pm.js
5. Create hooks/ezra-progress-hook.js
6. Create commands/ezra/pm.md
7. Create commands/ezra/progress.md
8. Create tests/test-v6-pm.js
9. Run tests → fix failures
10. Update all existing files (counts, references)
11. Run tests → ALL GREEN
12. Commit: `feat(v6): Phase 2 — Project Manager role + progress tracking`
13. Do NOT push. Do NOT merge.
