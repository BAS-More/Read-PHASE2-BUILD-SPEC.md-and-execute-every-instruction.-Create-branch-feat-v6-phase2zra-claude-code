# EZRA (עזרא)

## The Scribe Who Restores and Enforces Standards

> *"And Ezra had set his heart to seek the Torah of Hashem, and to do it, and to teach in Israel statute and ordinance."* — Ezra 7:10

[![CI](https://github.com/BAS-More/ezra-claude-code/actions/workflows/ci.yml/badge.svg)](https://github.com/BAS-More/ezra-claude-code/actions)
[![npm](https://img.shields.io/npm/v/ezra-claude-code)](https://www.npmjs.com/package/ezra-claude-code)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/node-%3E%3D16.7-brightgreen)](https://nodejs.org)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)](https://github.com/BAS-More/ezra-claude-code)

EZRA is a multi-agent codebase governance framework for [Claude Code](https://claude.ai/code). It provides 22 slash commands, 4 subagents, 5 lifecycle hooks, 55 SDLC document types, 5-pillar health enforcement, autonomous process execution with guard rails, and multi-project portfolio orchestration.

### Identity

**Ezra HaSofer (עזרא הסופר)** — Ezra the Scribe — returned from Babylonian exile to find Israel's standards broken, its governance collapsed, and its practices drifted from what was decreed. He didn't just rebuild. He audited. He documented. He enforced.

What Ezra did for Israel, this system does for codebases:

- **Restored the standard** — Ezra re-established the Torah as the authoritative source of truth. EZRA establishes architectural decisions, coding standards, and governance rules as the authoritative source for your project.
- **Audited compliance** — Ezra conducted a public audit of the people's adherence to the law. EZRA scans your codebase against recorded decisions, protected paths, and configured standards.
- **Documented everything** — Ezra was a Sofer (scribe) — the original documentation specialist. He ensured the text was accurate, complete, and accessible. EZRA manages 55 SDLC document types across the full project lifecycle.
- **Enforced with authority** — Ezra didn't suggest. He governed. When he found violations, he required correction. EZRA's guard rails halt autonomous execution the moment a violation is detected.
- **Taught and elevated** — Ezra didn't just enforce — he taught the people to understand the standards themselves. EZRA's advisor provides lifecycle-aware guidance, best practices, and forward-looking recommendations.

The name EZRA encodes the system's purpose: **Enforce. Zero-drift. Restore. Audit.**

Works on **Windows**, **macOS**, and **Linux**.

## Quick Start

```bash
# Install globally (all projects)
npx ezra-claude-code --claude --global

# Or install locally (current project only)
npx ezra-claude-code --claude --local

# Restart Claude Code, then:
/ezra:help
```

## What EZRA Does

| Capability | Description |
|-----------|-------------|
| **19 Slash Commands** | Governance, documents, dashboard, processes, autonomous execution, multi-project |
| **4 Subagents** | Architect, Reviewer, Guardian, Reconciler — dispatched in parallel |
| **4 Auto-Hooks** | Protected path guard, session dashboard, document drift detection, version tracking |
| **55 Document Types** | Full SDLC coverage from business case through decommissioning |
| **5-Pillar Health** | On-Track, No Gaps, Clean, Secure, Best Practices (scored 0-100) |
| **Process Engine** | Adjustable step-by-step workflows saved as portable templates |
| **Autonomous Execution** | Runs processes start-to-finish under continuous guard rail monitoring |
| **Multi-Project** | Portfolio dashboard, cross-project health, sync governance across repos |
| **Proactive Advisor** | Lifecycle-aware suggestions, innovations, tech debt register |
| **Immutable Versioning** | Append-only changelog, named snapshots, version diffing |

## Commands

### Governance & Analysis

```
/ezra:init          Initialize EZRA for a project
/ezra:scan          Multi-agent codebase analysis
/ezra:guard         Check changes against governance rules
/ezra:reconcile     Compare plan vs implementation
/ezra:decide        Record an architectural decision
/ezra:review        Multi-agent code review (3 parallel agents)
/ezra:health        5-pillar health enforcement
/ezra:advisor       Proactive best-practice suggestions
/ezra:status        Governance summary
```

### Dashboard & Documents

```
/ezra:dash          Real-time project dashboard
/ezra:doc create    Create SDLC document from codebase analysis
/ezra:doc list      List all documents with status
/ezra:doc status    Document health report
/ezra:doc-check     Gap analysis for current phase
/ezra:doc-sync      Detect drift, propose updates (requires approval)
/ezra:doc-approve   Review and approve/reject proposals
```

### Process Engine & Automation

```
/ezra:process create    Build a custom workflow
/ezra:process run       Execute interactively
/ezra:process template  Save/load reusable templates
/ezra:auto <process>    Run fully autonomously with guard rails
/ezra:auto --dry-run    Simulate without changes
```

### Multi-Project

```
/ezra:multi add         Register a project
/ezra:multi dash        Portfolio dashboard
/ezra:multi health      Cross-project health comparison
/ezra:multi run --all   Run process across all projects
/ezra:multi sync        Sync templates and governance
```

### Versioning

```
/ezra:version           Current version state
/ezra:version log       Append-only audit trail
/ezra:version snapshot  Named checkpoint
/ezra:version diff      Compare two snapshots
```

## Health Pillars

`/ezra:health` scores your project across 5 weighted pillars:

| Pillar | Weight | Checks |
|--------|--------|--------|
| **On-Track** | 25% | Plans progressing, decisions recorded, recent scans, no stalled work |
| **No Gaps** | 20% | Document coverage, test coverage, API docs, decision coverage |
| **Clean** | 15% | No `any` types, strict TypeScript, linting, no dead code |
| **Secure** | 25% | OWASP compliance, npm audit, auth, secrets, rate limiting |
| **Best Practices** | 15% | CI/CD, SOLID, error handling, git hygiene, structured logging |

Grades: **A** (90+), **B** (75-89), **C** (60-74), **D** (40-59), **F** (0-39)

## Process Templates

EZRA ships with 5 built-in process templates:

| Template | Steps | Purpose |
|----------|-------|---------|
| `full-remediation` | 8 | Gap analysis, health, docs, tests, security, report |
| `release-prep` | 6 | Health gate, security audit, doc check, reconcile |
| `sprint-close` | 5 | Tests, scan, doc sync, reconcile, snapshot |
| `security-audit` | 7 | OWASP scan, dep audit, secrets check, report |
| `onboarding` | 4 | Init, scan, doc check, advisor |

Create custom processes from plain English:

```
/ezra:process create my-flow

> step 1: run gap analysis
> step 2: bridge all findings
> step 3: run tests
> step 4: generate report
```

Save as template: `/ezra:process template save my-flow`

## Autonomous Execution

```
/ezra:auto full-remediation
```

Runs all steps without manual intervention. Guard rails enforce:

- Clean git, passing tests, minimum health score
- **Never** touches `.env`, secrets, `main` branch, production
- **Blocks** `rm -rf`, `DROP TABLE`, `git push --force`
- Re-checks guards **before and after every step**
- Halts immediately on any violation with specific remediation

## Project State

EZRA persists all state in `.ezra/` at the project root:

```
.ezra/
├── decisions/      # Architectural Decision Records
├── scans/          # Scan + health results
├── plans/          # Plans for reconciliation
├── docs/           # 55-type SDLC document library + proposals
├── processes/      # Workflow definitions + templates + run history
├── versions/       # Immutable changelog + snapshots
├── governance.yaml # Rules, protected paths, enforcement
└── knowledge.yaml  # Epistemic state
```

## Hooks (Optional)

After installation, add hooks to your `settings.json` for automatic enforcement:

| Hook | Event | Purpose |
|------|-------|---------|
| `ezra-guard.js` | PreToolUse | Warns on protected path edits |
| `ezra-dash-hook.js` | SessionStart | Compact project status every session |
| `ezra-drift-hook.js` | PostToolUse | Tracks edits, flags stale documents |
| `ezra-version-hook.js` | PostToolUse | Auto-versions every `.ezra/` change |

The installer prints the exact JSON configuration after install.

## Uninstall

```bash
npx ezra-claude-code --uninstall
```

## Requirements

- **Node.js** >= 16.7.0
- **Claude Code** installed and working
- **Git** (recommended, used by guard/reconcile/version commands)

## Testing

```bash
npm test       # Run all test suites
npm run lint   # Lint all files
```

Tests run on Windows, macOS, and Linux across Node 16, 18, 20, and 22.

## License

MIT
