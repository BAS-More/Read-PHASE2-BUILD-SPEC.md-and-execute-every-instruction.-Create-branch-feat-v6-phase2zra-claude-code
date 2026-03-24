#!/usr/bin/env node

'use strict';

/**
 * EZRA Error Code Catalog
 *
 * Structured error codes for all EZRA hooks.
 * Each code has: code, severity, message_template, action_template.
 *
 * Usage:
 *   const { formatError, ERROR_CODES } = require('./ezra-error-codes');
 *   console.error(formatError('GUARD_001', { path: 'src/auth.js', adr: 'ADR-005' }));
 *   // → "EZRA [GUARD-001]: Protected path violation on src/auth.js by ADR-005. Run /ezra:decide to authorize."
 *
 * Zero dependencies.
 */

const ERROR_CODES = {
  // ─── Guard Hook ────────────────────────────────────────────────
  GUARD_001: {
    code: 'GUARD-001',
    severity: 'warn',
    message_template: 'Protected path violation on {path}',
    action_template: 'Run /ezra:decide to authorize changes.',
  },
  GUARD_002: {
    code: 'GUARD-002',
    severity: 'error',
    message_template: 'Path traversal attempt blocked: {path}',
    action_template: 'Use a relative path within the project.',
  },
  GUARD_003: {
    code: 'GUARD-003',
    severity: 'warn',
    message_template: 'governance.yaml parse failure: {reason}',
    action_template: 'Run /ezra:health to diagnose.',
  },
  GUARD_004: {
    code: 'GUARD-004',
    severity: 'info',
    message_template: 'Unknown key \'{key}\' in governance.yaml',
    action_template: 'Possible typo — check governance.yaml keys.',
  },

  // ─── Oversight Hook ────────────────────────────────────────────
  OVERSIGHT_001: {
    code: 'OVERSIGHT-001',
    severity: 'warn',
    message_template: 'Security rule violation: {detail}',
    action_template: 'Review flagged code and run /ezra:review.',
  },
  OVERSIGHT_002: {
    code: 'OVERSIGHT-002',
    severity: 'error',
    message_template: 'ReDoS pattern rejected: {pattern}',
    action_template: 'Simplify the regex to avoid catastrophic backtracking.',
  },
  OVERSIGHT_003: {
    code: 'OVERSIGHT-003',
    severity: 'warn',
    message_template: 'Standards violation: {detail}',
    action_template: 'Run /ezra:scan to see full standards report.',
  },
  OVERSIGHT_004: {
    code: 'OVERSIGHT-004',
    severity: 'info',
    message_template: 'Oversight log rotation triggered',
    action_template: 'Previous log archived as violations.log.1.',
  },

  // ─── Drift Hook ────────────────────────────────────────────────
  DRIFT_001: {
    code: 'DRIFT-001',
    severity: 'warn',
    message_template: '{count} edits since last doc-sync. Docs potentially stale: {docs}',
    action_template: 'Run /ezra:doc-sync to review.',
  },

  // ─── Agents Hook ───────────────────────────────────────────────
  AGENTS_001: {
    code: 'AGENTS-001',
    severity: 'warn',
    message_template: 'Provider configuration error: {detail}',
    action_template: 'Run /ezra:agents list to verify roster.',
  },
  AGENTS_002: {
    code: 'AGENTS-002',
    severity: 'info',
    message_template: 'Settings module unavailable, using defaults',
    action_template: 'Run /ezra:settings to configure.',
  },

  // ─── Memory Hooks ──────────────────────────────────────────────
  MEMORY_001: {
    code: 'MEMORY-001',
    severity: 'info',
    message_template: 'Memory pruning triggered: {detail}',
    action_template: 'Run /ezra:memory list to review entries.',
  },
  MEMORY_002: {
    code: 'MEMORY-002',
    severity: 'warn',
    message_template: 'Memory store failure: {detail}',
    action_template: 'Check .ezra/memory/ directory permissions.',
  },

  // ─── Version Hook ──────────────────────────────────────────────
  VERSION_001: {
    code: 'VERSION-001',
    severity: 'info',
    message_template: 'State change versioned: {detail}',
    action_template: 'Run /ezra:version to see changelog.',
  },
  VERSION_002: {
    code: 'VERSION-002',
    severity: 'warn',
    message_template: 'Version tracking failure: {detail}',
    action_template: 'Check .ezra/versions/ directory.',
  },

  // ─── Settings Hooks ────────────────────────────────────────────
  SETTINGS_001: {
    code: 'SETTINGS-001',
    severity: 'warn',
    message_template: 'Settings parse failure, using defaults: {detail}',
    action_template: 'Run /ezra:settings to reconfigure.',
  },
  SETTINGS_002: {
    code: 'SETTINGS-002',
    severity: 'warn',
    message_template: 'Settings write failure: {detail}',
    action_template: 'Check .ezra/settings.yaml permissions.',
  },

  // ─── License Hook ──────────────────────────────────────────────
  LICENSE_001: {
    code: 'LICENSE-001',
    severity: 'warn',
    message_template: 'License validation error: {detail}',
    action_template: 'Run /ezra:license status to check.',
  },
  LICENSE_002: {
    code: 'LICENSE-002',
    severity: 'info',
    message_template: 'Tier gate: {command} requires {tier} tier',
    action_template: 'Run /ezra:license to see available features.',
  },

  // ─── PM Hook ───────────────────────────────────────────────────
  PM_001: {
    code: 'PM-001',
    severity: 'warn',
    message_template: 'Milestone tracking error: {detail}',
    action_template: 'Run /ezra:pm status to review milestones.',
  },
  PM_002: {
    code: 'PM-002',
    severity: 'info',
    message_template: 'Stall detected: {detail}',
    action_template: 'Run /ezra:progress to see recommendations.',
  },

  // ─── Planner Hook ──────────────────────────────────────────────
  PLANNER_001: {
    code: 'PLANNER-001',
    severity: 'warn',
    message_template: 'Plan validation error: {detail}',
    action_template: 'Run /ezra:plan status to review.',
  },

  // ─── Library Hook ──────────────────────────────────────────────
  LIBRARY_001: {
    code: 'LIBRARY-001',
    severity: 'warn',
    message_template: 'Library access error: {detail}',
    action_template: 'Run /ezra:library list to verify.',
  },

  // ─── Cloud Sync Hook ──────────────────────────────────────────
  CLOUD_001: {
    code: 'CLOUD-001',
    severity: 'warn',
    message_template: 'Cloud sync failure: {detail}',
    action_template: 'Check network and run /ezra:sync retry.',
  },

  // ─── Dashboard Hook ───────────────────────────────────────────
  DASH_001: {
    code: 'DASH-001',
    severity: 'info',
    message_template: 'Dashboard data collection error: {detail}',
    action_template: 'Run /ezra:health to verify .ezra/ state.',
  },

  // ─── Progress Hook ────────────────────────────────────────────
  PROGRESS_001: {
    code: 'PROGRESS-001',
    severity: 'warn',
    message_template: 'Progress tracking failure: {detail}',
    action_template: 'Run /ezra:progress to review status.',
  },

  // ─── Workflow Hook ─────────────────────────────────────────────
  WORKFLOW_001: {
    code: 'WORKFLOW-001',
    severity: 'warn',
    message_template: 'Workflow execution error: {detail}',
    action_template: 'Run /ezra:workflow list to verify templates.',
  },

  // ─── AVI-OS Bridge Hook ───────────────────────────────────────
  AVIOS_001: {
    code: 'AVIOS-001',
    severity: 'warn',
    message_template: 'AVI-OS bridge sync failure: {detail}',
    action_template: 'Check .ezra/avios/ directory and avios-context MCP.',
  },

  // ─── Installer ────────────────────────────────────────────────
  INSTALLER_001: {
    code: 'INSTALLER-001',
    severity: 'warn',
    message_template: 'Install operation failed: {detail}',
    action_template: 'Run /ezra:install with --verbose for details.',
  },

  // ─── Tier Gate Hook ───────────────────────────────────────────
  TIER_001: {
    code: 'TIER-001',
    severity: 'info',
    message_template: 'Feature gated: {detail}',
    action_template: 'Run /ezra:license to see tier features.',
  },

  // ─── HTTP Utility ─────────────────────────────────────────────
  HTTP_001: {
    code: 'HTTP-001',
    severity: 'error',
    message_template: 'SSRF attempt blocked: {url}',
    action_template: 'Use only allowed external URLs.',
  },
  HTTP_002: {
    code: 'HTTP-002',
    severity: 'warn',
    message_template: 'HTTP request failed: {detail}',
    action_template: 'Check network connectivity and retry.',
  },
};

/**
 * Format an error code with context variables.
 * @param {string} codeKey - Key from ERROR_CODES (e.g. 'GUARD_001')
 * @param {Object} [ctx] - Context variables to interpolate (e.g. { path: 'src/auth.js' })
 * @returns {string} Formatted error message for console.error()
 */
function formatError(codeKey, ctx) {
  const def = ERROR_CODES[codeKey];
  if (!def) return 'EZRA [UNKNOWN]: Unknown error code ' + codeKey;

  const context = ctx || {};
  let msg = def.message_template;
  let action = def.action_template;

  // Interpolate {key} placeholders
  for (const [key, val] of Object.entries(context)) {
    msg = msg.replace(new RegExp('\\{' + key + '\\}', 'g'), String(val));
    action = action.replace(new RegExp('\\{' + key + '\\}', 'g'), String(val));
  }

  return 'EZRA [' + def.code + ']: ' + msg + ' ' + action;
}

module.exports = { ERROR_CODES, formatError };
