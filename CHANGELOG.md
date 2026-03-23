# Changelog

All notable changes to EZRA are documented in this file.

## [5.0.0] — 2025-03-22

### Added
- Agent Management System — 100 agent roles, recommendations, deployment (`/ezra:agents`)
- One-command project onboarding (`/ezra:bootstrap`)
- Generate CLAUDE.md from governance state (`/ezra:claude-md`)
- AVI-OS context sync (`/ezra:sync`)
- `ezra-avios-bridge` hook — syncs decisions/scans to AVI-OS
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
