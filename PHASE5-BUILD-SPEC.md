# EZRA v6 Phase 5 Build Spec: Multi-Agent Orchestration

## Context
Repo: C:\Dev\Ezra | Version: 6.0.0 | Branch: feat/v6-phase5-multi-agent
Phases 1-4 merged. Oversight hooks, PM, settings writer, and library all exist.

## Critical Rules
1. ZERO external npm dependencies.
2. ALL GREEN before commit. Target: 520+ tests.
3. This phase builds the agent abstraction layer. Actual API calls to providers are NOT implemented — only the interface, routing logic, and mock providers.

## What to Build

### 1. NEW FILE: hooks/ezra-agents.js (~500 lines)

Multi-agent orchestration engine.

**Exports:**
- `SUPPORTED_PROVIDERS` — array of 9 provider definitions (name, type, integration methods)
- `ASSIGNMENT_STRATEGIES` — ['auto', 'manual', 'round-robin', 'cost-optimised', 'quality-optimised']
- `loadAgentConfig(projectDir)` — read agent settings from settings.yaml
- `getAgentRoster(projectDir)` — list configured agents with status
- `assignTask(projectDir, task, strategy)` — select optimal agent for a task using weighted scoring
- `recordTaskResult(projectDir, agentName, task, result)` — log agent performance data
- `getAgentPerformance(projectDir, agentName)` — return performance metrics for an agent
- `getAgentLeaderboard(projectDir)` — rank agents by quality-adjusted cost
- `checkBudget(projectDir)` — check remaining budget against ceiling
- `createProvider(config)` — factory that returns a provider interface (mock implementation)

**Provider interface (returned by createProvider):**
```javascript
{ name, type, model, execute: async (task) => { /* mock: returns { output, tokens, cost, duration } */ }, status: () => 'ready'|'busy'|'offline' }
```

**assignTask weighted scoring (from spec):**
- Skill match: 35% — historical success rate for task type
- Cost efficiency: 25% — cost per 1K tokens × estimated tokens
- Speed: 15% — average completion time
- Quality score: 15% — acceptance rate
- Availability: 10% — status check

**Performance data stored in .ezra/agents/:**
```
.ezra/agents/
├── roster.yaml         # Configured agents
├── performance/        # Per-agent performance data
│   ├── claude.yaml
│   ├── codex.yaml
│   └── ...
├── budget.yaml         # Budget tracking (daily/monthly spend)
└── task-log.yaml       # Task assignment history
```

### 2. NEW FILE: commands/ezra/agents.md

```
---
name: ezra:agents
description: "Multi-agent orchestration — manage AI coding agents, view performance, control budget, and configure task routing."
---
```

**Subcommands:**
```
/ezra:agents                  List configured agents with status
/ezra:agents add <name>       Add a new agent provider
/ezra:agents remove <name>    Remove an agent
/ezra:agents performance      Show performance metrics for all agents
/ezra:agents leaderboard      Rank agents by quality-adjusted cost
/ezra:agents budget           Show budget usage (daily/monthly)
/ezra:agents routing          Show task routing rules
/ezra:agents routing set      Configure task-to-agent routing
/ezra:agents assign <task>    Manually assign a task to a specific agent
/ezra:agents history          Show recent task assignment history
```

### 3. NEW FILE: commands/ezra/cost.md

```
---
name: ezra:cost
description: "Cost tracking and budget management for AI agent usage."
---
```

**Subcommands:**
```
/ezra:cost                    Show cost summary (today, this week, this month)
/ezra:cost breakdown          Cost breakdown by agent
/ezra:cost budget             Show budget ceiling and remaining
/ezra:cost budget set <n>     Set monthly budget ceiling
/ezra:cost forecast           Project costs based on current burn rate
/ezra:cost history            Show daily cost history
```

### 4. Update hooks/ezra-settings.js

Add `agents` section to DEFAULTS + `getAgents` accessor:
```javascript
agents: {
  providers: [],
  budget_ceiling: { daily: 10.00, monthly: 200.00, currency: 'USD' },
  assignment_strategy: 'auto',
  max_concurrent: 3,
  fallback_order: ['claude', 'codex', 'cursor'],
  task_routing: {},
},
```

### 5. NEW FILE: tests/test-v6-agents.js (~500+ lines)

**Test categories:**
1. SUPPORTED_PROVIDERS has 9 entries with correct structure
2. ASSIGNMENT_STRATEGIES has 5 entries
3. createProvider returns valid interface
4. assignTask scoring produces correct ranking
5. recordTaskResult writes to performance files
6. getAgentPerformance reads correct data
7. getAgentLeaderboard ranks correctly
8. checkBudget detects overspend
9. loadAgentConfig reads from settings
10. Edge cases: no agents configured, single agent, budget exceeded

### 6. Update Existing Files
- Command count: 32 → 34 (agents, cost)
- Hook count: 10 → 11 (ezra-agents.js)
- Add V6-Agents test suite to runner
- Update README, CLAUDE.md, help.md, SKILL.md

## Acceptance Criteria
1. ALL GREEN, 0 failures, 520+ tests
2. Agent assignment scoring works with mock data
3. Budget tracking reads/writes correctly
4. Performance metrics accumulate correctly
