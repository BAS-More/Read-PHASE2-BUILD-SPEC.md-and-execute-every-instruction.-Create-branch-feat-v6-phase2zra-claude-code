#!/usr/bin/env node
'use strict';

/**
 * EZRA v6 Phase 3 — Settings Writer Test Suite
 *
 * Tests serializeYaml, setSetting, addRule, removeRule,
 * resetSection, resetAll, exportSettings, diffSettings, initSettings.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

// ─── Test Harness ────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    console.error('  FAIL: ' + name);
    console.error('    ' + (e.message || e));
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg || 'assertEqual') + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
  }
}

function assertIncludes(arr, item, msg) {
  if (!arr.includes(item)) {
    throw new Error((msg || 'assertIncludes') + ': ' + JSON.stringify(item) + ' not in array');
  }
}

// ─── Setup ───────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..');
const writer = require(path.join(ROOT, 'hooks', 'ezra-settings-writer'));
const settings = require(path.join(ROOT, 'hooks', 'ezra-settings'));

const {
  serializeYaml,
  serializeScalar,
  setSetting,
  addRule,
  removeRule,
  resetSection,
  resetAll,
  exportSettings,
  diffSettings,
  initSettings,
} = writer;

const { loadSettings, getDefault, parseYamlSimple, DEFAULTS } = settings;

function makeTempDir() {
  const dir = path.join(os.tmpdir(), 'ezra-test-sw-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanTempDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
}

// ═══════════════════════════════════════════════════════════════
// 1. serializeScalar Tests
// ═══════════════════════════════════════════════════════════════

test('serializeScalar: null returns "null"', () => {
  assertEqual(serializeScalar(null), 'null');
});

test('serializeScalar: undefined returns "null"', () => {
  assertEqual(serializeScalar(undefined), 'null');
});

test('serializeScalar: boolean true', () => {
  assertEqual(serializeScalar(true), 'true');
});

test('serializeScalar: boolean false', () => {
  assertEqual(serializeScalar(false), 'false');
});

test('serializeScalar: number integer', () => {
  assertEqual(serializeScalar(42), '42');
});

test('serializeScalar: number float', () => {
  assertEqual(serializeScalar(3.14), '3.14');
});

test('serializeScalar: plain string', () => {
  assertEqual(serializeScalar('hello'), 'hello');
});

test('serializeScalar: string "true" gets quoted', () => {
  assertEqual(serializeScalar('true'), '"true"');
});

test('serializeScalar: string "false" gets quoted', () => {
  assertEqual(serializeScalar('false'), '"false"');
});

test('serializeScalar: string "null" gets quoted', () => {
  assertEqual(serializeScalar('null'), '"null"');
});

test('serializeScalar: empty string gets quoted', () => {
  assertEqual(serializeScalar(''), '""');
});

test('serializeScalar: numeric string gets quoted', () => {
  assertEqual(serializeScalar('42'), '"42"');
});

test('serializeScalar: string with colon gets quoted', () => {
  assert(serializeScalar('key: value').startsWith('"'), 'should be quoted');
});

test('serializeScalar: string with hash gets quoted', () => {
  assert(serializeScalar('has # comment').startsWith('"'), 'should be quoted');
});


// ═══════════════════════════════════════════════════════════════
// 2. serializeYaml Tests
// ═══════════════════════════════════════════════════════════════

test('serializeYaml: null returns empty string', () => {
  assertEqual(serializeYaml(null), '');
});

test('serializeYaml: empty object', () => {
  assertEqual(serializeYaml({}), '');
});

test('serializeYaml: top-level scalars', () => {
  const yaml = serializeYaml({ name: 'test', count: 5, active: true });
  assert(yaml.includes('name: test'), 'should have name');
  assert(yaml.includes('count: 5'), 'should have count');
  assert(yaml.includes('active: true'), 'should have active');
});

test('serializeYaml: top-level null value', () => {
  const yaml = serializeYaml({ key: null });
  assert(yaml.includes('key: null'), 'should have null');
});

test('serializeYaml: nested object', () => {
  const yaml = serializeYaml({ section: { key: 'val', num: 10 } });
  assert(yaml.includes('section:'), 'should have section header');
  assert(yaml.includes('  key: val'), 'should have indented key');
  assert(yaml.includes('  num: 10'), 'should have indented num');
});

test('serializeYaml: top-level array', () => {
  const yaml = serializeYaml({ items: ['a', 'b', 'c'] });
  assert(yaml.includes('items:'), 'should have array header');
  assert(yaml.includes('  - a'), 'should have item a');
  assert(yaml.includes('  - b'), 'should have item b');
});

test('serializeYaml: sub-array uses inline format', () => {
  const yaml = serializeYaml({ section: { tags: ['x', 'y'] } });
  assert(yaml.includes('tags: [x, y]'), 'should use inline array: ' + yaml);
});

test('serializeYaml: empty sub-array uses inline format', () => {
  const yaml = serializeYaml({ section: { items: [] } });
  assert(yaml.includes('items: []'), 'should have empty inline array: ' + yaml);
});

test('serializeYaml: third-level nested object', () => {
  const yaml = serializeYaml({ l1: { l2: { l3key: 'val' } } });
  assert(yaml.includes('  l2:'), 'should have l2 header');
  assert(yaml.includes('    l3key: val'), 'should have l3 indented');
});

// ═══════════════════════════════════════════════════════════════
// 3. Round-trip Tests (serializeYaml → parseYamlSimple)
// ═══════════════════════════════════════════════════════════════

test('Round-trip: simple scalars', () => {
  const input = { name: 'test', count: 5, active: true };
  const yaml = serializeYaml(input);
  const parsed = parseYamlSimple(yaml);
  assertEqual(parsed.name, 'test');
  assertEqual(parsed.count, 5);
  assertEqual(parsed.active, true);
});

test('Round-trip: nested object', () => {
  const input = { section: { key: 'val', num: 10, flag: false } };
  const yaml = serializeYaml(input);
  const parsed = parseYamlSimple(yaml);
  assertEqual(parsed.section.key, 'val');
  assertEqual(parsed.section.num, 10);
  assertEqual(parsed.section.flag, false);
});

test('Round-trip: sub-array', () => {
  const input = { section: { tags: ['a', 'b', 'c'] } };
  const yaml = serializeYaml(input);
  const parsed = parseYamlSimple(yaml);
  assert(Array.isArray(parsed.section.tags), 'tags should be array');
  assertEqual(parsed.section.tags.length, 3);
  assertEqual(parsed.section.tags[0], 'a');
});

test('Round-trip: standards section', () => {
  const defaults = getDefault();
  const yaml = serializeYaml({ standards: defaults.standards });
  const parsed = parseYamlSimple(yaml);
  assertEqual(parsed.standards.typescript_strict, true);
  assertEqual(parsed.standards.max_complexity, 10);
  assertEqual(parsed.standards.naming, 'camelCase');
});

test('Round-trip: oversight section', () => {
  const defaults = getDefault();
  const yaml = serializeYaml({ oversight: defaults.oversight });
  const parsed = parseYamlSimple(yaml);
  assertEqual(parsed.oversight.enabled, true);
  assertEqual(parsed.oversight.level, 'warn');
  assertEqual(parsed.oversight.health_threshold, 75);
  assert(Array.isArray(parsed.oversight.notify_on), 'notify_on should be array');
});

test('Round-trip: security section', () => {
  const defaults = getDefault();
  const yaml = serializeYaml({ security: defaults.security });
  const parsed = parseYamlSimple(yaml);
  assertEqual(parsed.security.profile, 'standard');
  assertEqual(parsed.security.secrets_scanning, true);
});

test('Round-trip: workflows section', () => {
  const defaults = getDefault();
  const yaml = serializeYaml({ workflows: defaults.workflows });
  const parsed = parseYamlSimple(yaml);
  assertEqual(parsed.workflows.auto_run, false);
  assertEqual(parsed.workflows.approval_gates, true);
});

test('Round-trip: boolean values preserved', () => {
  const input = { sec: { t: true, f: false } };
  const yaml = serializeYaml(input);
  const parsed = parseYamlSimple(yaml);
  assertEqual(parsed.sec.t, true);
  assertEqual(parsed.sec.f, false);
});

test('Round-trip: null preserved', () => {
  const input = { sec: { n: null } };
  const yaml = serializeYaml(input);
  const parsed = parseYamlSimple(yaml);
  assertEqual(parsed.sec.n, null);
});
