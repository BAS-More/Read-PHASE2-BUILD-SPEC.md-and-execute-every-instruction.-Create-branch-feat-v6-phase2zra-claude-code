---
name: ezra:review
description: Multi-agent code review dispatching architecture, security, and quality agents in parallel. Reviews staged changes, a specific file, or recent commits.
---

You are running an EZRA multi-agent code review.

If `.ezra/` does not exist, tell the user to run `/ezra:init` first and stop.

## Determine Scope

If $ARGUMENTS contains a file path → review that file
If $ARGUMENTS contains "staged" or "changes" → review staged git changes
If $ARGUMENTS contains a commit hash → review that commit
If $ARGUMENTS is empty → review staged changes, or if none, the last commit

```bash
# Determine what to review
git diff --cached --name-only  # staged
git diff HEAD~1 --name-only    # last commit
```

## Dispatch Three Review Agents in Parallel

### Agent 1: Architecture Review (ezra-architect)

Brief: "Review these changed files for architectural compliance:
<list of files>

Check against the project's established patterns documented in .ezra/knowledge.yaml.
Look for:
1. Layer violations (e.g., controller calling repository directly, bypassing service layer)
2. Circular dependencies introduced
3. Inconsistent patterns (e.g., using callbacks in one place, promises elsewhere)
4. Missing abstractions or leaky abstractions
5. Coupling that should be loose

Rate each finding: CRITICAL / HIGH / MEDIUM / LOW
Output structured YAML."

### Agent 2: Security Review (ezra-reviewer)

Brief: "Perform a security-focused review of these changed files:
<list of files with diff content>

Check for OWASP Top 10 2025 risks:
1. Injection (SQL, NoSQL, command, LDAP)
2. Broken authentication / session management
3. Sensitive data exposure (logging PII, hardcoded secrets, missing encryption)
4. XML/JSON external entities
5. Broken access control (missing auth checks, IDOR)
6. Security misconfiguration
7. XSS (stored, reflected, DOM)
8. Insecure deserialization
9. Using components with known vulnerabilities
10. Insufficient logging and monitoring

Also check:
- Input validation completeness
- Output encoding
- Error handling (information leakage in error messages)
- Race conditions
- Path traversal

Rate each finding: CRITICAL / HIGH / MEDIUM / LOW with confidence score (0-100).
Output structured YAML."

### Agent 3: Quality Review (ezra-reviewer)

Brief: "Perform a code quality review of these changed files:
<list of files with diff content>

Check for:
1. Type safety: any types, missing return types, unsafe casts
2. Error handling: uncaught promises, generic catch blocks, swallowed errors
3. Testing: are there corresponding test updates for the changes?
4. Naming: clear, consistent, domain-appropriate naming
5. Complexity: functions too long (>50 lines), deeply nested logic (>3 levels)
6. DRY violations: duplicated logic that should be abstracted
7. Dead code: unused imports, unreachable branches, commented-out code
8. Documentation: missing JSDoc/docstrings on public APIs
9. Edge cases: null/undefined handling, empty arrays, boundary conditions
10. Performance: N+1 queries, unnecessary re-renders, missing memoization

Rate each finding: CRITICAL / HIGH / MEDIUM / LOW
Output structured YAML."

## Aggregate Results

Combine all three agent outputs. Deduplicate findings that overlap (e.g., a security issue that is also a quality issue).

## Check Against Decisions

Cross-reference findings with `.ezra/decisions/` — if any finding contradicts an active decision, escalate it to CRITICAL regardless of the agent's original severity.

## Present Report

```
EZRA CODE REVIEW
═══════════════════════════════════════════
Scope: <what was reviewed>
Files: <count>

FINDINGS BY SEVERITY:
  🔴 Critical: <count>
  🟠 High:     <count>
  🟡 Medium:   <count>
  🔵 Low:      <count>

ARCHITECTURE:
  <list findings with file:line, severity, description>

SECURITY:
  <list findings with file:line, severity, description, confidence>

QUALITY:
  <list findings with file:line, severity, description>

DECISION CONFLICTS:
  <any findings that conflict with recorded decisions>

VERDICT: <APPROVE / APPROVE WITH NOTES / REQUEST CHANGES / BLOCK>

Recommended Actions:
  1. <most critical action>
  2. <next action>
  3. <next action>
═══════════════════════════════════════════
```

Verdict logic:
- Any CRITICAL finding → BLOCK
- 3+ HIGH findings → REQUEST CHANGES
- HIGH findings with confidence > 80 → REQUEST CHANGES
- Only MEDIUM/LOW → APPROVE WITH NOTES
- No findings → APPROVE

Execute all phases automatically without asking for confirmation.
