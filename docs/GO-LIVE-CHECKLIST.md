# EZRA Go-Live Checklist

## Pre-Launch

- [ ] All 1370 tests passing (node tests/run-tests.js)
- [ ] Version bumped consistently across all files
- [ ] CLAUDE.md version matches package.json
- [ ] No uncommitted changes (git status clean)
- [ ] All commits pushed to origin/main
- [ ] RELEASE-MANIFEST.yaml updated with new version and date

## Security

- [ ] Zero hardcoded secrets in source (grep verified)
- [ ] .env in .gitignore, no .env files tracked
- [ ] npm audit clean (zero dependencies = automatic pass)
- [ ] SSRF protection in ezra-http.js verified
- [ ] Hook protocol: all hooks exit 0, read stdin JSON

## Quality

- [ ] Lint passes (node tests/lint-all.js) — 155 checks
- [ ] E2E tests pass (node tests/test-e2e.js) — 21 tests
- [ ] UAT tests pass (node tests/test-uat.js) — 24 tests
- [ ] All 'use strict' in every .js file
- [ ] Cross-platform CI green (ubuntu, windows, macos × Node 18, 20, 22)

## Documentation

- [ ] README.md current (277+ lines)
- [ ] CHANGELOG.md updated with release notes
- [ ] COMMAND_REFERENCE.md covers all 39 commands
- [ ] HOOKS_AND_AGENTS.md covers all 24 hooks
- [ ] ARCHITECTURE.md reflects current state

## Deployment

- [ ] npm published (npm view ezra-claude-code version)
- [ ] VS Code extension published (marketplace verification complete)
- [ ] Global hooks synced (~/.claude/hooks/)
- [ ] Settings engine operational (3-layer merge verified)
- [ ] All 5+ governed projects have .ezra/settings.yaml

## Post-Launch

- [ ] Smoke test: hooks fire in fresh claude session
- [ ] Smoke test: /ezra:settings shows interactive menu
- [ ] Smoke test: /ezra:health runs without errors
- [ ] Health score recorded in .ezra/scans/
- [ ] Version state updated in .ezra/versions/current.yaml
