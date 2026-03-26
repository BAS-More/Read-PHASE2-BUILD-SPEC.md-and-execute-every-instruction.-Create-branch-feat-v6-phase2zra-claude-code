# EZRA (עזרא) — Codebase Governance Framework for Claude Code

## Project
- **Repo**: C:\Dev\ezra-claude-code (github.com/BAS-More/ezra-claude-code)
- **Version**: 6.1.0
- **License**: MIT
- **Node**: >=16.7.0
- **Dependencies**: ZERO — pure Node.js only. Do NOT add any npm dependencies.

## Architecture
- **Commands** (`commands/ezra/*.md`): Markdown prompt files that Claude Code executes as slash commands. Each has YAML frontmatter with `name` and `description`.
- **Agents** (`agents/*.md`): Markdown prompt files for subagent dispatch. Referenced by scan/review commands.
- **Hooks** (`hooks/*.js`): Node.js scripts that read JSON from stdin (Claude Code hook protocol) and output JSON to stdout. Must always exit 0 on graceful handling.
- **CLI** (`bin/cli.js`): Cross-platform installer that copies files to `~/.claude/` (global) or `.claude/` (local).
- **Templates** (`templates/*.yaml`): Reusable process workflow definitions.
- **Skill** (`skills/ezra/SKILL.md`): Claude Code skill definition for auto-triggering.
- **State**: `.ezra/` directory at each governed project root (decisions, scans, plans, governance.yaml, knowledge.yaml, versions).

## Critical Rules
1. **Zero dependencies.** No `require()` of external packages. Use only Node.js built-ins (fs, path, os, child_process, crypto, readline, http).
2. **Cross-platform.** Use `path.join()`, `os.homedir()`, `os.tmpdir()`, `process.platform`. Never hardcode paths.
3. **Hook protocol.** All hooks read JSON from stdin, output JSON to stdout, exit 0 on success or graceful failure.
4. **Identity.** The project is EZRA (עזרא), NOT AEGIS. Every reference must use EZRA/Ezra/ezra. Zero "aegis" references anywhere.
5. **Tests.** All tests use built-in `assert`. Pattern: `function test(name, fn)`, `function assert(cond, msg)`. Suites report `PASSED: N FAILED: M`.

## Test Suites
Run all: `node tests/run-tests.js`
- `test-structure.js` — Directory structure, file counts, critical files
- `test-commands.js` — Command frontmatter, cross-references, content validation
- `test-hooks.js` — Hook syntax, stdin handling, graceful failure
- `test-cli.js` — CLI install/uninstall logic
- `test-templates.js` — Template YAML validation
- `test-avios-bridge.js` — AVI-OS bridge hook protocol
- `test-v6-oversight.js` — Oversight engine and violation tracking
- `test-v6-pm.js` — Project management and milestones
- `test-v6-settings-writer.js` — Settings persistence
- `test-v6-settings-roundtrip.js` — Settings read/write roundtrip
- `test-v6-library.js` — Best practice library
- `test-v6-agents.js` — Agent orchestration
- `test-v6-dashboard-data.js` — Dashboard data aggregation
- `test-v6-workflows.js` — Workflow template engine
- `test-v6-memory.js` — Agent memory system
- `test-v6-planner.js` — Planning engine
- `test-v6-integration.js` — Cross-hook integration
- `test-v6-license.js` — License management
- `test-v6-agents-real.js` — Agent real-world scenarios
- `test-v6-http.js` — HTTP module, SSRF protection, URL validation
- `test-v6-cloud-sync.js` — Cloud sync backup/restore/manifest
- `test-v6-dash-hook.js` — Dashboard hook session start
- `test-v6-drift-hook.js` — Drift tracking hook
- `test-v6-error-codes.js` — Error code catalog and formatting
- `test-v6-guard.js` — Guard hook protected paths
- `test-v6-hook-logger.js` — Structured JSON logger
- `test-v6-installer.js` — Installer copy/uninstall logic
- `test-v6-memory-hook.js` — Memory auto-capture hook
- `test-v6-progress-hook.js` — Progress tracking hook
- `test-v6-tier-gate.js` — Tier gate license enforcement
- `test-v6-version-hook.js` — Version tracking hook
- `lint-all.js` — Code quality (strict mode, no console.error, proper exit codes)
- `test-e2e.js` — End-to-end flows in temp directories
- `test-uat.js` — Alpha/Beta/UAT acceptance tests

## Commands (39 current)
/ezra:init, /ezra:scan, /ezra:guard, /ezra:reconcile, /ezra:decide, /ezra:review, /ezra:status, /ezra:help, /ezra:doc, /ezra:dash, /ezra:doc-check, /ezra:doc-sync, /ezra:doc-approve, /ezra:version, /ezra:health, /ezra:advisor, /ezra:process, /ezra:auto, /ezra:multi, /ezra:bootstrap, /ezra:claude-md, /ezra:agents, /ezra:sync, /ezra:oversight, /ezra:settings, /ezra:learn, /ezra:pm, /ezra:progress, /ezra:compliance, /ezra:library, /ezra:research, /ezra:cost, /ezra:portfolio, /ezra:handoff, /ezra:workflow, /ezra:memory, /ezra:plan, /ezra:license, /ezra:install

## Build Spec
See `EZRA_V5_BUILD_SPEC.md` and `PHASE1-BUILD-SPEC.md` for full enhancement specifications.

## Working Conventions
- Commit after each feature with descriptive messages
- Run full test suite after each change
- Two consecutive all-green required before pushing
- Update README.md, SKILL.md, help.md, and bin/cli.js manifest for every new command/hook
