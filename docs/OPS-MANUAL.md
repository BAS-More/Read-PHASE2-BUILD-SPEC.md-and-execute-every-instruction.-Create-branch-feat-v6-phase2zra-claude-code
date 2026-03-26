# EZRA Operations Manual

## System Overview
EZRA is a codebase governance framework for Claude Code. It runs as:
- **Hooks** in ~/.claude/hooks/ — fire automatically on every Claude Code session
- **Commands** via /ezra:* slash commands — invoked by users
- **VS Code extension** — sidebar dashboard with interactive settings

## Daily Operations

### Monitoring
- `/ezra:dash` — project status at a glance
- `/ezra:health` — full 5-pillar health check
- `/ezra:status` — governance state summary

### What Runs Automatically
| Hook | Event | What It Does |
|------|-------|-------------|
| ezra-dash-hook.js | SessionStart | Shows project snapshot |
| ezra-guard.js | PreToolUse | Checks protected paths |
| ezra-oversight.js | PreToolUse | Code standards gate |
| ezra-drift-hook.js | PostToolUse | Tracks doc staleness |
| ezra-version-hook.js | PostToolUse | Versions .ezra/ state |
| ezra-progress-hook.js | PostToolUse | Tracks milestones |
| ezra-memory-hook.js | PostToolUse | Captures patterns |
| ezra-notify.js | Notification | Desktop alerts |

### Common Tasks

**Change oversight strictness:**
```
/ezra:settings → Oversight → Intervention Level → pick level
```

**Add a protected path:**
```
/ezra:settings → Protected Paths → [A] Add → enter pattern and reason
```

**Record an architecture decision:**
```
/ezra:decide "Description of decision"
```

**Run a governance scan:**
```
/ezra:scan
```

**Check document gaps:**
```
/ezra:doc-check
```

## Troubleshooting

### Hooks Not Firing
1. Check hooks are configured: `cat ~/.claude/settings.json | grep hooks`
2. Check hook files exist: `ls ~/.claude/hooks/ezra-*.js`
3. Test a hook manually: `echo '{}' | node ~/.claude/hooks/ezra-guard.js`
4. All hooks must exit 0 — check for crash: `echo '{}' | node hook.js; echo $?`

### Settings Not Taking Effect
1. Check project settings: `cat .ezra/settings.yaml`
2. Check global defaults: `cat ~/.claude/hooks/ezra-defaults.yaml`
3. Settings merge: project overrides global overrides hardcoded
4. Cache: settings are cached by mtime — edit the file to bust cache

### Health Score Dropping
1. Run `/ezra:health` for detailed pillar breakdown
2. Check remediation priority at bottom of report
3. Most common causes: missing docs, stale plans, large files

### Version Tracking Issues
1. Check: `cat .ezra/versions/current.yaml`
2. Check: `cat .ezra/versions/changelog.yaml`
3. Version hook writes on every .ezra/ file change

## Maintenance Schedule

| Task | Frequency | Command |
|------|-----------|---------|
| Health check | Weekly | `/ezra:health` |
| Document sync | After major changes | `/ezra:doc-sync` |
| Plan reconciliation | Per milestone | `/ezra:reconcile` |
| Settings review | Monthly | `/ezra:settings` |
| Hook updates | Per release | `cp hooks/*.js ~/.claude/hooks/` |
| Test suite | Before every commit | `node tests/run-tests.js` |
