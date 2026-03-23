---
name: ezra:help
description: Show all EZRA commands, agents, and current configuration.
---

Display the following help text:

```
EZRA (עזרא) — The Scribe Who Restores and Enforces Standards
═══════════════════════════════════════════════════════════════
Enforce. Zero-drift. Restore. Audit.

COMMANDS
  /ezra:init          Initialize EZRA for this project
  /ezra:scan          Dynamic multi-agent codebase scan (100 agents, presets, classic)
  /ezra:guard         Check changes against governance rules
  /ezra:reconcile     Compare plan vs implementation
  /ezra:decide        Record an architectural decision
  /ezra:review        Dynamic multi-agent code review (smart agent selection)
  /ezra:agents        Agent management — list, recommend, deploy, search (100 roles)
  /ezra:status        Governance health dashboard
  /ezra:doc           Generate and manage SDLC documentation
  /ezra:dash          Real-time governance dashboard
  /ezra:doc-check     Verify documentation completeness
  /ezra:doc-sync      Synchronize docs with codebase state
  /ezra:doc-approve   Document review and approval workflow
  /ezra:version       Version control for EZRA state
  /ezra:health        5-pillar health assessment
  /ezra:advisor       Lifecycle-aware guidance and recommendations
  /ezra:process       Create and run reusable workflows
  /ezra:auto          Autonomous execution with guard rails
  /ezra:multi         Multi-project portfolio orchestration
  /ezra:sync          Sync EZRA state with avios-context MCP
  /ezra:claude-md     Generate or update CLAUDE.md from .ezra/ state
  /ezra:bootstrap     One-command project onboarding
  /ezra:help          This help text

REAL-TIME OVERSIGHT
  /ezra:oversight     View oversight status, violations, and intervention level
  /ezra:settings      Unified settings management (.ezra/settings.yaml)
  /ezra:compliance    Compliance profiles (ISO 25010, OWASP, SOC2, HIPAA, PCI-DSS, GDPR, WCAG)
  /ezra:learn         Self-learning intelligence and recommendations
  /ezra:pm            Project management with milestones and deliverables
  /ezra:progress      Track and report project milestone progress
  /ezra:library       Best practice library — browse, search, add across 14 categories
  /ezra:research      Research agent control — automated best practice discovery
  /ezra:portfolio — Cross-project portfolio health dashboard
/ezra:memory
- /ezra:plan
- /ezra:license — License management (status, activate, deactivate, features)
- /ezra:install — Install/uninstall/update EZRA — Holistic Planning Engine (create, status, tasks, gap-check) — Agent memory system
/ezra:workflow — Enhanced workflow template system
/ezra:handoff — Generate session handoff briefing
/ezra:cost          Cost tracking and budget management for AI agent usage

AGENT SYSTEM (100 roles × 12 domains × 4 core engines)
  Core Engines:
    ezra-architect    Architecture analysis, layer mapping, dependency tracing
    ezra-reviewer     Security + quality review with severity scoring
    ezra-guardian     Decision enforcement, protected path integrity
    ezra-reconciler   Plan vs implementation comparison

  Domains (100 specialized roles):
    architecture(10) security(12) quality(10) testing(8)
    governance(8)    devops(10)   documentation(8) performance(8)
    accessibility(6) data(6)     frontend(8)  reconciliation(6)

  Presets: quick-review(3) full-scan(4) security-deep(6) quality-deep(6)
           frontend-review(6) backend-review(6) pre-release(8) maximum-coverage(12)

  Quick Start:
    /ezra:agents                  → Interactive agent menu
    /ezra:agents recommend <task> → Get recommendation for any task
    /ezra:scan --preset <name>    → Scan with preset team
    /ezra:review --agents 6       → Review with 6 smart-selected agents

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
  Ezra didn't suggest. He governed.
  EZRA handles multi-phase analysis, decision tracking,
  document lifecycle, and integrity enforcement.
  You focus on building.
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
