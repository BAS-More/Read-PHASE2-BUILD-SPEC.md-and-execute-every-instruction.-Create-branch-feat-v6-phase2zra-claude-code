# EZRA (עזרא) — Codebase Governance Framework for Claude Code

## Project
- **Repo**: C:\Dev\ezra-claude-code (github.com/BAS-More/ezra-claude-code)
- **Version**: 4.0.0 (building toward 5.0.0)
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
- `lint-all.js` — Code quality (strict mode, no console.error, proper exit codes)
- `test-e2e.js` — End-to-end flows in temp directories
- `test-uat.js` — Alpha/Beta/UAT acceptance tests

## Commands (23 current)
/ezra:init, /ezra:scan, /ezra:guard, /ezra:reconcile, /ezra:decide, /ezra:review, /ezra:status, /ezra:help, /ezra:doc, /ezra:dash, /ezra:doc-check, /ezra:doc-sync, /ezra:doc-approve, /ezra:version, /ezra:health, /ezra:advisor, /ezra:process, /ezra:auto, /ezra:multi, /ezra:bootstrap, /ezra:claude-md, /ezra:agents, /ezra:sync

## Build Spec
See `EZRA_V5_BUILD_SPEC.md` for the full v5.0.0 enhancement specification (12 features).

## Working Conventions
- Commit after each feature with descriptive messages
- Run full test suite after each change
- Two consecutive all-green required before pushing
- Update README.md, SKILL.md, help.md, and bin/cli.js manifest for every new command/hook
