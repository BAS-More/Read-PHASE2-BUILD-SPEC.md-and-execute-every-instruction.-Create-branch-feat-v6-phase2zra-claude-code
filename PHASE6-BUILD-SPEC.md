# EZRA v6 Phase 6 Build Spec: Dashboard Data + Cloud Sync Foundation

## Context
Repo: C:\Dev\Ezra | Branch: feat/v6-phase6-dashboard-data
NOTE: The actual React dashboard (ezra-dashboard repo) is a SEPARATE build.
This phase builds the data layer and sync foundation IN THE CORE REPO.

## What To Build

### 1. NEW FILE: hooks/ezra-dashboard-data.js (~300 lines)
Aggregates all .ezra/ state into a single JSON structure for dashboard consumption.

**Exports:**
- `getDashboardData(projectDir)` — returns complete dashboard JSON: health, progress, agents, decisions, security, tests, documents, risks, activity, cost
- `getWidgetData(projectDir, widgetName)` — returns data for a single widget
- `exportDashboardJSON(projectDir)` — writes .ezra/dashboard-export.json

### 2. NEW FILE: hooks/ezra-cloud-sync.js (~250 lines)
Cloud sync client stub — prepares data for Supabase sync.

**Exports:**
- `loadSyncConfig(projectDir)` — reads cloud_sync from settings
- `prepareSyncPayload(projectDir)` — creates minimal sync payload
- `writeSyncQueue(projectDir, payload)` — writes to .ezra/sync/queue/
- `getSyncStatus(projectDir)` — returns { last_sync, pending_count, conflicts }

### 3. NEW FILE: commands/ezra/dashboard-export.md
/ezra:dashboard command — export dashboard data, check sync status.

### 4. NEW FILE: tests/test-v6-dashboard-data.js (30+ tests)

### 5. UPDATE: settings — add cloud_sync and dashboard sections to DEFAULTS

### Commit Message
```
feat(v6): Phase 6 — dashboard data aggregation and cloud sync foundation

Tests: [TOTAL]/[TOTAL] — ALL GREEN
```
