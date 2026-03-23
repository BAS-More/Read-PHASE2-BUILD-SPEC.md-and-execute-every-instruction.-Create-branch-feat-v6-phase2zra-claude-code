#!/usr/bin/env node
'use strict';

/**
 * EZRA Unified Settings Parser
 *
 * Reads .ezra/settings.yaml and merges with sensible defaults.
 * Provides section accessors for standards, security, oversight,
 * best_practices, and workflows.
 *
 * Zero external dependencies — uses a built-in simple YAML parser
 * that handles flat keys, one-level nested sections, inline arrays,
 * and inline objects.
 *
 * Can be required as a module or invoked via stdin (hook protocol).
 */

const fs = require('fs');
const path = require('path');

// ─── Defaults ────────────────────────────────────────────────────

const DEFAULTS = {
  standards: {
    typescript_strict: true,
    no_any: true,
    naming: 'camelCase',
    error_handling: 'explicit',
    max_complexity: 10,
    test_coverage_minimum: 80,
    custom_rules: [],
  },
  security: {
    profile: 'standard',
    require_auth_on_all_routes: false,
    secrets_scanning: true,
    input_validation: true,
    rate_limiting: false,
    custom_rules: [],
  },
  oversight: {
    enabled: true,
    level: 'warn',
    health_threshold: 75,
    auto_pause_on_critical: true,
    review_every_n_files: 5,
    excluded_paths: ['*.test.ts', '*.spec.ts', 'docs/*'],
    notify_on: ['critical', 'high'],
  },
  best_practices: {
    enabled: true,
    suggest_frequency: 'always',
    domains: ['architecture', 'security', 'quality', 'testing'],
    auto_suggest: true,
  },
  workflows: {
    active_templates: [],
    auto_run: false,
    approval_gates: true,
  },
};

// ─── YAML Parser (simple, no deps) ──────────────────────────────

/**
 * Parse a single YAML value string into a JS value.
 * Handles: booleans, null, integers, floats, quoted strings,
 * inline arrays [a, b], inline objects {k: v}.
 */
function parseValue(raw) {
  if (raw === undefined || raw === null) return null;
  const trimmed = String(raw).trim();
  if (trimmed === '' || trimmed === 'null' || trimmed === '~') return null;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;

  // Quoted strings
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  // Inline array: [a, b, c]
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const inner = trimmed.slice(1, -1).trim();
    if (inner === '') return [];
    return inner.split(',').map(s => parseValue(s.trim()));
  }

  // Inline object: {k: v, k2: v2}
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const inner = trimmed.slice(1, -1).trim();
    if (inner === '') return {};
    const obj = {};
    const pairs = inner.split(',');
    for (const pair of pairs) {
      const colonIdx = pair.indexOf(':');
      if (colonIdx > 0) {
        const k = pair.slice(0, colonIdx).trim();
        const v = pair.slice(colonIdx + 1).trim();
        obj[k] = parseValue(v);
      }
    }
    return obj;
  }

  // Integer
  if (/^-?\d+$/.test(trimmed)) return parseInt(trimmed, 10);

  // Float
  if (/^-?\d+\.\d+$/.test(trimmed)) return parseFloat(trimmed);

  // Plain string
  return trimmed;
}

/**
 * Parse simple YAML text into a JS object.
 * Supports: top-level keys, one-level nested sections (indented),
 * list items (- value), comments (#), and blank lines.
 */
function parseYamlSimple(text) {
  const result = {};
  const lines = text.split(/\r?\n/);
  let currentSection = null;

  for (const line of lines) {
    // Skip blank lines and comments
    if (/^\s*$/.test(line) || /^\s*#/.test(line)) continue;

    const indent = line.match(/^(\s*)/)[1].length;

    // Top-level key (no indent)
    if (indent === 0) {
      const m = line.match(/^(\w[\w_-]*):\s*(.*)?$/);
      if (!m) continue;
      const key = m[1];
      const val = (m[2] || '').trim();
      if (val === '' || val === undefined) {
        // Section header — next indented lines belong here
        currentSection = key;
        result[key] = {};
      } else {
        currentSection = null;
        result[key] = parseValue(val);
      }
    } else if (currentSection) {
      // Indented: either a key:value or a list item
      const trimmed = line.trim();
      if (trimmed.startsWith('- ')) {
        // List item — convert section to array if needed
        if (!Array.isArray(result[currentSection])) {
          result[currentSection] = [];
        }
        result[currentSection].push(parseValue(trimmed.slice(2).trim()));
      } else {
        const m = trimmed.match(/^(\w[\w_-]*):\s*(.*)?$/);
        if (m) {
          const key = m[1];
          const val = (m[2] || '').trim();
          if (typeof result[currentSection] !== 'object' || Array.isArray(result[currentSection])) {
            result[currentSection] = {};
          }
          result[currentSection][key] = parseValue(val);
        }
      }
    }
  }

  return result;
}

// ─── Deep Merge ──────────────────────────────────────────────────

/**
 * Deep merge source into target. Arrays are replaced, not merged.
 * Returns a new object.
 */
function deepMerge(target, source) {
  const output = {};
  // Copy target first
  for (const key of Object.keys(target)) {
    if (target[key] !== null && typeof target[key] === 'object' && !Array.isArray(target[key])) {
      output[key] = deepMerge(target[key], {});
    } else if (Array.isArray(target[key])) {
      output[key] = target[key].slice();
    } else {
      output[key] = target[key];
    }
  }
  // Overlay source
  for (const key of Object.keys(source)) {
    if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      output[key] = deepMerge(output[key] || {}, source[key]);
    } else if (Array.isArray(source[key])) {
      output[key] = source[key].slice();
    } else {
      output[key] = source[key];
    }
  }
  return output;
}

// ─── Settings Loaders ────────────────────────────────────────────

/**
 * Returns a deep clone of DEFAULTS.
 */
function getDefault() {
  return JSON.parse(JSON.stringify(DEFAULTS));
}

/**
 * Load settings from .ezra/settings.yaml, merged with defaults.
 * If the file doesn't exist, returns defaults.
 */
function loadSettings(projectDir) {
  const defaults = getDefault();
  const settingsPath = path.join(projectDir, '.ezra', 'settings.yaml');
  if (!fs.existsSync(settingsPath)) return defaults;

  try {
    const text = fs.readFileSync(settingsPath, 'utf8');
    const parsed = parseYamlSimple(text);
    return deepMerge(defaults, parsed);
  } catch {
    return defaults;
  }
}

/**
 * Section accessors
 */
function getStandards(projectDir) {
  return loadSettings(projectDir).standards;
}

function getSecurity(projectDir) {
  return loadSettings(projectDir).security;
}

function getOversight(projectDir) {
  return loadSettings(projectDir).oversight;
}

function getBestPractices(projectDir) {
  return loadSettings(projectDir).best_practices;
}

function getWorkflows(projectDir) {
  return loadSettings(projectDir).workflows;
}

// ─── Exports (for require()) ─────────────────────────────────────

module.exports = {
  loadSettings,
  getStandards,
  getSecurity,
  getOversight,
  getBestPractices,
  getWorkflows,
  parseYamlSimple,
  parseValue,
  deepMerge,
  DEFAULTS,
  getDefault,
};

// ─── Hook Protocol (stdin → stdout) ──────────────────────────────
// When invoked as a hook, read settings and output them as JSON.

if (require.main === module) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => input += chunk);
  process.stdin.on('end', () => {
    try {
      const event = JSON.parse(input);
      const cwd = event.cwd || process.cwd();
      const settings = loadSettings(cwd);
      process.stdout.write(JSON.stringify(settings));
    } catch {
      // Graceful failure — output empty and exit 0
      process.stdout.write('{}');
    }
    process.exit(0);
  });
}
