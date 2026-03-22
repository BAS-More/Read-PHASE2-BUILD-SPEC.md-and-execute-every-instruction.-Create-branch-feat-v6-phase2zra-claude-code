# Cross-Project API Integration Guide

## BAS-More Portfolio — How the Projects Connect

This document covers all API connections between the four BAS-More repositories: MAH, Agent-MVP, Quiz2Biz, and EZRA. It serves as the single source of truth for how these independent projects communicate.

---

## System Map

```
                         EZRA (governance observer)
                        /          |            \
                   .ezra/       .ezra/        .ezra/
                  (reads)      (reads)       (reads)
                     /            |              \
Quiz2Biz ──npm──> MAH SDK ──HTTP──> Agent-MVP
  (app)         (library)       (REST)       (microservice)
    \                                          /
     └───── direct HTTP (health check) ───────┘
```

### Project Roles

| Project | Role | Tech Stack | Runs As |
|---------|------|------------|---------|
| **MAH** (`@bas-more/orchestrator`) | SDK / Library | TypeScript, Node >=20, Express, PostgreSQL | npm package — imported in-process |
| **Agent-MVP** (`reward-service`) | Microservice | NestJS 11, PostgreSQL (Prisma), Redis, Bull | HTTP server on port 3000 |
| **Quiz2Biz** | Full-stack Application | NestJS + React 19, PostgreSQL, Redis, Azure | HTTP server on port 3001 |
| **EZRA** | Governance Framework | Pure Node.js, zero dependencies | Claude Code extension — no HTTP server |

---

## Active Connections

### 1. Quiz2Biz → MAH SDK (npm import)

**Type:** In-process library dependency
**Direction:** Quiz2Biz imports MAH
**Protocol:** TypeScript function calls (no HTTP)

```json
// Quiz2Biz package.json
{
  "dependencies": {
    "@bas-more/orchestrator": "^0.2.0"
  }
}
```

Quiz2Biz uses MAH's `Coordinator` for multi-agent task orchestration, `RewardServiceClient` for agent reputation scoring, and file processors for document generation.

**Key interfaces consumed:**
- `init()` — Bootstrap the orchestration engine
- `Coordinator` — Execute agent tasks
- `RewardServiceClient` — Score events, get reputation, create flags
- `FileProcessorCoordinator` — Process Excel, PDF, Word, CSV files

**No network call involved.** MAH runs inside Quiz2Biz's process.

---

### 2. MAH SDK → Agent-MVP (HTTP REST)

**Type:** HTTP client → REST API
**Direction:** MAH calls Agent-MVP
**Protocol:** JSON over HTTPS
**Client:** `RewardServiceClient` in `packages/core/src/integrations/reward-service/client.ts`

#### Endpoints Called

| Method | Endpoint | Purpose | Response |
|--------|----------|---------|----------|
| POST | `/api/v1/reputation/events` | Submit scoring event | 202 Accepted (async) |
| GET | `/api/v1/reputation/:agentId` | Get agent reputation | Agent score, tier, streak |
| GET | `/api/v1/reputation/:agentId/history` | Get scoring history | Paginated events |
| POST | `/api/v1/coaching/flags` | Create coaching flag | Flag record |
| GET | `/api/v1/coaching/flags/:agentId` | Get coaching flags | Flag list |
| POST | `/api/v1/coaching/reviews` | Request coaching review | Review record |
| GET | `/api/v1/gan-eden/status/:agentId` | Get Gan Eden status | Membership info |
| GET | `/api/v1/health/contract/version` | Check API compatibility | Version metadata |
| GET | `/api/v1/events/recent` | Poll for domain events | Event list |
| POST | `/api/v1/auth/service-token` | Exchange credentials for JWT | Access token |

#### Authentication

Two modes supported:

**Development — Static API Key:**
```typescript
const client = new RewardServiceClient({
  baseUrl: 'http://localhost:3000',
  apiKey: 'your-api-key',
});
```

**Production — Service Account (JWT):**
```typescript
const client = new RewardServiceClient({
  baseUrl: 'https://agent-mvp.internal.azurecontainerapps.dev',
  clientId: 'mah-orchestrator',
  clientSecret: process.env.REWARD_SERVICE_CLIENT_SECRET,
});
```

Service-account flow:
1. Client calls `POST /api/v1/auth/service-token` with `clientId` + `clientSecret`
2. Agent-MVP validates credentials against `service_accounts` table
3. Returns JWT with `SYSTEM` role, 24h expiration
4. Client caches token, auto-refreshes 60s before expiry
5. All subsequent requests use `Authorization: Bearer <jwt>`

#### Request/Response Conventions

- **Request bodies:** camelCase TypeScript → auto-converted to snake_case JSON
- **Response bodies:** snake_case JSON → auto-converted to camelCase TypeScript
- **Response wrapper:** Agent-MVP wraps all responses in `{ data: T }` — client auto-unwraps
- **Retries:** 2 retries on 5xx/network errors, exponential backoff (1s, 2s)
- **No retries on 4xx** (client errors are not transient)
- **Timeout:** 10s default

#### Contract Version Check

```typescript
const compat = await client.checkContractVersion();
// { compatible: true, serverVersion: '1.0.0', minClientVersion: '0.2.0' }
```

Call this at application startup to verify the deployed Agent-MVP is compatible with the MAH SDK version in use.

#### Event Polling

```typescript
const events = await client.pollEvents(
  new Date('2026-03-20T00:00:00Z'),  // since
  ['SCORING_COMPLETED', 'TIER_CHANGED'],  // event types (optional)
);
```

Use this to react to Agent-MVP state changes without webhooks. Poll at an interval appropriate to your use case (e.g., every 30s for dashboards, every 5min for batch processing).

---

### 3. Quiz2Biz → Agent-MVP (Health Check)

**Type:** HTTP GET
**Direction:** Quiz2Biz pings Agent-MVP
**Protocol:** JSON over HTTP
**Purpose:** Dependency health monitoring

Quiz2Biz's `/health` endpoint includes an Agent-MVP connectivity check:

```
GET /api/v1/health → includes check for Agent-MVP at REWARD_SERVICE_URL
```

**Configuration:**
```env
REWARD_SERVICE_URL=http://localhost:3000
```

If `REWARD_SERVICE_URL` is not set, the check is skipped (Quiz2Biz functions independently). If set but unreachable, Quiz2Biz reports status as `degraded` (not `unhealthy` — Agent-MVP is non-critical for core quiz functionality).

---

### 4. EZRA → All Projects (Filesystem)

**Type:** Local filesystem reads
**Direction:** EZRA reads from all project directories
**Protocol:** File I/O (no HTTP)

EZRA does not make HTTP calls. It reads `.ezra/` state directories on the local filesystem via `/ezra:multi`.

**Portfolio config:** `~/.claude/ezra-portfolio.yaml`

```yaml
projects:
  - id: quiz2biz
    name: Quiz2Biz
    path: C:\Dev\Quiz2Biz
    service_url: http://localhost:3001

  - id: agent-mvp
    name: Agent MVP
    path: C:\Dev\Agent-MVP
    service_url: http://localhost:3000

  - id: mah-sdk
    name: MAH SDK
    path: C:\Dev\MAH
    service_url: null

  - id: ezra
    name: EZRA
    path: C:\Dev\ezra-claude-code
    service_url: null
```

**What EZRA reads per project:**
- `.ezra/governance.yaml` — project config, protected paths, standards
- `.ezra/knowledge.yaml` — architecture state
- `.ezra/decisions/` — architectural decision records
- `.ezra/versions/current.yaml` — version, health score
- `.ezra/docs/.drift-counter.json` — document drift level
- `.ezra/scans/` — scan history
- `.ezra/notifications/` — cross-project ADR notifications

**Key commands:**
- `/ezra:multi dash` — Portfolio dashboard across all projects
- `/ezra:multi health` — Compare health scores
- `/ezra:multi api-health` — Ping live services (projects with `service_url`)
- `/ezra:multi sync governance` — Detect inconsistencies + propagate cross-project ADRs

---

### 5. EZRA AVI-OS Bridge (File-based Queue)

**Type:** File write → MCP tool call
**Direction:** EZRA hooks write pending items, `/ezra:sync` processes them
**Protocol:** JSON files in `.ezra/.avios-sync/pending/`

When EZRA records a decision or detects critical scan findings, the `ezra-avios-bridge.js` hook writes a sync item:

```json
{
  "action": "add_decision",
  "project_id": "quiz2biz",
  "category": "DD",
  "decision": "Use PostgreSQL as primary database",
  "rationale": "JSONB support and team expertise",
  "status": "LOCKED",
  "timestamp": "2026-03-20T10:00:00Z"
}
```

**Category mapping (EZRA → avios-context):**

| EZRA Category | avios-context | Description |
|---------------|---------------|-------------|
| ARCHITECTURE | AD | Architecture Decision |
| DATABASE | DD | Data Decision |
| SECURITY | SC | Security Control |
| API | AD | Architecture Decision |
| TESTING | TC | Technical Choice |
| INFRASTRUCTURE | AD | Architecture Decision |
| DEPENDENCY | TC | Technical Choice |
| CONVENTION | TC | Technical Choice |

**Processing:** Run `/ezra:sync` to review pending items and push to avios-context MCP server. Items move from `pending/` to `completed/` after successful sync.

---

## Service Account Management

### Creating a Service Account (Agent-MVP)

Requires ADMIN role:

```bash
curl -X POST http://localhost:3000/api/v1/auth/service-accounts \
  -H "Authorization: Bearer <admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "MAH Orchestrator",
    "clientId": "mah-orchestrator",
    "roles": ["SYSTEM"]
  }'
```

Response includes the `clientSecret` — **store it securely, it's shown once.**

```json
{
  "data": {
    "id": "uuid",
    "clientId": "mah-orchestrator",
    "clientSecret": "64-char-hex-string",
    "name": "MAH Orchestrator",
    "roles": ["SYSTEM"]
  }
}
```

### Exchanging for a Token

Public endpoint (no auth required):

```bash
curl -X POST http://localhost:3000/api/v1/auth/service-token \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "mah-orchestrator",
    "clientSecret": "64-char-hex-string"
  }'
```

Response:
```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 86400,
    "tokenType": "Bearer"
  }
}
```

### Revoking a Service Account

```bash
curl -X DELETE http://localhost:3000/api/v1/auth/service-accounts/mah-orchestrator \
  -H "Authorization: Bearer <admin-jwt>"
```

---

## Error Handling Standard

All API errors across projects follow this envelope:

```json
{
  "error": {
    "code": "AGENT_NOT_FOUND",
    "message": "Agent with ID 'abc' not found",
    "status": 404,
    "requestId": "correlation-id"
  }
}
```

MAH's `RewardServiceError` parses this automatically:
```typescript
try {
  await client.getReputation('nonexistent');
} catch (err) {
  if (err instanceof RewardServiceError) {
    console.log(err.statusCode);  // 404
    console.log(err.code);        // "AGENT_NOT_FOUND"
    console.log(err.endpoint);    // "/api/v1/reputation/nonexistent"
  }
}
```

---

## Cross-Project ADR Propagation

When an architectural decision affects multiple projects, tag it with portfolio scope:

```yaml
# .ezra/decisions/ADR-015.yaml
id: ADR-015
scope: portfolio
affects: [agent-mvp, quiz2biz]
category: SECURITY
decision: "Standardize on JWT RS256 for all service-to-service auth"
```

When `/ezra:multi sync governance` runs:
1. Detects `scope: portfolio` decisions
2. Creates notification files in each affected project's `.ezra/notifications/`
3. Next time `/ezra:health` runs in those projects, it flags unacknowledged notifications

---

## Environment Configuration

### Agent-MVP (.env)

```env
# Core
DATABASE_URL=postgresql://user:pass@localhost:5432/reward_service
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-agent-realm-secret
JWT_SUPERVISOR_SECRET=your-supervisor-realm-secret
PORT=3000
```

### Quiz2Biz (.env)

```env
# Core
DATABASE_URL=postgresql://user:pass@localhost:5432/quiz2biz
PORT=3001

# Agent-MVP Integration (optional)
REWARD_SERVICE_URL=http://localhost:3000
REWARD_SERVICE_CLIENT_ID=quiz2biz-service
REWARD_SERVICE_CLIENT_SECRET=from-service-account-creation
```

### MAH SDK (passed programmatically)

```typescript
import { init } from '@bas-more/orchestrator';

const coordinator = await init({
  db: { connectionString: process.env.DATABASE_URL },
  rewardService: {
    baseUrl: process.env.REWARD_SERVICE_URL || 'http://localhost:3000',
    clientId: process.env.REWARD_SERVICE_CLIENT_ID,
    clientSecret: process.env.REWARD_SERVICE_CLIENT_SECRET,
  },
});
```

### EZRA (no env — filesystem config)

Portfolio config at `~/.claude/ezra-portfolio.yaml` — edited manually or via `/ezra:multi add <path>`.

---

## Service Discovery

### Development (localhost)

Services find each other via environment variables:

| Service | Default URL | Env Variable |
|---------|-------------|--------------|
| Agent-MVP | `http://localhost:3000` | `REWARD_SERVICE_URL` |
| Quiz2Biz | `http://localhost:3001` | `QUIZ2BIZ_URL` (future) |

### Production (Azure)

Azure Container Apps provides internal DNS:
```
agent-mvp.internal.<env>.azurecontainerapps.dev
quiz2biz.internal.<env>.azurecontainerapps.dev
```

Set `REWARD_SERVICE_URL` to the internal DNS name in each container's environment.

### EZRA Portfolio

`service_url` in `ezra-portfolio.yaml` maps to the correct URL per environment:
```yaml
# Dev
service_url: http://localhost:3000

# Production
service_url: https://agent-mvp.internal.prod.azurecontainerapps.dev
```

---

## Future Connections (Planned)

### Phase 6: Webhook System (Agent-MVP → Quiz2Biz)

**Status:** Deferred — build when event polling volume makes push-based delivery necessary.

**Design:**
- Agent-MVP gains a `webhooks` module: CRUD for webhook registrations
- Quiz2Biz registers for `SCORING_COMPLETED`, `TIER_CHANGED` events
- Agent-MVP sends `POST` to registered callback URLs with HMAC-signed payloads
- Signature header: `X-Webhook-Signature: sha256=<hmac>`
- Retry: 3 attempts with exponential backoff on 5xx responses

**Endpoints (Agent-MVP):**
```
POST   /api/v1/webhooks          — Register callback URL + event types
GET    /api/v1/webhooks          — List registrations
DELETE /api/v1/webhooks/:id      — Unregister
GET    /api/v1/webhooks/:id/logs — Delivery log
```

**Webhook payload:**
```json
{
  "id": "evt-uuid",
  "type": "SCORING_COMPLETED",
  "timestamp": "2026-03-20T10:00:00Z",
  "data": {
    "agentId": "agent-uuid",
    "taskId": "task-uuid",
    "scoreAfter": 85.5,
    "tierChanged": false
  }
}
```

### Quiz2Biz Direct API Access to Agent-MVP

**Status:** Planned for when Quiz2Biz needs agent dashboards beyond what MAH SDK provides.

Quiz2Biz may call Agent-MVP directly (bypassing MAH SDK) for:
- Dashboard data: `GET /api/v1/dashboard/overview`
- Leaderboards: `GET /api/v1/dashboard/leaderboard`
- Agent details: `GET /api/v1/agents/:id`

These would use the same service-account JWT auth as MAH.

### EZRA Integration Health Pillar

**Status:** Planned for v5.0.0 Features 4-6.

Add integration health as a sub-check in `/ezra:health`:
- Are API contracts between projects in sync?
- Are service-account credentials rotated within 90 days?
- Do all health endpoints respond?
- Is the contract version compatible across all connected services?

This only applies to projects registered in the portfolio that have `service_url` set.

### EZRA Git Hook Integration

**Status:** Planned for v5.0.0 Feature 4.

`.git/hooks/pre-commit` and `.git/hooks/pre-push` scripts that run governance checks outside Claude Code:
- Pre-commit: Check staged files against protected paths
- Pre-push: Verify recent scan exists

These would run as plain Node.js — no Claude Code session required — enabling CI/CD pipeline governance.

---

## Connection Matrix

Quick reference for which project calls which:

| Caller → Target | MAH | Agent-MVP | Quiz2Biz | EZRA |
|-----------------|-----|-----------|----------|------|
| **MAH** | — | HTTP REST (RewardServiceClient) | — | — |
| **Agent-MVP** | — | — | Webhook (future) | — |
| **Quiz2Biz** | npm import | Health check (HTTP) | — | — |
| **EZRA** | .ezra/ reads | .ezra/ reads | .ezra/ reads | — |

---

## Troubleshooting

### MAH can't connect to Agent-MVP

1. Check `REWARD_SERVICE_URL` is set and correct
2. Verify Agent-MVP is running: `curl http://localhost:3000/api/v1/health`
3. Check contract compatibility: `curl http://localhost:3000/api/v1/health/contract/version`
4. If using service-account auth: verify `clientId`/`clientSecret` are correct
5. Check Agent-MVP logs for `401 Unauthorized` or `429 Too Many Requests`

### Quiz2Biz health shows Agent-MVP as unhealthy

1. Agent-MVP may not be running — start it: `cd Agent-MVP && npm run start:dev`
2. `REWARD_SERVICE_URL` may point to wrong port
3. If Agent-MVP is healthy but Quiz2Biz reports unhealthy: check network/firewall between containers (Azure)

### EZRA multi commands show stale data

`/ezra:multi dash` reads cached health scores from `.ezra/versions/current.yaml`. Run `/ezra:multi health` to refresh all projects, or `/ezra:scan` on individual projects.

### Cross-project ADR not appearing in target project

1. Verify the source ADR has `scope: portfolio` and `affects: [target-id]`
2. Run `/ezra:multi sync governance` to trigger propagation
3. Check target project's `.ezra/notifications/` directory for the notification file
4. Run `/ezra:health` in the target project to surface the notification

### Service account token expired

MAH's `RewardServiceClient` auto-refreshes tokens 60 seconds before expiry. If you see `401` errors despite having valid credentials:
1. Check system clock sync between services
2. Verify the service account is still active: `GET /api/v1/auth/service-accounts` (admin)
3. Manually re-authenticate: the client will get a fresh token on next request after cache expiry
