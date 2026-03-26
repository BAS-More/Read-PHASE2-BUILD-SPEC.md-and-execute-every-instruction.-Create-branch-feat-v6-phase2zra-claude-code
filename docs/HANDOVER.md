# EZRA Technical Handover Document

## Project Summary
- **Name:** EZRA (ezra-claude-code)
- **Version:** 6.1.0
- **Purpose:** Multi-agent codebase governance framework for Claude Code
- **License:** MIT
- **Language:** JavaScript (Node.js, zero external dependencies)

## Repository Structure
```
ezra-claude-code/
  bin/cli.js              — Cross-platform CLI installer
  commands/ezra/*.md      — 39 slash commands (markdown prompts)
  agents/*.md             — 4 core subagent engines + 100-role registry
  hooks/*.js              — 24 hooks (stdin JSON protocol, always exit 0)
  skills/ezra/SKILL.md    — Auto-trigger skill definition
  templates/*.yaml        — 5 reusable workflow templates
  tests/*.js              — 35 test files, 1370 tests
  docs/*.md               — 18+ documentation files
  .ezra/                  — Per-project governance state
  .github/workflows/      — CI (3 OS × 3 Node versions)
```

## Key Architecture Decisions
| ADR | Decision |
|-----|----------|
| ADR-001 | Zero external dependencies — pure Node.js built-ins |
| ADR-002 | Hook protocol — JSON stdin/stdout, always exit 0 |
| ADR-003 | Identity is EZRA — zero old name references |
| ADR-004 | Cross-platform compatibility required |
| ADR-005 | 4-level oversight gating (monitor/warn/gate/strict) |
| ADR-006 | Multi-agent orchestration with budget controls |

## Critical Constraints
1. **ZERO npm dependencies.** Only Node.js built-ins allowed.
2. **All hooks exit 0.** Even on error — communicate via JSON output.
3. **Cross-platform.** Use path.join(), os.homedir(), process.platform.
4. **Identity.** Project name is EZRA, not AEGIS. Zero old references.

## Configuration System
3-layer settings merge (lowest to highest priority):
1. Hardcoded defaults in `hooks/ezra-settings.js`
2. Global user preferences in `~/.claude/hooks/ezra-defaults.yaml`
3. Per-project overrides in `.ezra/settings.yaml`

## Deployment Targets
| Component | Target | Verify |
|-----------|--------|--------|
| Core | npm (ezra-claude-code) | `npm view ezra-claude-code version` |
| Extension | VS Marketplace (bas-more.ezra-governance) | Marketplace page |
| Hooks | ~/.claude/hooks/ | `ls ~/.claude/hooks/ezra-*.js` |

## Accounts & Access
- **npm:** avi770 (npmjs.com)
- **GitHub:** BAS-More org (github.com/BAS-More)
- **Azure DevOps:** bas-more org (dev.azure.com/bas-more)
- **VS Marketplace:** bas-more publisher (avi@basnmore.com.au)

## How to Run Tests
```bash
node tests/run-tests.js    # Full suite (1370 tests)
node tests/lint-all.js     # Lint only (155 checks)
node tests/test-e2e.js     # End-to-end (21 tests)
node tests/test-uat.js     # Acceptance (24 tests)
```

## How to Release
See `docs/DEPLOY-RUNBOOK.md` for step-by-step procedure.

## Governed Projects
| Project | Path | Status |
|---------|------|--------|
| EZRA | C:\Dev\Ezra | Primary |
| Agen-MVP | C:\Dev\Agen-MVP | Governed |
| MAH | C:\Dev\MAH | Governed |
| bas-more-platform | C:\Dev\bas-more-platform | Governed |
| quiz-to-build | C:\Dev\quiz-to-build | Governed |

## Known Issues
- 7 hooks exceed 500 lines (ezra-pm.js at 712 is largest)
- VS Code marketplace publisher newly registered (no verified domain yet)
- No automated CI/CD for npm publish or vsce publish
