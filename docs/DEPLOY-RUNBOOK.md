# EZRA Deployment Runbook

## Overview
Step-by-step procedure for deploying EZRA v6.x to all production targets.

## Prerequisites
- Node.js >= 16.7.0
- npm account authenticated (`npm whoami`)
- Azure DevOps PAT with Marketplace Manage scope
- VS Code with `vsce` installed (`npx vsce --version`)
- All 1370 tests passing (`node tests/run-tests.js`)

## Components (6 total)

| Component | Target | Package |
|-----------|--------|---------|
| Core | npm | ezra-claude-code |
| VS Code Extension | VS Marketplace | bas-more.ezra-governance |
| MCP Server | Supabase Edge | ezra-mcp |
| Cloud Functions | Supabase Edge | ezra-cloud |
| Dashboard | Static hosting | ezra-dashboard |
| CLI Installer | npm (bundled) | bin/cli.js |

## Deployment Steps

### 1. Pre-flight Checks
```bash
cd C:\Dev\Ezra
node tests/run-tests.js          # Must be ALL GREEN
git status                        # Must be clean
git log origin/main..HEAD         # Must be empty (all pushed)
npm view ezra-claude-code version # Note current version
```

### 2. Version Bump
```bash
# Update version in:
# - package.json
# - bin/cli.js (EZRA_VERSION constant)
# - CLAUDE.md
# - tests/test-structure.js
# - tests/test-cli.js
node tests/run-tests.js          # Verify tests still pass
```

### 3. Publish to npm
```bash
npm publish
npm view ezra-claude-code version  # Verify new version
```

### 4. Build & Publish VS Code Extension
```bash
cd C:\Dev\ezra-vscode
# Update version in package.json to match
npx tsc                           # Compile
npx vsce package                  # Build .vsix
npx vsce publish                  # Publish to marketplace
```

### 5. Deploy Cloud Functions (if changed)
```bash
cd C:\Dev\ezra-cloud
supabase functions deploy validate-license
supabase functions deploy activate-license
supabase functions deploy deactivate-license
```

### 6. Sync Hooks to Global
```bash
cd C:\Dev\Ezra
cp hooks/*.js ~/.claude/hooks/
```

### 7. Post-deploy Verification
```bash
npm view ezra-claude-code version           # Confirm npm
code --list-extensions --show-versions | grep ezra  # Confirm VS Code
node -e "require('./hooks/ezra-settings.js')"       # Confirm hooks load
```

## Rollback Procedure
```bash
# npm: unpublish or publish previous version
npm unpublish ezra-claude-code@<bad-version>

# VS Code: upload previous .vsix via marketplace UI
# https://marketplace.visualstudio.com/manage/publishers/bas-more

# Hooks: restore from git
git checkout <previous-tag> -- hooks/
cp hooks/*.js ~/.claude/hooks/
```

## Release Manifest
Single source of truth: `RELEASE-MANIFEST.yaml`
All 6 components deploy together or none deploy.
