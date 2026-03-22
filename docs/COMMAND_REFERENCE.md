# EZRA Command Reference

All 22 slash commands available after installation.

## Setup & Onboarding

### `/ezra:init`
Initialize EZRA governance for a project.

- Scans codebase (language, framework, architecture, dependencies)
- Creates `.ezra/` directory structure
- Writes `governance.yaml` with protected path defaults
- Writes `knowledge.yaml` with discovered architecture
- **Idempotent:** safe to re-run

### `/ezra:bootstrap`
One-command project onboarding. Runs init + auto-configure + first ADR + health check + CLAUDE.md generation + version snapshot.

- Auto-detects language and framework from project files
- Applies sensible governance defaults (protected paths, coding standards)
- Creates ADR-001 documenting the governance initialization
- **Idempotent:** skips existing artifacts on re-run

### `/ezra:claude-md`
Generate or update `CLAUDE.md` from `.ezra/` state.

- Reads governance, knowledge, decisions, and version state
- Generates sections: Architecture, Active Decisions, Protected Paths, Standards, Tech Stack, Governance
- Uses `<!-- EZRA:START -->` / `<!-- EZRA:END -->` markers
- Preserves user content outside EZRA markers

---

## Analysis & Review

### `/ezra:scan`
Full multi-agent codebase analysis.

- Dispatches 4 agents in parallel: architect, reviewer, guardian, reconciler
- Produces health score (0-100) across 5 pillars
- Saves results to `.ezra/scans/{timestamp}.yaml`
- Run before major changes, after merges, or on a regular cadence

### `/ezra:review`
Multi-agent code review.

- Reviews staged changes, a specific file, or recent commits
- Dispatches architect (patterns, coupling) and reviewer (security, quality) agents
- Outputs findings with severity levels and confidence scores

### `/ezra:guard`
Check changes against governance rules.

- Compares staged/recent changes to protected paths and active decisions
- Detects protected path violations, decision non-compliance, standard deviations
- Non-blocking by default (warns); configurable to block

### `/ezra:health`
5-pillar health assessment.

| Pillar | Weight | What It Checks |
|--------|--------|----------------|
| On-Track | 25% | Plan adherence, decision coverage |
| No Gaps | 20% | Document completeness, test coverage |
| Clean | 15% | Code quality, lint compliance |
| Secure | 25% | Vulnerability findings, auth patterns |
| Best Practices | 15% | Architecture patterns, dependency hygiene |

- Scores each pillar 0-100
- Weighted aggregate score with letter grade (A/B/C/D/F)
- Actionable remediation for every gap

### `/ezra:advisor`
Proactive best-practice advisor.

- Analyses project state and lifecycle stage
- Delivers targeted suggestions, innovations, and warnings
- Usage: `/ezra:advisor` (full), `/ezra:advisor security` (focused)

---

## Decisions

### `/ezra:decide`
Record an architectural decision (ADR).

- Auto-increments ID (ADR-001, ADR-002, ...)
- Captures: decision, context, rationale, consequences, enforcement paths
- Categories: ARCHITECTURE, DATABASE, SECURITY, API, TESTING, INFRASTRUCTURE, DEPENDENCY, CONVENTION
- Status lifecycle: ACTIVE → SUPERSEDED or DEPRECATED
- Decisions become governance rules that `/ezra:guard` enforces

---

## Documentation

### `/ezra:doc`
Create, update, list, or reference SDLC documents.

- Supports 55 document types (business case, API spec, test strategy, runbook, etc.)
- Usage: `/ezra:doc create api-spec`, `/ezra:doc list`, `/ezra:doc status`
- Documents tracked in `.ezra/docs/registry.yaml`

### `/ezra:doc-check`
Document gap analysis.

- Determines project phase (inception, development, production, etc.)
- Shows which documents are missing, required, or stale
- Prioritises by criticality

### `/ezra:doc-sync`
Detect drift between codebase and existing documents.

- Compares code changes against registered document scopes
- Proposes updates for approval before applying
- Usage: `/ezra:doc-sync` (all), `/ezra:doc-sync api-spec` (one), `/ezra:doc-sync --auto`

### `/ezra:doc-approve`
Review and approve/reject pending document update proposals.

- Interactive review mode
- Usage: `/ezra:doc-approve` (all pending), `/ezra:doc-approve PROP-001` (specific)

---

## Status & Monitoring

### `/ezra:status`
Governance health dashboard.

- Shows: active decisions, violations, drift level, scan history, plan status
- Quick snapshot of governance state

### `/ezra:dash`
Real-time project dashboard.

- Shows: phase, health score, document coverage, decision count, risks, tests, deployment status, blockers
- More detailed than `/ezra:status`

---

## Process & Automation

### `/ezra:process`
Reusable workflow engine.

- Create custom step-by-step processes
- 12 step types: run-command, run-tests, scan, health, doc-check, doc-sync, guard, review, decide, reconcile, approval, report
- Guard rails: clean_git, passing_tests, health_score_min, no_env_files
- 5 built-in templates: full-remediation, release-prep, sprint-close, security-audit, onboarding
- Usage: `/ezra:process run release-prep`, `/ezra:process create my-workflow`

### `/ezra:auto`
Autonomous execution engine.

- Runs processes start-to-finish under continuous guard rail monitoring
- Dry-run mode for previewing without side effects
- Resume capability for interrupted processes
- Usage: `/ezra:auto release-prep`, `/ezra:auto release-prep --dry-run`

---

## Versioning & Reconciliation

### `/ezra:version`
Version control for all EZRA state.

- Tracks every change to decisions, documents, governance, knowledge, and plans
- Immutable append-only changelog with CHG-XXXX entries
- Named snapshots for checkpoints
- Usage: `/ezra:version` (current), `/ezra:version log`, `/ezra:version snapshot pre-release`, `/ezra:version diff v1 v2`

### `/ezra:reconcile`
Compare planned vs. actual implementation.

- Requires a plan registered in `.ezra/plans/`
- Identifies: completed items, gaps, drift, unplanned additions
- Calculates completion percentage

---

## Integration & Multi-Project

### `/ezra:sync`
Sync EZRA governance state with avios-context MCP server.

- Processes pending sync items (decisions and risks)
- Maps EZRA categories to avios-context categories (AD, DD, SC, TC)
- Requires `avios_integration.enabled: true` in governance.yaml
- Queues items for batch sync or immediate push

### `/ezra:multi`
Multi-project portfolio orchestration.

- Manage multiple EZRA-initialized projects from one location
- Usage: `/ezra:multi add <path>`, `/ezra:multi dash`, `/ezra:multi run security-audit --all`, `/ezra:multi health`
- Global config at `~/.ezra-portfolio.yaml`

### `/ezra:help`
Show all commands, agents, and current configuration.

- Lists all 22 commands with descriptions
- Shows 4 agents and their roles
- Displays `.ezra/` state directory structure
- Shows current project state if initialized
