# EZRA v6 Phase 4 Build Spec: Best Practice Library + Research Agent Interface

## Context
Repo: C:\Dev\Ezra | Version: 6.0.0 | Branch: feat/v6-phase4-library
Phases 1-3 merged. Settings system with write-back exists.

## Critical Rules
1. ZERO external npm dependencies.
2. ALL GREEN before commit. Target: 450+ tests.
3. The research agent itself (cloud function) is Phase 6. This phase builds the LOCAL library system and the interface the cloud agent will use.

## What to Build

### 1. NEW FILE: hooks/ezra-library.js (~400 lines)

Local best practice library engine.

**Exports:**
- `initLibrary(projectDir)` — create .ezra/library/ directory structure with 14 category files
- `getCategories()` — return list of 14 library categories
- `getEntries(projectDir, category, filter)` — read entries from a category
- `addEntry(projectDir, entry)` — add a best practice entry
- `removeEntry(projectDir, category, entryId)` — remove an entry
- `searchLibrary(projectDir, query)` — search across all categories by keyword
- `getRelevant(projectDir, filePath)` — find relevant best practices for a given file type/path
- `importFromUrl(projectDir, url)` — placeholder that returns { status: 'requires_research_agent' }
- `exportLibrary(projectDir)` — export entire library as single YAML
- `LIBRARY_CATEGORIES` — the 14 categories array
- `ENTRY_SCHEMA` — schema definition for a library entry

**Entry schema:**
```javascript
{ id, title, description, category, subcategory, source_url, date_added, date_verified, relevance_score, applicable_to: [], tags: [], severity: 'info'|'advisory'|'recommended'|'required' }
```

**Library directory structure:**
```
.ezra/library/
├── code-quality.yaml
├── security.yaml
├── testing.yaml
├── architecture.yaml
├── devops.yaml
├── ui-ux.yaml
├── performance.yaml
├── documentation.yaml
├── process-qc.yaml
├── iso-standards.yaml
├── compliance.yaml
├── ai-agent.yaml
├── database.yaml
├── api-design.yaml
└── meta.yaml          # Last update, entry counts, research agent status
```

**Seed data:** Each category file starts with 3-5 universal best practices that are always true (e.g., security: "never store secrets in code", "validate all inputs", "use parameterised queries").

### 2. NEW FILE: commands/ezra/library.md

```
---
name: ezra:library
description: "Best practice library — browse, search, add, and manage development best practices across 14 categories."
---
```

**Subcommands:**
```
/ezra:library                 Show library summary (categories, entry counts, last update)
/ezra:library browse <cat>    Browse entries in a category
/ezra:library search <query>  Search across all categories
/ezra:library add             Add a custom best practice entry
/ezra:library remove <id>     Remove an entry
/ezra:library relevant        Show best practices relevant to the current file/project
/ezra:library export          Export entire library as YAML
/ezra:library init            Initialize library with seed data
/ezra:library stats           Show statistics (entries per category, coverage gaps)
```

### 3. NEW FILE: commands/ezra/research.md

```
---
name: ezra:research
description: "Research agent control — manage the web research agent that keeps the best practice library current. Requires Pro tier."
---
```

**Subcommands:**
```
/ezra:research                Show research agent status (last run, next scheduled, budget used)
/ezra:research run            Trigger manual research run (placeholder — returns 'cloud agent not configured')
/ezra:research config         Show research agent configuration
/ezra:research sources        List whitelisted sources
/ezra:research sources add    Add a source URL
/ezra:research history        Show research run history
/ezra:research budget         Show budget usage
```

Note: actual research execution is deferred to Phase 6 (cloud). This phase builds the command interface and local storage.

### 4. NEW FILE: tests/test-v6-library.js (~450+ lines)

**Test categories:**
1. LIBRARY_CATEGORIES has exactly 14 entries
2. ENTRY_SCHEMA has all required fields
3. initLibrary creates all 14 category files + meta.yaml
4. Seed data present in each category (3-5 entries each)
5. addEntry writes to correct category file
6. removeEntry removes by ID
7. searchLibrary finds entries by keyword across categories
8. getRelevant returns entries matching file extensions
9. exportLibrary returns complete YAML
10. Edge cases: empty library, duplicate IDs, invalid categories

### 5. Update hooks/ezra-settings.js

Add `library` section to DEFAULTS + `getLibrary` accessor:
```javascript
library: {
  research_enabled: true,
  update_frequency: 'weekly',
  budget_monthly: 10.00,
  sources_whitelist: ['owasp.org', 'developer.mozilla.org', 'react.dev', 'nodejs.org', 'typescriptlang.org', 'nist.gov', 'github.com/advisories'],
  auto_add_rules: false,
  alert_on_new_cve: true,
  categories_monitored: ['all'],
},
```

### 6. Update Existing Files
- Command count: 30 → 32 (library, research)
- Hook count: 9 → 10 (ezra-library.js)
- Add V6-Library test suite to runner
- Update README, CLAUDE.md, help.md, SKILL.md

## Acceptance Criteria
1. ALL GREEN, 0 failures, 450+ tests
2. Library initialises with seed data in all 14 categories
3. Search works across categories
4. Research commands exist but return placeholder responses
