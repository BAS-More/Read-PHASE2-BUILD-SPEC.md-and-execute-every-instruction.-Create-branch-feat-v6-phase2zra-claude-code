# EZRA Backup & Disaster Recovery Plan

## What Needs Protection

| Asset | Location | Recovery Method |
|-------|----------|----------------|
| Source code | GitHub (BAS-More/ezra-claude-code) | Git clone |
| npm package | npmjs.com/ezra-claude-code | Republish from source |
| VS Code extension | VS Marketplace | Rebuild and upload .vsix |
| Governance state | .ezra/ per project | Git (committed) or backup |
| Global hooks | ~/.claude/hooks/ | Reinstall from npm package |
| Global settings | ~/.claude/settings.json | Manual reconfiguration |
| Global defaults | ~/.claude/hooks/ezra-defaults.yaml | Reinstall from npm |

## Backup Strategy

### Automatic (Git)
- All source code, commands, hooks, agents, templates committed to GitHub
- .ezra/ governance state committed per project
- CI/CD config (.github/workflows/) committed

### Manual (Not in Git)
- `~/.claude/settings.json` — export periodically
- `~/.claude/hooks/ezra-defaults.yaml` — included in npm package
- npm auth tokens — stored in ~/.npmrc
- Azure DevOps PAT — regenerate if lost

## Recovery Scenarios

### Scenario 1: Local Machine Lost
```bash
# 1. Clone repo
git clone https://github.com/BAS-More/ezra-claude-code.git

# 2. Install globally
cd ezra-claude-code && node bin/cli.js install --global

# 3. Reconfigure hooks in ~/.claude/settings.json
# (copy from docs/DEPLOY-RUNBOOK.md or use /ezra:install)

# 4. Restore npm auth
npm login
```

### Scenario 2: npm Package Corrupted
```bash
# Republish from clean source
git checkout v6.1.0
npm publish
```

### Scenario 3: VS Code Extension Removed
```bash
# Rebuild and upload
cd C:\Dev\ezra-vscode
npx tsc && npx vsce package
# Upload .vsix via marketplace UI or npx vsce publish
```

### Scenario 4: .ezra/ State Corrupted
```bash
# Restore from git
git checkout HEAD -- .ezra/

# Or reinitialize
/ezra:init
# Then restore decisions from git history
git log --all -- .ezra/decisions/
```

### Scenario 5: Global Hooks Broken
```bash
# Reinstall from npm package
npm install -g ezra-claude-code
ezra install --global
# Or manually copy
cp node_modules/ezra-claude-code/hooks/*.js ~/.claude/hooks/
```

## Recovery Time Objectives

| Scenario | RTO | RPO |
|----------|-----|-----|
| Local machine lost | 30 min | Last git push |
| npm package issue | 5 min | Last publish |
| VS Code extension | 10 min | Last .vsix build |
| .ezra/ corruption | 2 min | Last commit |
| Hooks broken | 5 min | Last install |

## Testing Recovery
Run quarterly:
1. Clone to temp directory, install, verify hooks fire
2. Run full test suite from clean clone
3. Verify /ezra:health runs in a fresh project
