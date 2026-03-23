# EZRA v6 Phase 3 Build Spec: Settings System Enhancement

## Context
Repo: C:\Dev\Ezra (github.com/BAS-More/ezra-claude-code)
Version: 6.0.0 | Branch from main: feat/v6-phase3-settings
Phase 1 (oversight) and Phase 2 (PM) are merged. Settings parser exists in hooks/ezra-settings.js.

## Critical Rules
1. ZERO external npm dependencies.
2. Run `node tests/run-tests.js` after EVERY change. ALL GREEN before commit.
3. Follow existing patterns. Read existing files first.
4. 'use strict' in all new JS files.

## What to Build

### 1. NEW FILE: hooks/ezra-settings-writer.js (~300 lines)

Write-back engine for settings. Currently settings are read-only. This adds write capability.

**Exports:**
- `setSetting(projectDir, path, value)` — set a single setting (e.g., 'oversight.level', 'strict')
- `addRule(projectDir, section, rule)` — add a custom rule to standards or security
- `removeRule(projectDir, section, ruleId)` — remove a rule by ID
- `resetSection(projectDir, section)` — reset a section to defaults
- `resetAll(projectDir)` — reset entire settings to defaults
- `exportSettings(projectDir)` — return settings as formatted YAML string
- `diffSettings(projectDir)` — compare current settings against defaults, return differences
- `initSettings(projectDir)` — create .ezra/settings.yaml with defaults if not exists
- `serializeYaml(obj)` — convert JS object to simple YAML string (inverse of parseYamlSimple)

**serializeYaml rules:**
- Top-level keys with object values become sections
- Arrays serialize as `- item` entries
- Booleans, numbers, strings serialize naturally
- Null serializes as `null`
- Comments are NOT preserved (acceptable limitation)

### 2. UPDATE: commands/ezra/settings.md

Enhance the existing settings command with write operations. Read the current file first — it already has subcommands defined. Add these if missing:

```
/ezra:settings init           Create .ezra/settings.yaml with defaults
/ezra:settings set <path> <v> Set a specific setting (e.g., oversight.level strict)
/ezra:settings add-rule       Add a custom rule interactively
/ezra:settings remove-rule    Remove a rule by ID
/ezra:settings reset <section> Reset a section to defaults
/ezra:settings reset-all      Reset all settings to defaults (requires confirmation)
/ezra:settings export         Export current settings as YAML
/ezra:settings diff           Show differences from defaults
```

### 3. NEW FILE: commands/ezra/compliance.md

Compliance profile management.

```
---
name: ezra:compliance
description: "Manage compliance profiles — ISO 25010, OWASP, SOC2, HIPAA, PCI-DSS, GDPR, WCAG. Activate profiles to auto-configure standards and security rules."
---
```

**Subcommands:**
```
/ezra:compliance              List available profiles with activation status
/ezra:compliance activate <p> Activate a compliance profile
/ezra:compliance deactivate   Deactivate a profile
/ezra:compliance check        Run compliance check against active profiles
/ezra:compliance report       Generate compliance report
```

**Built-in profiles (stored as JS objects in the command, not external files):**
- iso-25010: quality model (functionality, reliability, usability, efficiency, maintainability, portability)
- owasp-2025: OWASP Top 10 2025 security rules
- soc2: trust services criteria (security, availability, processing integrity, confidentiality, privacy)
- hipaa: health data protection rules
- pci-dss: payment card data rules
- gdpr: EU data protection rules
- wcag-aa: web accessibility rules

Each profile maps to a set of standards and security rules that get merged into settings when activated.

### 4. NEW FILE: tests/test-v6-settings-writer.js (~400+ lines)

Test suite for settings writer.

**Test categories:**
1. serializeYaml produces valid YAML that parseYamlSimple can read back
2. setSetting creates/updates values at correct paths
3. addRule appends rules to correct section
4. removeRule removes by ID
5. resetSection restores defaults for one section
6. resetAll restores complete defaults
7. exportSettings returns formatted YAML string
8. diffSettings shows correct differences
9. initSettings creates file with defaults
10. Round-trip: write → read → compare
11. Edge cases: nested paths, invalid paths, empty values

### 5. Update Existing Files

**hooks/ezra-settings.js:** No changes needed (writer is separate file that imports from settings)

**tests/test-structure.js:** Update command count: 28 → 30 (add compliance + enhanced settings)

**tests/test-commands.js:** Add 'compliance' to expected commands

**tests/run-tests.js:** Add `{ name: 'V6-Settings-Writer', script: 'test-v6-settings-writer.js' }`

**README.md, CLAUDE.md, help.md, SKILL.md:** Add /ezra:compliance, update counts

## Acceptance Criteria
1. ALL GREEN, 0 failures
2. Total tests ≥ 400
3. serializeYaml round-trips correctly with parseYamlSimple
4. Settings write-back creates valid .ezra/settings.yaml
5. Compliance profiles activate/deactivate correctly
