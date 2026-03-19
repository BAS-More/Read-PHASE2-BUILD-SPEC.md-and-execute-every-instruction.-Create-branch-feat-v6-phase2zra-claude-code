---
name: ezra:help
description: Show all EZRA commands, agents, and current configuration.
---

Display the following help text:

```
EZRA — Automated Epistemic Governance & Intelligence System
═══════════════════════════════════════════════════════════════

COMMANDS
  /ezra:init        Initialize EZRA for this project
  /ezra:scan        Full multi-agent codebase analysis
  /ezra:guard       Check changes against governance rules
  /ezra:reconcile   Compare plan vs implementation
  /ezra:decide      Record an architectural decision
  /ezra:review      Multi-agent code review
  /ezra:status      Governance health dashboard
  /ezra:help        This help text

AGENTS (dispatched automatically by commands)
  ezra-architect    Architecture analysis, layer mapping, dependency tracing
  ezra-reviewer     Security + quality review with severity scoring
  ezra-guardian     Decision enforcement, protected path integrity
  ezra-reconciler   Plan vs implementation comparison

STATE DIRECTORY: .ezra/
  decisions/         Architectural Decision Records (YAML)
  scans/             Timestamped scan results
  plans/             Registered plans for reconciliation
  governance.yaml    Rules, protected paths, enforcement config
  knowledge.yaml     Epistemic state — what EZRA knows

TYPICAL WORKFLOW
  1. /ezra:init              → Set up governance
  2. /ezra:decide <decision> → Record key decisions
  3. /ezra:scan              → Baseline analysis
  4. ... do work ...
  5. /ezra:guard             → Check before committing
  6. /ezra:review            → Deep review before PR
  7. /ezra:reconcile         → Verify plan completion
  8. /ezra:status            → Ongoing health check

PHILOSOPHY
  The complexity is in the system, not in your workflow.
  EZRA handles multi-phase analysis, decision tracking,
  and integrity enforcement. You focus on building.
```

Then check if `.ezra/` exists and append current state:

If initialized:
```
CURRENT PROJECT: <name>
Decisions: <count> active | Scans: <count> total | Plans: <count> active
Last scan: <date> | Health: <score>/100
```

If not initialized:
```
STATUS: Not initialized. Run /ezra:init to begin.
```
