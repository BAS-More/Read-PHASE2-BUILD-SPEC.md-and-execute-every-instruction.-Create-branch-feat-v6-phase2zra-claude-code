# EZRA Hooks & Agents

## Hooks

Hooks are Node.js scripts that run automatically in response to Claude Code events. They provide continuous governance without requiring manual command invocation.

### Installation

After running `npx ezra-claude-code --claude --local`, add the hook configuration to your `.claude/settings.json`. The CLI prints the exact JSON block needed.

Example configuration:

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Edit|Write|MultiEdit",
      "hooks": [{
        "type": "command",
        "command": "node \"/path/to/hooks/ezra-guard.js\"",
        "timeout": 5
      }]
    }],
    "SessionStart": [{
      "matcher": "startup|compact",
      "hooks": [{
        "type": "command",
        "command": "node \"/path/to/hooks/ezra-dash-hook.js\"",
        "timeout": 5
      }]
    }],
    "PostToolUse": [{
      "matcher": "Write|Edit|MultiEdit",
      "hooks": [
        { "type": "command", "command": "node \"/path/to/hooks/ezra-drift-hook.js\"", "timeout": 3 },
        { "type": "command", "command": "node \"/path/to/hooks/ezra-version-hook.js\"", "timeout": 3 },
        { "type": "command", "command": "node \"/path/to/hooks/ezra-avios-bridge.js\"", "timeout": 5 }
      ]
    }]
  }
}
```

### Hook Protocol

All hooks follow the same contract:

**Input (stdin):** JSON object from Claude Code
```json
{
  "tool_name": "Write",
  "tool_input": {
    "file_path": "src/routes/auth.ts",
    "content": "..."
  },
  "cwd": "/path/to/project"
}
```

**Output (stdout):** JSON object (optional — most hooks produce no output)
```json
{
  "hookSpecificOutput": {
    "permissionDecision": "allow",
    "permissionDecisionReason": "EZRA: Protected path warning...",
    "message": "Informational message"
  }
}
```

**Exit code:** Always 0. Hooks must never crash or block the user.

---

### ezra-guard.js (PreToolUse)

**Purpose:** Protects critical files from unintended modification.

**Trigger:** Before any Write, Edit, or MultiEdit operation.

**Behaviour:**
1. Reads `file_path` from stdin JSON
2. Loads `.ezra/governance.yaml` protected path patterns
3. Checks if the target file matches any pattern
4. If match found, checks for an authorising decision in `.ezra/decisions/`
5. If no decision exists, outputs a warning (non-blocking by default)

**When it fires:** Editing `.env.production` when `*.env*` is protected.

**When it's silent:** Editing `src/app.ts` (not a protected path), or when `.ezra/` doesn't exist.

**Configuration:** Change `permissionDecision` from `"allow"` to `"deny"` in the hook source to make it blocking.

---

### ezra-dash-hook.js (SessionStart)

**Purpose:** Shows compact project status at the start of every Claude Code session.

**Trigger:** When Claude Code starts or compacts context.

**Behaviour:**
1. Checks if `.ezra/` exists in current directory
2. If not initialized: outputs "EZRA: Not initialized. Run /ezra:init"
3. If initialized: reads governance.yaml, counts decisions, shows last scan date

**Output example:**
```
EZRA │ my-app │ Decisions: 5 │ Health: 82/100 │ Last scan: 2h ago
```

---

### ezra-drift-hook.js (PostToolUse)

**Purpose:** Tracks how many code edits have occurred since the last documentation sync.

**Trigger:** After every Write, Edit, or MultiEdit operation.

**Behaviour:**
1. Reads the edited file path
2. Checks against relevance rules (e.g., `src/routes/*` affects `api-spec` doc)
3. If the edited file relates to a registered document, increments the drift counter
4. Every 10 edits, or when a doc has been hit 3+ times, outputs a reminder to stderr

**Relevance rules:**

| File Pattern | Affected Docs |
|-------------|---------------|
| `src/routes/**`, `*.controller.*` | api-spec, api-docs |
| `migrations/**`, `*.entity.*` | data-model, migrations |
| `auth/**`, `*middleware*` | security-arch |
| `docker*`, `.github/workflows/**` | deploy-runbook, infra-plan |
| `*.env*`, `config/**` | env-setup, config-mgmt |
| `package.json`, lockfiles | dependencies, tech-stack |
| `test/**`, `*.spec.*` | test-strategy, test-cases |

**State file:** `.ezra/docs/.drift-counter.json`

---

### ezra-version-hook.js (PostToolUse)

**Purpose:** Automatic semantic versioning of all `.ezra/` state changes.

**Trigger:** After Write/Edit/MultiEdit of any file inside `.ezra/`.

**Behaviour:**
1. Checks if the modified file is inside `.ezra/`
2. Skips `.ezra/versions/` files (loop prevention)
3. Skips `.drift-counter.json` (high frequency, low value)
4. Determines change type (DECISION, SCAN, PLAN, DOCUMENT, GOVERNANCE, KNOWLEDGE)
5. Bumps patch version (1.0.0 → 1.0.1)
6. Appends immutable entry to `changelog.yaml`
7. Updates `current.yaml` with new version

**Loop prevention:** The hook ignores changes to its own output directory (`.ezra/versions/`).

---

### ezra-avios-bridge.js (PostToolUse)

**Purpose:** Syncs governance state with the avios-context MCP server.

**Trigger:** After Write/Edit/MultiEdit to `.ezra/decisions/` or `.ezra/scans/`.

**Behaviour:**
1. Checks if `avios_integration.enabled: true` in governance.yaml
2. If disabled, exits silently (0)
3. For decision files: parses the YAML, maps the EZRA category to avios-context category, writes a pending sync item
4. For scan files: looks for CRITICAL/HIGH severity findings, creates a risk sync item
5. Pending items are written to `.ezra/.avios-sync/pending/` as JSON files

**Category mapping:**
- ARCHITECTURE, API, INFRASTRUCTURE → AD (Architecture Decision)
- DATABASE → DD (Data Decision)
- SECURITY → SC (Security Control)
- TESTING, DEPENDENCY, CONVENTION → TC (Technical Choice)

**Processing pending items:** Run `/ezra:sync` to review and push pending items to avios-context.

---

## Agents

Agents are specialized analysis prompts dispatched by commands. They run as Claude Code subagents in parallel.

### ezra-architect

**Role:** Architecture analysis, layer mapping, dependency tracing, pattern detection.

**Dispatched by:** `/ezra:scan`, `/ezra:review`

**Analyses:**
- Layer structure (Controllers → Services → Repositories → Models)
- Dependency graph (what imports what)
- Pattern compliance (does the code follow declared architecture?)
- Drift detection (have layers shifted from the documented state?)

**Output format:** Structured YAML
```yaml
architecture_analysis:
  layers_detected: [Controllers, Services, Repositories, Entities]
  pattern: "layered-monolith"
  coupling_hotspots:
    - location: src/services/UserService.ts
      issue: "Direct database access bypassing repository layer"
  drift_from_knowledge: "minimal"
```

### ezra-reviewer

**Role:** OWASP-aligned security review + code quality analysis.

**Dispatched by:** `/ezra:scan`, `/ezra:review`

**Analyses:**
- OWASP Top 10 vulnerabilities (injection, auth, XSS, etc.)
- Sensitive data exposure
- Code complexity and maintainability
- Error handling patterns
- Test coverage gaps

**Confidence scoring:**
- 90-100: Definite finding, report with high confidence
- 70-89: Very likely, report with context
- 50-69: Possible, report as advisory
- Below 50: Don't report

**Output format:**
```yaml
security_findings:
  - severity: CRITICAL
    confidence: 95
    location: src/auth/login.ts:42
    description: "SQL injection via string interpolation in query"
    recommendation: "Use parameterized queries"
quality_findings:
  - severity: WARNING
    confidence: 80
    location: src/utils/helpers.ts
    description: "Function exceeds 200 lines"
    recommendation: "Extract sub-functions"
```

### ezra-guardian

**Role:** Decision enforcement, protected path integrity, standards compliance.

**Dispatched by:** `/ezra:scan`, `/ezra:guard`

**Analyses:**
- Are all active decisions being followed in the code?
- Are protected paths untouched without authorization?
- Do coding standards match governance.yaml settings?
- Are there any governance violations?

**Output format:**
```yaml
governance_report:
  decision_compliance:
    - adr: ADR-003
      status: COMPLIANT
      evidence: "All DB access goes through TypeORM repositories"
    - adr: ADR-005
      status: VIOLATION
      evidence: "Direct Redis calls found in src/cache.ts bypassing cache service"
  protected_paths:
    violations: 0
  standards:
    strict_types: PASS
    no_any: PASS
```

### ezra-reconciler

**Role:** Plan vs. implementation comparison.

**Dispatched by:** `/ezra:scan`, `/ezra:reconcile`

**Analyses:**
- Compare registered plan items against actual code
- Identify completed items, gaps, and unplanned additions
- Calculate completion percentage
- Flag constraint violations

**Output format:**
```yaml
reconciliation_report:
  plan: "sprint-12"
  completion: 75%
  completed:
    - "User authentication endpoint"
    - "Database migration for users table"
  gaps:
    - "Rate limiting not implemented"
    - "Error monitoring integration missing"
  unplanned:
    - "Added caching layer (not in plan)"
  constraint_violations: []
```
