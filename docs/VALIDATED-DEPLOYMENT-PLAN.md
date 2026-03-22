# VALIDATED DEPLOYMENT PLAN — Final
## Quiz2Biz + Agent-MVP on Railway + Neon.tech
**Date:** 2026-03-20 | **Based on:** Actual codebase audit + CROSS_PROJECT_API_INTEGRATION.md

---

## WHAT I VERIFIED (not assumed)

### Quiz2Biz (commit abfae0f)
- Framework: NestJS 10 + React 19, turbo monorepo
- Port: configService.get('PORT', 3000) — Railway compatible
- Database: Prisma + DATABASE_URL from env — Neon compatible
- AI: Has own AI Gateway (Claude + OpenAI) — works standalone
- @bas-more/orchestrator: in package.json but ZERO imports in code
- .npmrc: uses GH_PACKAGES_TOKEN (not GITHUB_PACKAGES_TOKEN)
- Health endpoint: src/health.controller.ts exists
- Node: >=22.0.0

### Agent-MVP
- Framework: NestJS + Prisma
- Port: process.env.PORT || 3000 — Railway compatible
- Health endpoint: NOT FOUND — must create
- Global prefix: api/v1

---

## 3 BLOCKERS FOUND

### Blocker 1: Agent-MVP has no health endpoint
Railway health checks fail → restart loop. Must create health controller.

### Blocker 2: Quiz2Biz App Insights may crash without Azure
initializeAppInsights() runs FIRST in main.ts (line 3). If it throws without connection string, boot fails. Must verify it's guarded.

### Blocker 3: .npmrc uses GH_PACKAGES_TOKEN
Railway env var must use this exact name, not GITHUB_PACKAGES_TOKEN.

---

## PRE-DEPLOYMENT TASKS (9 tasks, Claude Code executes)

1. Verify Quiz2Biz builds clean
2. Verify App Insights guarded against missing env
3. Verify Sentry guarded against missing env
4. Verify Agent-MVP builds and boots
5. Create health endpoint for Agent-MVP (if missing)
6. Check Agent-MVP Redis dependency
7. Create railway.toml for Quiz2Biz
8. Create railway.toml for Agent-MVP
9. Commit and push both repos

---

## ENVIRONMENT VARIABLES

### Quiz2Biz
- PORT=${{RAILWAY_PORT}}
- NODE_ENV=staging
- DATABASE_URL=<neon-quiz2biz-connection-string>
- JWT_SECRET=<generate>
- JWT_REFRESH_SECRET=<generate>
- CORS_ORIGIN=*
- GH_PACKAGES_TOKEN=<pat-with-read:packages>
- ANTHROPIC_API_KEY=<key>
- REWARD_SERVICE_URL=http://reward-service.railway.internal:${{reward-service.PORT}}
- APPLICATIONINSIGHTS_CONNECTION_STRING= (empty — disables)
- SENTRY_DSN= (empty — disables)

### Agent-MVP
- PORT=${{RAILWAY_PORT}}
- NODE_ENV=staging
- DATABASE_URL=<neon-reward-connection-string>
- JWT_SECRET=<generate>
- JWT_SUPERVISOR_SECRET=<generate>

---

## AVI DOES (browser, cannot automate)

1. Sign up neon.tech → create quiz2biz-staging + reward-staging → copy connection strings
2. Sign up railway.app → connect BAS-More org → create avi-ecosystem project
3. Add service from BAS-More/Quiz2Biz → rename to quiz2biz
4. Add service from BAS-More/Agen-MVP → rename to reward-service
5. Set env vars per manifest
6. Verify health endpoints return 200

---

## COST: ~$1/month (within Railway $5 free credit)
