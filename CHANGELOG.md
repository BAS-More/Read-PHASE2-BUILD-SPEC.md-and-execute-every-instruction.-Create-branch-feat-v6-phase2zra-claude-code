# Changelog

All notable changes to EZRA are documented in this file.

## [6.0.0] — 2026-03-24

### Overview

EZRA v6.0.0 is a major release delivering 39 commands, 22 hooks, 4 core agent engines with 100 specialized roles, 55 SDLC document types, 5 process templates, and 23 test suites — all with zero external dependencies.

### Added — Phase 4: V6 Enhancement Foundation
- **Settings System** (`/ezra:settings`) — unified settings management with `ezra-settings.js` parser and `ezra-settings-writer.js` write-back engine
- **Best Practice Library** (`/ezra:library`) — browse, search, and add practices across 14 categories via `ezra-library.js`
- **Oversight Revamp** (`/ezra:oversight`) — real-time agent oversight with 4 intervention levels (monitor, warn, gate, strict) via `ezra-oversight.js`
- **Compliance Profiles** (`/ezra:compliance`) — ISO 25010, OWASP, SOC2, HIPAA, PCI-DSS, GDPR, WCAG enforcement
- **Research Agent** (`/ezra:research`) — automated best practice discovery

### Added — Phase 5: Multi-Agent Orchestration
- **Agent Management** (`/ezra:agents`) — 100 specialized agent roles across 12 domains with weighted task assignment via `ezra-agents.js`
- Agent roster with list, recommend, deploy, and info subcommands
- 14 deployment presets for common workflows
- Scoring and cost tracking per agent invocation

### Added — Phase 6: Dashboard Data + Cloud Sync
- **Portfolio Dashboard** (`/ezra:portfolio`) — cross-project health and status aggregation via `ezra-dashboard-data.js`
- **Handoff Briefs** (`/ezra:handoff`) — generate structured handoff documents for team transitions
- **Cloud Sync** — backup/restore governance state via `ezra-cloud-sync.js` and `ezra-http.js`
- **Cost Tracking** (`/ezra:cost`) — AI agent usage tracking and budget management

### Added — Phase 7: Workflow Templates Engine
- **Workflow Engine** (`/ezra:workflow`) — 9 step types with process management via `ezra-workflows.js`
- **Process Management** (`/ezra:process`) — create, run, edit, and save reusable step-by-step workflows
- **Template Validation** — 5 built-in templates: full-remediation, release-prep, sprint-close, security-audit, onboarding

### Added — Phase 8: Agent Memory System
- **Memory Engine** (`/ezra:memory`) — pattern, lesson, and fact storage with auto-capture via `ezra-memory.js` and `ezra-memory-hook.js`
- Deduplication, archival, and cross-session recall
- **Learn Command** (`/ezra:learn`) — teach EZRA project-specific patterns and conventions

### Added — Phase 9: Holistic Planning Engine
- **Planning Engine** (`/ezra:plan`) — 7-stage pipeline with gap checking and checkpoints via `ezra-planner.js`
- **Project Management** (`/ezra:pm`) — sprint tracking, task management, burndown via `ezra-pm.js`
- **Progress Tracking** (`/ezra:progress`) — real-time progress monitoring via `ezra-progress-hook.js`

### Added — Phase 10: Licensing + Distribution
- **Licensing System** (`/ezra:license`) — tiered licensing (community, pro, enterprise) with feature gating via `ezra-license.js` and `ezra-tier-gate.js`
- **CLI Installer** (`/ezra:install`) — cross-platform installation via `ezra-installer.js`
- npm publish preparation with `.npmignore`, keywords, and package metadata

### Commands (39 total)
| Category | Commands |
|----------|----------|
| Governance & Analysis | `init`, `scan`, `guard`, `reconcile`, `decide`, `review`, `health`, `advisor`, `status` |
| Dashboard & Documents | `dash`, `doc`, `doc-check`, `doc-sync`, `doc-approve` |
| Process & Automation | `process`, `auto`, `workflow` |
| Multi-Project | `multi`, `portfolio` |
| Planning & PM | `plan`, `pm`, `progress` |
| Agent & Memory | `agents`, `memory`, `learn` |
| Settings & Compliance | `settings`, `compliance`, `oversight`, `library`, `research`, `cost` |
| Setup & Integration | `bootstrap`, `claude-md`, `sync`, `handoff`, `license`, `install` |
| Info | `help`, `version` |

### Hooks (22 total)
- `ezra-guard.js` — Protected path enforcement (PreToolUse)
- `ezra-dash-hook.js` — Session dashboard (SessionStart)
- `ezra-drift-hook.js` — Document drift detection (PostToolUse)
- `ezra-version-hook.js` — Automatic versioning (PostToolUse)
- `ezra-avios-bridge.js` — AVI-OS context sync (PostToolUse)
- `ezra-oversight.js` — Real-time agent oversight (PreToolUse)
- `ezra-settings.js` — Unified settings parser
- `ezra-settings-writer.js` — Settings write-back engine
- `ezra-library.js` — Best practice library engine
- `ezra-agents.js` — Multi-agent orchestration
- `ezra-cloud-sync.js` — Cloud backup/restore
- `ezra-dashboard-data.js` — Dashboard data aggregation
- `ezra-http.js` — HTTP transport layer
- `ezra-installer.js` — Cross-platform installer
- `ezra-license.js` — License validation
- `ezra-memory.js` — Memory storage engine
- `ezra-memory-hook.js` — Auto-capture memory hook
- `ezra-planner.js` — Planning pipeline engine
- `ezra-pm.js` — Project management engine
- `ezra-progress-hook.js` — Progress tracking hook
- `ezra-tier-gate.js` — Feature tier gating
- `ezra-workflows.js` — Workflow execution engine

### Test Suites (23 files)
- Core: `test-structure.js`, `test-commands.js`, `test-hooks.js`, `test-cli.js`, `test-templates.js`
- Integration: `test-e2e.js`, `test-uat.js`, `test-avios-bridge.js`, `test-v6-integration.js`
- V6 Features: `test-v6-agents.js`, `test-v6-agents-real.js`, `test-v6-dashboard-data.js`, `test-v6-library.js`, `test-v6-license.js`, `test-v6-memory.js`, `test-v6-oversight.js`, `test-v6-planner.js`, `test-v6-pm.js`, `test-v6-settings-roundtrip.js`, `test-v6-settings-writer.js`, `test-v6-workflows.js`
- Quality: `lint-all.js`, `run-tests.js`

### Changed
- README updated to reflect 39 commands, 22 hooks, 100 agent roles
- CLAUDE.md updated with full command list and project conventions
- SKILL.md updated with auto-triggering on all 39 commands
- `bin/cli.js` manifest updated for all commands, hooks, and templates

### Infrastructure
- Zero external dependencies — pure Node.js built-ins only
- Cross-platform support: Windows, macOS, Linux
- CI: GitHub Actions across Node 16, 18, 20, 22
- npm package with scoped `files` field and `.npmignore`

## [5.0.0] — 2025-03-22

### Added
- Agent Management System — 100 agent roles, recommendations, deployment (`/ezra:agents`)
- One-command project onboarding (`/ezra:bootstrap`)
- Generate CLAUDE.md from governance state (`/ezra:claude-md`)
- AVI-OS context sync (`/ezra:sync`)
- `ezra-avios-bridge` hook — syncs decisions/scans to AVI-OS context
- Gap analysis documentation for Quiz2Biz ecosystem
- Initial governance, knowledge, and risk management documents
- GoDaddy DNS documentation
- EZRA V5 Build Spec (12 features)
- GitHub Actions CI pipeline (Node 16/18/20/22 × Linux/Windows/macOS)
- CHANGELOG.md

### Changed
- README.md updated to reflect 23 commands and 5 hooks
- CLAUDE.md updated with correct command count and list
- All hooks now include `'use strict'` directive

### Fixed
- Complete AEGIS-to-EZRA identity rebrand
- Cross-platform E2E and UAT tests (Windows echo quoting, `/tmp` paths)
- YAML dependency resolution, missing commands in SKILL/help, dash-hook stdin
- CRLF line endings normalised

## [4.0.0] — 2025-02-15

### Added
- 19 governance commands (init, scan, guard, reconcile, decide, review, status, help, doc, dash, doc-check, doc-sync, doc-approve, version, health, advisor, process, auto, multi)
- 4 subagent engines (architect, guardian, reconciler, reviewer)
- 4 hooks (ezra-guard, ezra-dash-hook, ezra-drift-hook, ezra-version-hook)
- 5 process templates (release-prep, sprint-close, security-audit, onboarding, incident-response)
- Cross-platform CLI installer (`bin/cli.js`)
- SKILL.md for Claude Code auto-triggering
- 9 test suites with built-in assert (206 tests)
