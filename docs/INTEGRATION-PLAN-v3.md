# Integration & Deployment Plan v3 (Final)
## Aligned with docs/CROSS_PROJECT_API_INTEGRATION.md
**Date:** 2026-03-20 | **Supersedes:** v1 and v2 (both had architectural errors)

---

## Source of Truth

This plan is governed by `docs/CROSS_PROJECT_API_INTEGRATION.md` from the EZRA ecstatic-nash worktree. That document is the authoritative specification for how Quiz2Biz, MAH SDK, Agent-MVP, and EZRA connect.

**Previous plans had these errors:**
- v1: Treated MAH as npm library (partially right) but missed 3 of 10 endpoints
- v2: Treated MAH as a standalone HTTP service (wrong — it is an npm library)
- v2: Treated EZRA as a deployable HTTP service (wrong — it is a Claude Code extension)
- v2: Planned 3-4 Railway services and databases (wrong — need 1 or 2)

---

## Architecture (from CROSS_PROJECT_API_INTEGRATION.md)

```
Quiz2Biz --npm import--> MAH SDK --HTTP REST--> Agent-MVP
 (app)                  (library)              (microservice)

EZRA: Local Claude Code extension. Reads .ezra/ directories. No deployment.
```

| Project | Type | Runs As |
|---|---|---|
| Quiz2Biz | Full-stack application | HTTP server (NestJS + React) |
| MAH SDK | Library | npm package imported in-process by Quiz2Biz |
| Agent-MVP | Microservice | HTTP server (NestJS, port 3000) |
| EZRA | Governance framework | Claude Code extension — no server |

## Deployment Options

### Option A: One Service (MVP Demo) — RECOMMENDED TO START

Deploy Quiz2Biz only. Agent-MVP is not deployed. MAH SDK runs in-process with reward scoring disabled.

Per CROSS_PROJECT_API_INTEGRATION.md: "If REWARD_SERVICE_URL is not set, the check is skipped (Quiz2Biz functions independently)."

| Component | Where | Cost |
|---|---|---|
| Quiz2Biz (with MAH SDK in-process) | Railway | ~$0.50/month |
| quiz2biz-db | Neon.tech free tier | $0 |
| **Total** | | **~$0.50/month** |

What works: Quiz2Biz product, MAH orchestration (task routing, agent lifecycle, file processing, compliance).
What does not work: Agent scoring, coaching, reputation, Gan Eden (requires Agent-MVP).

### Option B: Two Services (Full Stack)

Deploy Quiz2Biz + Agent-MVP. Full integration chain operational.

| Component | Where | Cost |
|---|---|---|
| Quiz2Biz (with MAH SDK in-process) | Railway | ~$0.50/month |
| Agent-MVP (Reward Service) | Railway | ~$0.50/month |
| quiz2biz-db | Neon.tech free tier | $0 |
| reward-db | Neon.tech free tier | $0 |
| **Total** | | **~$1.00/month** |

What works: Everything — full product chain with scoring, coaching, reputation.

---

## Phase 0: Audit Current State

### Task 0.1 — Verify Quiz2Biz builds
```bash
cd C:\Dev\Quiz2Biz && npm install && npm run build && npm test
```
Accept: Build exits 0. 4,363+ tests pass. @bas-more/orchestrator in node_modules.

### Task 0.2 — Verify MAH SDK builds (library, not a service)
```bash
cd C:\Dev\MAH && npm install && npm run build && npm test
```
Accept: Build exits 0, 4 packages compile. 801+ tests pass.

### Task 0.3 — Verify Agent-MVP builds and boots
```bash
cd C:\Dev\Agent-MVP && npm install && npm run build && npm test && npm start
```
Accept: Build exits 0. 536+ tests pass. Server boots on port 3000.

### Task 0.4 — Verify Quiz2Biz imports MAH SDK
```bash
cd C:\Dev\Quiz2Biz && grep -r "bas-more/orchestrator\|@bas-more" --include="*.ts" apps/ libs/ src/
```
Accept: Document import locations (may be zero — wiring needed in Phase 1).

### Task 0.5 — Verify RewardServiceClient has all 10 endpoints
Per CROSS_PROJECT_API_INTEGRATION.md: scoreEvent, getReputation, getHistory, createFlag, getFlags, requestReview, getGanEdenStatus, checkContractVersion, pollEvents, authenticate.

---

## Phase 1: Fix

### Task 1.1 — Fix any build failures from Phase 0

### Task 1.2 — Add missing RewardServiceClient methods (if any from 0.5)

Endpoints 8-10 may not exist yet. Per CROSS_PROJECT_API_INTEGRATION.md:

checkContractVersion() — GET /api/v1/health/contract/version
pollEvents(since, eventTypes?) — GET /api/v1/events/recent
authenticate() — POST /api/v1/auth/service-token (JWT service account flow)

### Task 1.3 — Wire MAH SDK into Quiz2Biz (if 0.4 shows zero imports)

Per CROSS_PROJECT_API_INTEGRATION.md, Quiz2Biz uses MAH via:

```typescript
import { init, Coordinator } from '@bas-more/orchestrator';

const coordinator = await init({
  db: { connectionString: process.env.DATABASE_URL },
  rewardService: {
    baseUrl: process.env.REWARD_SERVICE_URL || 'http://localhost:3000',
    clientId: process.env.REWARD_SERVICE_CLIENT_ID,
    clientSecret: process.env.REWARD_SERVICE_CLIENT_SECRET,
  },
});
```

Key interfaces consumed by Quiz2Biz:
- init() — Bootstrap the orchestration engine
- Coordinator — Execute agent tasks
- RewardServiceClient — Score events, get reputation, create flags
- FileProcessorCoordinator — Process Excel, PDF, Word, CSV files

Accept: Quiz2Biz calls init() at startup. At least one code path uses Coordinator. Graceful degradation when REWARD_SERVICE_URL is not set.

### Task 1.4 — MAH DATABASE_URL support

DONE. Committed 2026-03-20 (commit 4224144). server.ts accepts DATABASE_URL. Note: server.ts is the optional standalone runtime. Quiz2Biz imports MAH as a library via init(), not via server.ts.

---

## Phase 2: Deploy Prep

### Task 2.1 — Create railway.toml for Quiz2Biz

```toml
[build]
builder = "NIXPACKS"
buildCommand = "npm ci && npx prisma generate && npx prisma migrate deploy && npm run build"

[deploy]
startCommand = "npm start"
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

### Task 2.2 — Create railway.toml for Agent-MVP (Option B only)

```toml
[build]
builder = "NIXPACKS"
buildCommand = "npm ci && npx prisma generate && npx prisma migrate deploy && npm run build"

[deploy]
startCommand = "npm start"
healthcheckPath = "/api/health"
healthcheckTimeout = 300
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

### Task 2.3 — Environment variables

Quiz2Biz:
- PORT=${{RAILWAY_PORT}}
- NODE_ENV=staging
- DATABASE_URL=<neon-quiz2biz-connection-string>
- ANTHROPIC_API_KEY=<key>
- GITHUB_PACKAGES_TOKEN=<pat-with-read:packages>
- REWARD_SERVICE_URL=http://reward-service.railway.internal:${{reward-service.PORT}} (Option B only)
- REWARD_SERVICE_CLIENT_ID=quiz2biz-service (Option B only)
- REWARD_SERVICE_CLIENT_SECRET=<from-service-account> (Option B only)

Agent-MVP (Option B only):
- PORT=${{RAILWAY_PORT}}
- NODE_ENV=staging
- DATABASE_URL=<neon-reward-connection-string>
- JWT_SECRET=<generate>
- JWT_SUPERVISOR_SECRET=<generate>

### Task 2.4 — Ensure .npmrc for GitHub Packages in Quiz2Biz

```
@bas-more:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}
```

### Task 2.5 — Commit and push all changes

---

## Phase 3: Test

### Task 3.1 — Contract test: MAH SDK to Agent-MVP (live)

Boot Agent-MVP, run MAH contract tests against it.

### Task 3.2 — Graceful degradation test

Start Quiz2Biz without REWARD_SERVICE_URL. Verify it boots, health returns 200, core functionality works. Health should report "degraded" not "unhealthy".

### Task 3.3 — Full chain test (Option B)

Boot both. Trigger Quiz2Biz action that invokes MAH (in-process) which calls Agent-MVP (HTTP).

---

## Phase 4: Deploy (Avi executes in browser)

### Neon.tech
1. Sign up at neon.tech
2. Create project: quiz2biz-staging — copy connection string
3. Option B: Create project: reward-staging — copy connection string

### Railway
1. Sign up at railway.app
2. Create project: avi-ecosystem
3. Add service from BAS-More/Quiz2Biz, rename to quiz2biz
4. Set environment variables
5. Option B: Add service from BAS-More/Agen-MVP, rename to reward-service
6. Option B: Set Agent-MVP environment variables
7. Deploy

### Verify
- Quiz2Biz public URL loads
- Health returns 200
- Option B: Agent-MVP health returns 200
- Option B: Full chain works via Railway internal network

---

## Risk Register

| # | Risk | Mitigation |
|---|---|---|
| R1 | Quiz2Biz does not call MAH init() yet | Wire in Phase 1 Task 1.3 |
| R2 | npm auth fails for @bas-more at build time | .npmrc with GITHUB_PACKAGES_TOKEN |
| R3 | MAH auto-migration conflicts with Quiz2Biz Prisma tables | MAH uses mah_ prefix on all tables (verified in migration SQL) |
| R4 | RewardServiceClient missing endpoints 8-10 | Add in Phase 1 Task 1.2 |
| R5 | Neon cold start 500ms-2s | Acceptable for staging |

---

## Decision Matrix: Option A vs Option B

| Factor | Option A (1 service) | Option B (2 services) |
|---|---|---|
| Monthly cost | ~$0.50 | ~$1.00 |
| Setup time | 10 minutes | 20 minutes |
| Scoring/coaching | Not available | Fully operational |
| Demo readiness | Product + orchestration | Full ecosystem |
| Risk | Lower — fewer parts | Higher — service networking |

DECISION LOCKED: Option B selected. Both services deploy. Full chain required for demo and testing.

---

## Success Criteria

- [ ] Quiz2Biz builds and deploys to Railway with MAH SDK in-process
- [ ] Health endpoint returns 200 on Railway public URL
- [ ] MAH SDK initialises on startup (logs show agent/DB connection)
- [ ] Graceful degradation when Agent-MVP not deployed
- [ ] Option B: Agent-MVP deploys, all 10 contract endpoints respond
- [ ] Option B: Full chain verified in Railway
