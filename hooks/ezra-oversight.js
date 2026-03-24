#!/usr/bin/env node
'use strict';

/**
 * EZRA Real-Time Agent Oversight Hook
 *
 * PreToolUse hook for Write/Edit operations.
 * Checks code changes against standards, security patterns,
 * and governance rules BEFORE they are applied.
 *
 * 4 intervention levels (from settings.yaml oversight.level):
 *   monitor — logs issues, never blocks
 *   warn    — shows warnings, doesn't block
 *   gate    — blocks critical/high violations
 *   strict  — blocks ANY violation
 *
 * Install: Add to .claude/settings.json under hooks.PreToolUse
 * { "matcher": "Write|Edit|MultiEdit",
 *   "hooks": [{ "type": "command",
 *     "command": "node <path>/ezra-oversight.js", "timeout": 5 }] }
 */

const fs = require('fs');
const path = require('path');

// ─── Settings Loader (inline, no external deps) ─────────────────

let settingsModule;
try {
  settingsModule = require(path.join(__dirname, 'ezra-settings.js'));
} catch {
  settingsModule = null;
}

function loadOversightSettings(cwd) {
  if (settingsModule) {
    return settingsModule.getOversight(cwd);
  }
  // Fallback defaults if settings module unavailable
  return {
    enabled: true,
    level: 'warn',
    health_threshold: 75,
    auto_pause_on_critical: true,
    review_every_n_files: 5,
    excluded_paths: ['*.test.ts', '*.spec.ts', 'docs/*'],
    notify_on: ['critical', 'high'],
  };
}

function loadGovernance(cwd) {
  const govPath = path.join(cwd, '.ezra', 'governance.yaml');
  if (!fs.existsSync(govPath)) return null;
  try {
    const text = fs.readFileSync(govPath, 'utf8');
    if (settingsModule) {
      return settingsModule.parseYamlSimple(text);
    }
    // Minimal fallback: extract protected_paths
    const result = { protected_paths: [] };
    const lines = text.split(/\r?\n/);
    let inProtected = false;
    for (const line of lines) {
      if (/^protected_paths:/.test(line)) { inProtected = true; continue; }
      if (inProtected && line.trim().startsWith('- ')) {
        result.protected_paths.push(line.trim().slice(2).trim());
      } else if (inProtected && !/^\s/.test(line)) {
        inProtected = false;
      }
    }
    return result;
  } catch {
    return null;
  }
}

function loadStandards(cwd) {
  if (settingsModule) {
    return settingsModule.getStandards(cwd);
  }
  return { no_any: true, naming: 'camelCase', max_complexity: 10 };
}

function loadSecuritySettings(cwd) {
  if (settingsModule) {
    return settingsModule.getSecurity(cwd);
  }
  return { secrets_scanning: true, custom_rules: [] };
}

// ─── Glob Matching ───────────────────────────────────────────────

function matchGlob(filePath, pattern) {
  const normalized = filePath.replace(/\\/g, '/');
  let regex = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '{{DS}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\{\{DS\}\}/g, '.*');
  try {
    return new RegExp(`^${regex}$`).test(normalized) ||
           new RegExp(regex).test(normalized);
  } catch {
    return false;
  }
}

// ─── ReDoS Guard ─────────────────────────────────────────────────

function isSafeRegex(pattern) {
  if (pattern.length > 200) return false;
  // Reject nested quantifiers: (a+)+, (a*)+, (a{1,})*
  if (/(\+|\*|\})\s*\)(\+|\*|\{)/.test(pattern)) return false;
  return true;
}

// ─── Violation Checks ────────────────────────────────────────────

/**
 * Run all checks against the file content being written/edited.
 * Returns array of { code, severity, message, line? }
 */
function runChecks(content, filePath, cwd) {
  const violations = [];
  const standards = loadStandards(cwd);
  const security = loadSecuritySettings(cwd);
  const governance = loadGovernance(cwd);
  const lines = content.split(/\r?\n/);

  // ── Standards Checks ────────────────────────────────────

  // STD-ANY: Detect 'any' type usage
  if (standards.no_any !== false) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Match ': any', 'as any', '<any>', ': any[]', ': any,' patterns
      if (/:\s*any\b|as\s+any\b|<any>/.test(line)) {
        violations.push({
          code: 'STD-ANY',
          severity: 'high',
          message: `'any' type detected at line ${i + 1}`,
          line: i + 1,
        });
      }
    }
  }

  // STD-NAMING: Check file naming convention
  const baseName = path.basename(filePath, path.extname(filePath));
  const naming = standards.naming || 'camelCase';
  if (naming === 'camelCase' && /^[A-Z]/.test(baseName) && !/^[A-Z][A-Z_]+$/.test(baseName)) {
    // PascalCase when camelCase is expected (but allow ALL_CAPS constants)
    violations.push({
      code: 'STD-NAMING',
      severity: 'low',
      message: `File "${path.basename(filePath)}" uses PascalCase, expected camelCase`,
    });
  }

  // STD-COMPLEXITY: Nesting depth check
  const maxComplexity = standards.max_complexity || 10;
  let maxNesting = 0;
  let currentNesting = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;
    currentNesting += opens - closes;
    if (currentNesting > maxNesting) maxNesting = currentNesting;
  }
  if (maxNesting > maxComplexity) {
    violations.push({
      code: 'STD-COMPLEXITY',
      severity: 'medium',
      message: `Nesting depth ${maxNesting} exceeds max complexity ${maxComplexity}`,
    });
  }

  // Standards custom rules
  if (Array.isArray(standards.custom_rules)) {
    for (const rule of standards.custom_rules) {
      if (typeof rule === 'string' && rule.trim() && isSafeRegex(rule)) {
        try {
          const re = new RegExp(rule);
          for (let i = 0; i < lines.length; i++) {
            if (re.test(lines[i])) {
              violations.push({
                code: 'STD-CUSTOM',
                severity: 'medium',
                message: `Custom rule "${rule}" matched at line ${i + 1}`,
                line: i + 1,
              });
            }
          }
        } catch {
          // Invalid regex, skip
        }
      }
    }
  }

  // ── Security Checks ─────────────────────────────────────

  if (security.secrets_scanning !== false) {
    // SEC-SECRETS: Hardcoded secrets patterns
    const secretPatterns = [
      { re: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][A-Za-z0-9+/=_-]{16,}['"]/i, name: 'API key' },
      { re: /(?:secret|password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/i, name: 'secret/password' },
      { re: /(?:aws_access_key_id|aws_secret)\s*[:=]\s*['"][A-Za-z0-9+/=]{16,}['"]/i, name: 'AWS key' },
      { re: /(?:-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----)/, name: 'private key' },
      { re: /ghp_[A-Za-z0-9]{36,}/, name: 'GitHub token' },
      { re: /sk-[A-Za-z0-9]{20,}/, name: 'secret key token' },
    ];

    for (let i = 0; i < lines.length; i++) {
      for (const pat of secretPatterns) {
        if (pat.re.test(lines[i])) {
          violations.push({
            code: 'SEC-SECRETS',
            severity: 'critical',
            message: `Possible ${pat.name} at line ${i + 1}`,
            line: i + 1,
          });
          break; // One violation per line is enough
        }
      }
    }
  }

  // SEC-SQLI: SQL injection patterns
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // String concatenation in SQL-like context
    if (/(?:query|sql|execute)\s*\(\s*['"`].*\$\{|['"`]\s*\+\s*\w+.*(?:WHERE|SELECT|INSERT|DELETE|UPDATE)/i.test(line)) {
      violations.push({
        code: 'SEC-SQLI',
        severity: 'critical',
        message: `Potential SQL injection via string concatenation at line ${i + 1}`,
        line: i + 1,
      });
    }
  }

  // SEC-LOG: console.log in production code
  const isTestFile = /\.(test|spec)\.[jt]sx?$/.test(filePath) || /tests?\//i.test(filePath);
  if (!isTestFile) {
    for (let i = 0; i < lines.length; i++) {
      if (/\bconsole\.(log|debug)\s*\(/.test(lines[i])) {
        violations.push({
          code: 'SEC-LOG',
          severity: 'low',
          message: `console.log/debug in production code at line ${i + 1}`,
          line: i + 1,
        });
      }
    }
  }

  // Security custom rules
  if (Array.isArray(security.custom_rules)) {
    for (const rule of security.custom_rules) {
      if (typeof rule === 'string' && rule.trim() && isSafeRegex(rule)) {
        try {
          const re = new RegExp(rule);
          for (let i = 0; i < lines.length; i++) {
            if (re.test(lines[i])) {
              violations.push({
                code: 'SEC-CUSTOM',
                severity: 'high',
                message: `Custom security rule "${rule}" matched at line ${i + 1}`,
                line: i + 1,
              });
            }
          }
        } catch {
          // Invalid regex, skip
        }
      }
    }
  }

  // ── Governance Checks ───────────────────────────────────

  if (governance && Array.isArray(governance.protected_paths)) {
    const relativePath = path.relative(cwd, path.resolve(cwd, filePath)).replace(/\\/g, '/');
    for (const pp of governance.protected_paths) {
      const pattern = (typeof pp === 'object') ? (pp.pattern || '') : String(pp);
      if (matchGlob(relativePath, pattern)) {
        violations.push({
          code: 'GOV-PROTECTED',
          severity: 'high',
          message: `File matches protected path "${pattern}"`,
        });
      }
    }
  }

  return violations;
}

// ─── Violation Logger ────────────────────────────────────────────

const MAX_LOG_SIZE = 1024 * 1024; // 1 MB log rotation threshold

function logViolations(cwd, violations, filePath) {
  if (violations.length === 0) return;
  const oversightDir = path.join(cwd, '.ezra', 'oversight');
  try {
    if (!fs.existsSync(oversightDir)) {
      fs.mkdirSync(oversightDir, { recursive: true });
    }
    const logPath = path.join(oversightDir, 'violations.log');
    // Rotate log if it exceeds threshold
    if (fs.existsSync(logPath)) {
      const stats = fs.statSync(logPath);
      if (stats.size > MAX_LOG_SIZE) {
        const rotated = logPath + '.1';
        try { fs.unlinkSync(rotated); } catch { /* no previous rotation */ }
        fs.renameSync(logPath, rotated);
      }
    }
    const timestamp = new Date().toISOString();
    const lines = violations.map(v =>
      `[${timestamp}] ${v.severity.toUpperCase()} ${v.code}: ${v.message} (${filePath})`
    );
    fs.appendFileSync(logPath, lines.join('\n') + '\n');
  } catch {
    // Logging failure should not block work
  }
}

// ─── Decision Engine ─────────────────────────────────────────────

/**
 * Given violations and oversight level, decide whether to allow or deny.
 * Returns { decision: 'allow'|'deny', message: string }
 */
function decide(violations, level) {
  if (violations.length === 0) {
    return { decision: 'allow', message: '' };
  }

  const hasCritical = violations.some(v => v.severity === 'critical');
  const hasHigh = violations.some(v => v.severity === 'high');
  const summary = violations.map(v => `[${v.code}] ${v.message}`).join('; ');

  switch (level) {
    case 'monitor': {
      const msg = `MONITOR: ${violations.length} issue(s) detected — ${summary}`;
      return { decision: 'allow', message: msg };
    }
    case 'warn': {
      const msg = `WARN: ${violations.length} issue(s) detected — ${summary}`;
      return { decision: 'allow', message: msg };
    }
    case 'gate': {
      if (hasCritical || hasHigh) {
        const msg = `GATE: Blocked — ${violations.length} issue(s) with critical/high severity — ${summary}`;
        return { decision: 'deny', message: msg };
      }
      const msg = `GATE: ${violations.length} low/medium issue(s) — ${summary}`;
      return { decision: 'allow', message: msg };
    }
    case 'strict': {
      const msg = `STRICT: Blocked — ${violations.length} issue(s) detected — ${summary}`;
      return { decision: 'deny', message: msg };
    }
    default: {
      const msg = `WARN: ${violations.length} issue(s) detected — ${summary}`;
      return { decision: 'allow', message: msg };
    }
  }
}

// ─── Exports (for require() / testing) ───────────────────────────

module.exports = {
  runChecks,
  decide,
  logViolations,
  matchGlob,
  loadOversightSettings,
  isSafeRegex,
};

// ─── Hook Protocol (stdin → stdout → exit 0) ─────────────────────

if (require.main === module) {
  const MAX_STDIN = 1024 * 1024; // 1 MB stdin limit
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    input += chunk;
    if (input.length > MAX_STDIN) { process.exit(0); }
  });
  process.stdin.on('end', () => {
    try {
      const event = JSON.parse(input);
      const toolName = event.tool_name || '';
      const filePath = event.tool_input?.file_path || event.tool_input?.path || '';
      const content = event.tool_input?.content || event.tool_input?.new_string || '';

      // Only check write/edit operations
      if (!/Write|Edit|MultiEdit/i.test(toolName)) {
        process.exit(0);
        return;
      }

      if (!filePath || !content) {
        process.exit(0);
        return;
      }

      const cwd = event.cwd || process.cwd();

      // Path traversal guard — resolved path must stay within cwd
      const resolvedPath = path.resolve(cwd, filePath);
      if (!resolvedPath.startsWith(path.resolve(cwd) + path.sep) && resolvedPath !== path.resolve(cwd)) {
        process.exit(0);
        return;
      }
      const ezraDir = path.join(cwd, '.ezra');

      // Quick exit if EZRA not initialized
      if (!fs.existsSync(ezraDir)) {
        process.exit(0);
        return;
      }

      const settings = loadOversightSettings(cwd);

      // Check if oversight is enabled
      if (!settings.enabled) {
        process.exit(0);
        return;
      }

      // Check excluded paths
      const relativePath = path.relative(cwd, path.resolve(cwd, filePath)).replace(/\\/g, '/');
      const excluded = (settings.excluded_paths || []);
      for (const pattern of excluded) {
        if (matchGlob(relativePath, pattern)) {
          process.exit(0);
          return;
        }
      }

      // Run checks
      const violations = runChecks(content, filePath, cwd);

      // Log all violations
      logViolations(cwd, violations, filePath);

      // Decide
      const { decision, message } = decide(violations, settings.level || 'warn');

      if (violations.length === 0) {
        process.exit(0);
        return;
      }

      const output = {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: decision === 'deny' ? 'deny' : 'allow',
          permissionDecisionReason: `EZRA Oversight: ${message}`,
        },
      };

      process.stdout.write(JSON.stringify(output));
    } catch {
      // Hook errors should never block work
      process.exit(0);
    }
  });
}
