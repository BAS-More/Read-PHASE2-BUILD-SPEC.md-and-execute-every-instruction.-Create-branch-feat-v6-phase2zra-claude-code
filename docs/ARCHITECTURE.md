# EZRA Architecture

## System Overview

EZRA is a multi-agent codebase governance framework implemented as a set of Markdown prompts, Node.js hooks, and YAML-based agent definitions that integrate with Claude Code's extension system.

```
┌─────────────────────────────────────────────────────────────┐
│                      Claude Code                            │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │ Commands │  │  Hooks   │  │  Agents  │  │   Skill   │  │
│  │ (22 .md) │  │ (5 .js)  │  │ (4 .md)  │  │ (SKILL.md)│  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────────┘  │
│       │              │              │                        │
│       └──────────────┴──────────────┘                       │
│                      │                                      │
│              ┌───────▼───────┐                              │
│              │   .ezra/      │  ← Persistent state          │
│              │   (per-project)│                              │
│              └───────────────┘                              │
└─────────────────────────────────────────────────────────────┘
```

## Component Architecture

### 1. Commands (22 Markdown files)

Location: `commands/ezra/*.md`

Commands are Claude Code slash commands defined as Markdown prompt files with YAML frontmatter. They are NOT executable code — they are structured instructions that Claude Code interprets and executes.

```yaml
---
name: ezra:scan
description: Full multi-agent codebase analysis
---

[Multi-phase workflow instructions for Claude Code to follow]
```

**Design principle:** Commands describe *what* to do, not *how*. Claude Code's intelligence handles the execution. This makes commands portable, testable, and version-controllable.

**Command categories:**

| Category | Commands |
|----------|----------|
| Setup | init, bootstrap, claude-md |
| Analysis | scan, review, guard, health, advisor |
| Decisions | decide |
| Documentation | doc, doc-check, doc-sync, doc-approve |
| Monitoring | status, dash |
| Automation | process, auto |
| Versioning | version, reconcile |
| Integration | sync, multi, help |

### 2. Hooks (5 Node.js scripts)

Location: `hooks/*.js`

Hooks are event-driven Node.js scripts that execute automatically in response to Claude Code lifecycle events. They follow a strict protocol:

```
Event occurs → Claude Code pipes JSON to stdin → Hook processes → JSON to stdout → Exit 0
```

**Hook protocol:**

| Field | Direction | Description |
|-------|-----------|-------------|
| `tool_input.file_path` | stdin | File being created/edited |
| `cwd` | stdin | Current working directory |
| `hookSpecificOutput.message` | stdout | Feedback message (optional) |
| `hookSpecificOutput.permissionDecision` | stdout | "allow" or "deny" (PreToolUse only) |

**Hook event mapping:**

```
SessionStart ──► ezra-dash-hook.js (display project status)

PreToolUse ────► ezra-guard.js (check protected paths)

PostToolUse ───► ezra-drift-hook.js (track doc staleness)
               ► ezra-version-hook.js (auto-version .ezra/ changes)
               ► ezra-avios-bridge.js (sync decisions/risks)
```

**Critical rules:**
- All hooks read JSON from stdin, write JSON to stdout
- All hooks MUST exit 0 — even on error (never block the user)
- No external dependencies — pure Node.js built-ins only
- 5-second timeout maximum
- Cross-platform (Windows, macOS, Linux)

### 3. Agents (4 Markdown definitions)

Location: `agents/*.md`

Agents are specialized subagent prompts dispatched by commands like `/ezra:scan` and `/ezra:review`. They run in parallel for speed.

```
/ezra:scan dispatches:
  ├── ezra-architect  (architecture analysis)
  ├── ezra-reviewer   (security + quality)
  ├── ezra-guardian   (governance compliance)
  └── ezra-reconciler (plan vs reality)
```

**Agent output contract:** All agents output structured YAML with typed findings:

```yaml
# Example: ezra-reviewer output
security_findings:
  - severity: CRITICAL
    confidence: 95
    location: src/auth/login.ts:42
    description: SQL injection via unsanitized input
    recommendation: Use parameterized queries

quality_findings:
  - severity: WARNING
    confidence: 80
    location: src/utils/helpers.ts
    description: Function exceeds 200 lines
```

### 4. Skill Definition

Location: `skills/ezra/SKILL.md`

The skill file enables Claude Code to auto-trigger EZRA when users mention governance, architecture, decisions, or related topics. It contains the full command list and capability description for Claude Code's routing.

### 5. Templates (5 YAML workflows)

Location: `templates/*.yaml`

Reusable process definitions consumed by `/ezra:process` and `/ezra:auto`:

```yaml
name: "Release Prep"
steps:
  - id: 1
    name: "Health gate"
    type: "command"
    command: "health"
  - id: 2
    name: "Security audit"
    type: "ezra"
    agent: "reviewer"
guard_rails:
  enforce_quality_gates: true
```

## Data Flow

### Decision Recording Flow

```
User: /ezra:decide "Use PostgreSQL"
  │
  ▼
Command parses decision text
  │
  ▼
Creates .ezra/decisions/ADR-NNN.yaml
  │
  ▼
PostToolUse triggers:
  ├── ezra-version-hook.js → bumps version, appends changelog
  └── ezra-avios-bridge.js → queues avios sync (if enabled)
```

### Guard Check Flow

```
User edits file (Write/Edit)
  │
  ▼
PreToolUse triggers ezra-guard.js
  │
  ▼
Guard reads .ezra/governance.yaml
  │
  ▼
Checks file path against protected_paths patterns
  │
  ├── No match → exit 0 (allow silently)
  │
  └── Match found → check for authorizing decision
       │
       ├── Decision exists → exit 0 (allow)
       └── No decision → output warning JSON (allow with warning)
```

### Scan Flow

```
User: /ezra:scan
  │
  ▼
Command dispatches 4 agents in parallel:
  ┌────────────────┬────────────────┬────────────────┬─────────────────┐
  │   Architect    │   Reviewer     │   Guardian     │   Reconciler    │
  │ (layers, deps) │ (OWASP, quality)│ (compliance)  │ (plan vs code) │
  └───────┬────────┴───────┬────────┴───────┬────────┴────────┬────────┘
          │                │                │                 │
          ▼                ▼                ▼                 ▼
     YAML findings    YAML findings    YAML findings    YAML findings
          │                │                │                 │
          └────────────────┴────────────────┴─────────────────┘
                                   │
                                   ▼
                    Merge results → calculate health score
                                   │
                                   ▼
                    Save to .ezra/scans/{timestamp}.yaml
```

### Drift Detection Flow

```
User edits src/routes/auth.ts (PostToolUse)
  │
  ▼
ezra-drift-hook.js reads file path
  │
  ▼
Checks relevance rules (routes/* → affects api-spec, security-arch)
  │
  ▼
Reads .ezra/docs/registry.yaml for existing docs
  │
  ▼
Increments .ezra/docs/.drift-counter.json
  │
  ▼
Every 10 edits or 3+ hits on same doc → stderr reminder:
  "EZRA: 10 edits since last doc-sync. Run /ezra:doc-sync"
```

## State Directory Schema

```
.ezra/
├── governance.yaml      # Project config, protected paths, standards
├── knowledge.yaml       # Architecture state from scans
├── decisions/
│   ├── ADR-001.yaml     # Architectural Decision Records
│   └── ADR-002.yaml
├── scans/
│   └── 2026-03-19.yaml  # Timestamped scan results
├── plans/
│   └── sprint-12.yaml   # Registered plans for reconciliation
├── docs/
│   ├── registry.yaml    # Document registry (55 types)
│   ├── proposals/       # Pending doc update proposals
│   └── .drift-counter.json
├── versions/
│   ├── current.yaml     # Current version + health score
│   └── changelog.yaml   # Immutable append-only log
├── handoffs/            # Session handoff briefs (future)
├── compliance/          # Compliance evidence packs (future)
└── .avios-sync/
    ├── pending/         # Items queued for avios-context sync
    └── completed/       # Processed sync items
```

## Cross-Platform Design

Every component follows these rules:

- `path.join()` for all path construction (never string concatenation)
- `os.homedir()` for user directory (never `~` or `$HOME`)
- `os.tmpdir()` for temporary files (never `/tmp`)
- `process.platform === 'win32'` checks where needed
- Forward-slash normalisation for glob matching
- No external npm dependencies — Node.js built-ins only

## Zero-Dependency Constraint

EZRA uses exactly zero npm packages. All functionality is implemented with Node.js built-ins:

| Need | Solution |
|------|----------|
| YAML parsing | Regex-based simple parser with JSON fallback |
| Glob matching | Custom `matchGlob()` using RegExp |
| File operations | `fs` module |
| Path handling | `path` module |
| User directory | `os.homedir()` |
| Child processes | `child_process.execSync` (tests only) |
| Terminal colours | ANSI escape codes (CLI only) |
| Interactive input | `readline` module (CLI only) |

This ensures maximum portability, zero supply-chain risk, and instant installation.
