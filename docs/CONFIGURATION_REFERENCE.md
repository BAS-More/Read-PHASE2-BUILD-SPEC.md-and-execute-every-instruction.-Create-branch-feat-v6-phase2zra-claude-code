# EZRA Configuration Reference

## governance.yaml

The primary configuration file. Created by `/ezra:init` or `/ezra:bootstrap`.

```yaml
# .ezra/governance.yaml
version: 1
initialized: "2026-03-20T10:00:00.000Z"

project:
  name: "my-app"           # From package.json or directory name
  language: "TypeScript"    # Auto-detected
  framework: "NestJS"       # Auto-detected

# Files that require a decision record before modification
protected_paths:
  - pattern: "*.env*"
    reason: "Environment configuration — changes affect all environments"
  - pattern: "**/migrations/**"
    reason: "Database migrations — irreversible in production"
  - pattern: "**/*.secret"
    reason: "Secret files — sensitive data"
  - pattern: "**/keys/**"
    reason: "Cryptographic keys — security critical"
  - pattern: "docker-compose*.yml"
    reason: "Infrastructure definition — changes affect deployment"
  - pattern: "Dockerfile*"
    reason: "Container definition — changes affect build and deployment"
  - pattern: ".github/workflows/**"
    reason: "CI/CD pipeline — changes affect all deployments"

# Coding standards (language-specific defaults applied by bootstrap)
standards:
  strict_types: true        # TypeScript: strict mode
  no_any: true              # TypeScript: disallow any
  test_coverage_minimum: 80 # Minimum test coverage percentage

# Enforcement behaviour
enforcement:
  require_decision_for_protected_paths: true
  require_reconciliation_before_merge: false
  auto_scan_on_init: true

# AVI-OS integration (optional)
avios_integration:
  enabled: false            # Set true to enable sync
  project_id: "my-app"     # avios-context project identifier
  auto_sync: false          # true = sync immediately, false = batch
  sync_decisions: true      # Sync decisions to avios-context
  sync_risks: true          # Sync scan risks to avios-context
  sync_sprint_items: false  # Future feature

# Drift detection thresholds (optional, used by drift hook)
drift:
  warn_threshold: 10        # Edits before warning
  block_threshold: 25       # Edits before blocking (if enabled)
  block_enabled: false      # Whether to block at threshold

# Git hooks (optional, used by /ezra:git-hooks — future feature)
git_hooks:
  pre_commit:
    blocking: false
  pre_push:
    require_recent_scan: false
```

### Protected Path Patterns

Patterns use glob syntax:

| Pattern | Matches |
|---------|---------|
| `*.env*` | `.env`, `.env.local`, `.env.production` |
| `**/migrations/**` | `src/db/migrations/001.sql`, `prisma/migrations/init/` |
| `**/*.secret` | Any file ending in `.secret` at any depth |
| `docker-compose*.yml` | `docker-compose.yml`, `docker-compose.prod.yml` |
| `.github/workflows/**` | All GitHub Actions workflow files |

### Adding Custom Protected Paths

Edit `governance.yaml` directly or use `/ezra:decide` to create a decision that references specific paths:

```yaml
protected_paths:
  - pattern: "src/core/auth/**"
    reason: "Authentication module — requires security review (ADR-005)"
```

## knowledge.yaml

Architecture state discovered by scanning. Updated by `/ezra:init` and `/ezra:scan`.

```yaml
# .ezra/knowledge.yaml
version: 1
last_scan: "2026-03-20T10:00:00.000Z"
confidence: initial    # initial | growing | established

architecture:
  language: "TypeScript"
  runtime: "Node.js 20"
  framework: "NestJS"
  pattern: "monolith"   # monolith | microservices | monorepo | serverless
  layers:
    - "Controllers"
    - "Services"
    - "Repositories"
    - "Entities"

entry_points:
  - "src/main.ts"

dependencies:
  external_services:
    - "PostgreSQL"
    - "Redis"
  databases:
    - "PostgreSQL"
  key_packages:
    - "@nestjs/core"
    - "typeorm"
    - "passport"

test_infrastructure:
  runner: "jest"
  coverage_tool: "istanbul"
  e2e_framework: "supertest"
  test_directories:
    - "src/**/*.spec.ts"
    - "test/"

risks:
  - "No rate limiting on API endpoints"
  - "Missing input validation on user routes"
```

## Decision Records (ADR)

Each decision in `.ezra/decisions/ADR-NNN.yaml`:

```yaml
id: ADR-003
status: ACTIVE           # ACTIVE | SUPERSEDED | DEPRECATED
date: "2026-03-20T10:00:00.000Z"
category: DATABASE       # ARCHITECTURE | DATABASE | SECURITY | API |
                         # TESTING | INFRASTRUCTURE | DEPENDENCY | CONVENTION

decision: "Use PostgreSQL as primary database"
context: "Need relational DB with JSONB support for flexible schemas"
rationale: "PostgreSQL offers JSONB, strong ecosystem, and team expertise"

consequences:
  positive:
    - "JSONB enables flexible document storage within relational model"
    - "Rich ecosystem of tools and ORMs"
  negative:
    - "Requires managed hosting or self-managed instance"

enforcement:
  affected_paths:
    - "src/database/**"
    - "**/migrations/**"
    - "*.entity.ts"
  check_description: "All data access must go through TypeORM repositories"
  auto_enforced: true

supersedes: null         # ADR-001 if this replaces a previous decision
```

### Decision Status Lifecycle

```
ACTIVE ──► SUPERSEDED (replaced by newer ADR)
       └─► DEPRECATED (no longer relevant)
```

## Version State

### current.yaml

```yaml
version: "1.0.3"
created: "2026-03-20T10:00:00.000Z"
updated: "2026-03-20T14:30:00.000Z"
total_changes: 3

counts:
  decisions: 3
  documents: 5
  scans: 2
  plans: 1
  risks: 0
  proposals: 0

integrity:
  last_health_check: "2026-03-20T12:00:00.000Z"
  health_score: 82
  governance_compliant: true
```

### changelog.yaml

Append-only log. Never modify existing entries.

```yaml
# EZRA Changelog — APPEND ONLY
log:
  - id: CHG-0001
    timestamp: "2026-03-20T10:00:00.000Z"
    version_before: "1.0.0"
    version_after: "1.0.1"
    type: DECISION
    action: CREATED
    target: ".ezra/decisions/ADR-001.yaml"
    summary: "DECISION created: ADR-001.yaml"
    triggered_by: auto
```

## Document Registry

`.ezra/docs/registry.yaml` tracks all generated documents:

```yaml
documents:
  - id: api-spec
    type: api-specification
    status: CURRENT        # CURRENT | STALE | DRAFT | PROPOSED
    created: "2026-03-20"
    last_updated: "2026-03-20"
    path: "docs/api-spec.md"
  - id: security-arch
    type: security-architecture
    status: STALE
    created: "2026-03-15"
    last_updated: "2026-03-15"
    path: "docs/security-arch.md"
```

## Drift Counter

`.ezra/docs/.drift-counter.json` (auto-managed by drift hook):

```json
{
  "edits_since_sync": 7,
  "affected_docs": {
    "api-spec": 3,
    "security-arch": 2,
    "test-strategy": 2
  },
  "last_reminded": "2026-03-20T14:00:00.000Z"
}
```

Reset to zero when `/ezra:doc-sync` runs.

## AVI-OS Sync Items

`.ezra/.avios-sync/pending/*.json` (auto-created by bridge hook):

```json
{
  "action": "add_decision",
  "project_id": "my-app",
  "category": "DD",
  "decision": "Use PostgreSQL as primary database",
  "rationale": "JSONB support and team expertise",
  "status": "LOCKED",
  "source_file": ".ezra/decisions/ADR-003.yaml",
  "timestamp": "2026-03-20T10:00:00.000Z"
}
```

Category mapping from EZRA to avios-context:

| EZRA Category | avios-context |
|---------------|---------------|
| ARCHITECTURE | AD |
| DATABASE | DD |
| SECURITY | SC |
| API | AD |
| TESTING | TC |
| INFRASTRUCTURE | AD |
| DEPENDENCY | TC |
| CONVENTION | TC |

## Portfolio Config

`~/.ezra-portfolio.yaml` (for `/ezra:multi`):

```yaml
projects:
  - name: My App
    path: /home/user/projects/my-app
  - name: API Service
    path: /home/user/projects/api-service
  - name: Mobile SDK
    path: /home/user/projects/mobile-sdk
```
