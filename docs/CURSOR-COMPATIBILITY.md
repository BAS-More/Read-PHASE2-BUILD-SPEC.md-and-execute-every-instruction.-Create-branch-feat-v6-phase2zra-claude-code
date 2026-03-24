# EZRA + Cursor Compatibility Guide

## Overview

Cursor is a fork of VS Code. EZRA supports Cursor through two paths:
1. **VS Code Extension** — install the EZRA VS Code extension directly in Cursor
2. **CLI + .cursorrules** — use EZRA CLI with Cursor's native rules system

## Path 1: VS Code Extension in Cursor

Cursor supports VS Code extensions natively since it's built on the same platform.

### Installation
1. Download `ezra-governance-6.0.0.vsix` from [GitHub Releases](https://github.com/BAS-More/ezra-vscode/releases)
2. In Cursor: Extensions panel → `...` menu → "Install from VSIX"
3. Select the downloaded .vsix file
4. Restart Cursor

### What Works
- Status bar indicators (health score, oversight level, cost)
- Sidebar tree views (agents, progress, memory, oversight, settings)
- Settings WebView panel
- Dashboard WebView panel
- File watcher on `.ezra/` directory
- All `/ezra:*` commands via Command Palette

### Limitations
- Cursor's AI agent (Cursor Agent) is separate from Claude Code
- EZRA hooks (PreToolUse/PostToolUse) only fire for Claude Code, not Cursor Agent
- For Cursor Agent governance, use Path 2 (.cursorrules)

## Path 2: CLI + .cursorrules

Cursor supports `.cursorrules` files that instruct its AI agent. EZRA provides a template that enforces governance rules through Cursor's native system.

### Setup
1. Install EZRA CLI: `npm install -g ezra-claude-code`
2. Initialize: `cd your-project && ezra init`
3. Copy the EZRA cursorrules template: `cp node_modules/ezra-claude-code/templates/cursorrules-template .cursorrules`
4. Customize `.cursorrules` for your project

### How It Works
The `.cursorrules` file instructs Cursor Agent to:
- Check `.ezra/settings.yaml` before making changes
- Follow standards defined in EZRA governance
- Run health scans before committing
- Log decisions in `.ezra/decisions/`
- Respect oversight levels and red lines

### CLI Commands
Run EZRA commands in Cursor's terminal:
```bash
ezra scan          # Health scan
ezra status        # Quick status
ezra health        # Detailed health report
ezra decide        # Record a decision
```

## Path 3: Hybrid (Recommended)

Use both paths together:
1. Install the VS Code extension for UI indicators and dashboards
2. Add `.cursorrules` for Cursor Agent governance
3. Use CLI for manual governance commands

This gives you full coverage: the extension monitors the codebase, `.cursorrules` governs Cursor Agent, and the CLI provides on-demand governance tools.

## Compatibility Matrix

| Feature | VS Code Extension | .cursorrules | CLI |
|---|---|---|---|
| Status bar indicators | ✅ | ❌ | ❌ |
| Sidebar views | ✅ | ❌ | ❌ |
| Settings panel | ✅ | ❌ | ❌ |
| Dashboard | ✅ | ❌ | ❌ |
| Agent governance (Claude Code) | ✅ (hooks) | ❌ | ❌ |
| Agent governance (Cursor Agent) | ❌ | ✅ | ❌ |
| Health scans | ❌ | ✅ (via rules) | ✅ |
| Decision tracking | ❌ | ✅ (via rules) | ✅ |
| Oversight enforcement | ✅ (hooks) | ✅ (via rules) | ❌ |
