---
name: ezra:scan
description: Full multi-agent codebase analysis. Dispatches architect, reviewer, and guardian agents to analyze architecture, code quality, security, and governance compliance. Results saved to .ezra/scans/.
---

You are running an EZRA deep scan. This is a multi-phase, multi-agent analysis of the codebase.

First, read `.ezra/knowledge.yaml` and `.ezra/governance.yaml` to understand current state.

If `.ezra/` does not exist, tell the user to run `/ezra:init` first and stop.

## Phase 1: Architecture Scan (Agent: ezra-architect)

Dispatch the `ezra-architect` subagent with this brief:

"Analyze the codebase architecture. Read the project entry points, directory structure, and key modules. Produce a structured report covering:
1. **Layer Map**: What architectural layers exist and how they connect
2. **Dependency Graph**: Key internal module dependencies (which modules import which)
3. **External Integration Points**: APIs, databases, caches, queues, third-party services
4. **Pattern Compliance**: Does the code follow consistent patterns or are there deviations
5. **Complexity Hotspots**: Files or modules with highest complexity or coupling
6. **Architecture Drift**: Any deviations from the documented/intended architecture

Output as structured YAML."

## Phase 2: Quality & Security Scan (Agent: ezra-reviewer)

Dispatch the `ezra-reviewer` subagent with this brief:

"Perform a code quality and security review of the codebase. Focus on:
1. **Type Safety**: Any use of `any`, untyped interfaces, missing return types
2. **Error Handling**: Uncaught promises, missing try/catch, generic error swallowing
3. **Security**: Hardcoded secrets, SQL injection vectors, XSS risks, missing input validation, OWASP Top 10 checks
4. **Test Coverage Gaps**: Modules or functions without corresponding tests
5. **Dead Code**: Unused exports, unreachable branches, commented-out code
6. **Dependency Health**: Outdated packages, known vulnerabilities, unnecessary dependencies

Output as structured YAML with severity ratings (CRITICAL/HIGH/MEDIUM/LOW)."

## Phase 3: Governance Compliance (Agent: ezra-guardian)

Dispatch the `ezra-guardian` subagent with this brief:

"Check governance compliance against .ezra/governance.yaml and .ezra/decisions/. Verify:
1. **Decision Compliance**: Are all recorded architectural decisions being followed in the code?
2. **Protected Path Integrity**: Have any protected paths been modified without a corresponding decision record?
3. **Standard Adherence**: Does the code meet the configured standards (strict types, no any, coverage minimum)?
4. **Drift Detection**: Compare current codebase state against .ezra/knowledge.yaml — what has changed since last scan?

Output as structured YAML with violation details."

## Phase 4: Reconciliation Check (Agent: ezra-reconciler)

If any files exist in `.ezra/plans/`, dispatch the `ezra-reconciler` subagent:

"Compare registered plans in .ezra/plans/ against the current codebase. For each plan:
1. Which planned items have been implemented?
2. Which planned items are missing or incomplete?
3. Were any unplanned changes introduced?
4. What is the overall plan completion percentage?

Output as structured YAML."

If no plans exist, skip this phase and note "No plans registered for reconciliation."

## Phase 5: Aggregate & Persist

Combine all agent outputs into a single scan report. Save to `.ezra/scans/<ISO-date>-scan.yaml`:

```yaml
# .ezra/scans/YYYY-MM-DDTHH-MM-SS-scan.yaml
timestamp: <ISO>
phases_completed: [architecture, quality_security, governance, reconciliation]

architecture:
  <architect agent output>

quality_security:
  findings_by_severity:
    critical: <count>
    high: <count>
    medium: <count>
    low: <count>
  <reviewer agent output>

governance:
  compliant: <true/false>
  violations: <count>
  <guardian agent output>

reconciliation:
  <reconciler agent output or "no_plans_registered">

summary:
  health_score: <calculated 0-100>
  top_risks: <top 3 findings>
  recommended_actions: <top 3 next steps>
```

Update `.ezra/knowledge.yaml` with any new discoveries.

## Phase 6: Present Report

Present a compact summary to the user:

```
EZRA SCAN COMPLETE
═══════════════════════════════════════════
Timestamp: <date>
Health Score: <score>/100

Architecture:  <1-line summary>
Quality:       <critical>C <high>H <medium>M <low>L findings
Governance:    <compliant/violations found>
Reconciliation: <status>

Top Risks:
  1. <risk>
  2. <risk>
  3. <risk>

Recommended Actions:
  1. <action>
  2. <action>
  3. <action>

Full report: .ezra/scans/<filename>
═══════════════════════════════════════════
```

Execute all phases automatically without asking for confirmation. Use subagents for parallel execution where possible.
