# Getting Started with EZRA

> *"Ezra had set his heart to seek the Torah of Hashem, and to do it, and to teach in Israel statute and ordinance."* — Ezra 7:10

EZRA (עזרא) is a codebase governance framework for Claude Code. It tracks architectural decisions, enforces protected paths, detects document drift, reviews code quality, and keeps your project honest.

## Prerequisites

- **Node.js** >= 16.7.0
- **Claude Code** installed and working
- A git-managed project

## Installation

### Option A: Global (all projects)

```bash
npx ezra-claude-code --claude --global
```

Installs to `~/.claude/`. Every Claude Code session gets EZRA commands.

### Option B: Local (single project)

```bash
npx ezra-claude-code --claude --local
```

Installs to `./.claude/`. Only this project gets EZRA.

### Verify Installation

Restart Claude Code, then run:

```
/ezra:help
```

You should see all 22 commands listed.

## First-Time Setup

### The Fast Way: Bootstrap

Run one command and EZRA handles everything:

```
/ezra:bootstrap
```

Bootstrap automatically:
1. Creates `.ezra/` directory structure
2. Scans your codebase (language, framework, architecture)
3. Configures protected paths (`.env*`, migrations, Dockerfiles, etc.)
4. Applies language-specific coding standards
5. Creates ADR-001 (governance initialized)
6. Runs a baseline health check
7. Generates a `CLAUDE.md` so future sessions have governance context
8. Creates version snapshot

**Output:**
```
EZRA Bootstrap Complete
═══════════════════════════════════════════
Project: my-app
Language: TypeScript | Framework: NestJS
Protected paths: 6 configured
Baseline health: 75/100
CLAUDE.md: Generated
═══════════════════════════════════════════
```

### The Manual Way: Init + Configure

If you prefer step-by-step control:

```
/ezra:init
```

Then customise `.ezra/governance.yaml` and run:

```
/ezra:health
```

## Core Workflow

Once EZRA is initialised, the typical workflow is:

```
1. /ezra:decide    → Record key architectural decisions
2. /ezra:scan      → Baseline analysis (architecture + security + quality)
3. ... write code ...
4. /ezra:guard     → Check your changes before committing
5. /ezra:review    → Deep multi-agent review before PR
6. /ezra:status    → Ongoing health monitoring
```

## Your First Decision

Record an architectural decision:

```
/ezra:decide Use PostgreSQL as the primary database because it supports JSONB and has strong ecosystem support
```

EZRA creates `ADR-002` in `.ezra/decisions/` with:
- Status: ACTIVE
- Category: auto-detected (DATABASE)
- Enforcement paths: auto-suggested
- Rationale: captured

## Your First Scan

Run a full codebase analysis:

```
/ezra:scan
```

EZRA dispatches 4 agents in parallel:
- **Architect** — maps layers, traces dependencies
- **Reviewer** — OWASP security scan + code quality
- **Guardian** — checks compliance with your decisions
- **Reconciler** — compares plan vs. reality

Results are saved to `.ezra/scans/` with a health score.

## Auto-Hooks (Optional)

EZRA can run automatically on every file edit:

| Hook | Trigger | What It Does |
|------|---------|--------------|
| **Guard** | Before Write/Edit | Warns if you touch a protected path |
| **Dash** | Session start | Shows 3-line project status |
| **Drift** | After Write/Edit | Tracks document staleness |
| **Version** | After Write/Edit | Auto-versions `.ezra/` state changes |
| **AVI-OS Bridge** | After Write/Edit | Syncs decisions/risks to avios-context |

After installation, the CLI shows the exact JSON to add to `settings.json`.

## What's in `.ezra/`?

```
.ezra/
├── decisions/         # ADR-001.yaml, ADR-002.yaml, ...
├── scans/             # Timestamped scan results
├── plans/             # Registered plans for reconciliation
├── docs/              # Document registry and drift tracking
├── versions/          # changelog.yaml + current.yaml
├── governance.yaml    # Rules, protected paths, standards
└── knowledge.yaml     # What EZRA knows about your codebase
```

**Commit `.ezra/` to git.** It's your governance audit trail.

## Next Steps

| Goal | Command |
|------|---------|
| See all commands | `/ezra:help` |
| Check project health | `/ezra:health` |
| Generate documentation | `/ezra:doc create <type>` |
| Check doc coverage | `/ezra:doc-check` |
| Run a reusable process | `/ezra:process list` |
| Manage multiple projects | `/ezra:multi add <path>` |

## Uninstalling

```bash
npx ezra-claude-code --uninstall --global   # Remove from ~/.claude/
npx ezra-claude-code --uninstall --local    # Remove from ./.claude/
```

EZRA never modifies your source code. Uninstalling removes only EZRA's Claude Code files. Your `.ezra/` state directory remains untouched.
