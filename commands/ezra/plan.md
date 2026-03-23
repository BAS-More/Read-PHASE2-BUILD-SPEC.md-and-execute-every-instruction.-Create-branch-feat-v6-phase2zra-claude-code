---
name: "ezra:plan"
description: "Holistic Planning Engine — comprehensive upfront planning with verified task delivery"
---

# /ezra:plan

Holistic planning engine for EZRA-governed projects.

## Subcommands

### create
Create a new master plan from a specification.
- Input: plan name, description, feature list, risk assessment
- Output: master-plan.yaml with ordering, dependencies, risk levels
- Stage: holistic_plan → task decomposition ready

### status
Show current plan status: stage, feature completion, task progress.

### tasks
List all tasks in the queue with status, assignees, dependencies.

### assign <taskIndex> [agentId]
Assign a pending task to an agent. Uses ezra-agents scoring if no agent specified.

### gap-check
Compare completed work against master plan. Reports drift, blocked tasks, completion %.

### checkpoint [label]
Create a recovery checkpoint saving current plan + task state.

### history
List all checkpoints and gap reports with timestamps.

### describe
Generate a human-readable description of the current plan.

## Usage

\`\`\`
/ezra:plan create — start a new master plan
/ezra:plan status — view current plan progress
/ezra:plan tasks — list all tasks
/ezra:plan assign 0 code-agent — assign task 0
/ezra:plan gap-check — check for drift
/ezra:plan checkpoint "Phase 1 complete" — save progress
/ezra:plan history — view checkpoints and gap reports
/ezra:plan describe — human-readable plan summary
\`\`\`

## 7-Stage Pipeline

1. **Holistic Plan** — PM analyses full scope, deps, risks
2. **Task Decomposition** — break into agent-sized tasks (max 1 file per task)
3. **Assignment** — assign each task to optimal agent
4. **Execution** — agent works single task, output captured
5. **Verification** — quality gate (tests, lint, health)
6. **Gap Check** — compare against master plan
7. **Checkpoint** — save progress, update dashboard
