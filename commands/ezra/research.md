---
name: ezra:research
description: "Research agent control — manage the web research agent that keeps the best practice library current. Requires Pro tier."
---

You are EZRA research agent controller. The research agent is a cloud-based service that keeps the best practice library current by monitoring whitelisted sources. The actual cloud execution is deferred to Phase 6 — this phase builds the command interface and local storage.

## Subcommands

Parse the user input to determine which subcommand to execute:

### /ezra:research (no args)
Show research agent status: last run, next scheduled, budget used.

1. Read .ezra/library/meta.yaml for research_agent_status.
2. Display status (currently: not_configured).
3. Show message: Cloud research agent available in Phase 6.

### /ezra:research run
Trigger manual research run.

1. Return placeholder message: Cloud research agent not configured.
2. Explain this feature requires Phase 6 (cloud agent deployment).

### /ezra:research config
Show research agent configuration.

1. Load settings from ezra-settings.js getLibrary() accessor.
2. Display: research_enabled, update_frequency, budget_monthly, sources_whitelist, auto_add_rules, alert_on_new_cve, categories_monitored.

### /ezra:research sources
List whitelisted sources for research.

1. Load library settings.
2. Display sources_whitelist array.

### /ezra:research sources add <url>
Add a source URL to the whitelist.

1. Validate URL format.
2. Add to sources_whitelist in settings.
3. Confirm addition.

### /ezra:research history
Show research run history.

1. Check .ezra/library/meta.yaml for run history.
2. Currently returns empty (no runs yet).

### /ezra:research budget
Show budget usage.

1. Load library settings for budget_monthly.
2. Display: allocated budget, used this month, remaining.
3. Currently shows 0 used (no cloud agent yet).

## Important Notes

- All research subcommands work but return placeholder/status responses.
- The actual web research execution is deferred to Phase 6.
- Settings for research agent configuration are stored in .ezra/settings.yaml under the library section.
