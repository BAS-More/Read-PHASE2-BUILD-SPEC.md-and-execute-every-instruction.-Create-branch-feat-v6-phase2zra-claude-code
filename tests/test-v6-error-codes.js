#!/usr/bin/env node
'use strict';

/**
 * Tests for hooks/ezra-error-codes.js
 * Verifies: all codes defined, formatError interpolation, unknown code handling.
 */

const path = require('path');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    console.error('FAIL: ' + name + ' — ' + e.message);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

// ─── Import module ───────────────────────────────────────────────

const { ERROR_CODES, formatError } = require(path.join(__dirname, '..', 'hooks', 'ezra-error-codes.js'));

// ─── Tests ───────────────────────────────────────────────────────

test('exports ERROR_CODES object', () => {
  assert(typeof ERROR_CODES === 'object', 'should be object');
  assert(Object.keys(ERROR_CODES).length > 0, 'should have entries');
});

test('exports formatError function', () => {
  assert(typeof formatError === 'function', 'should be function');
});

test('all error codes have required fields', () => {
  for (const [key, def] of Object.entries(ERROR_CODES)) {
    assert(typeof def.code === 'string', key + ' missing code');
    assert(typeof def.severity === 'string', key + ' missing severity');
    assert(typeof def.message_template === 'string', key + ' missing message_template');
    assert(typeof def.action_template === 'string', key + ' missing action_template');
    assert(['info', 'warn', 'error'].includes(def.severity), key + ' invalid severity: ' + def.severity);
  }
});

test('code field matches key pattern', () => {
  for (const [key, def] of Object.entries(ERROR_CODES)) {
    // Key format: PREFIX_NNN, code format: PREFIX-NNN
    const expected = key.replace('_', '-');
    assert(def.code === expected, key + ' code should be ' + expected + ' but got ' + def.code);
  }
});

test('all expected hook categories have codes', () => {
  const requiredPrefixes = [
    'GUARD', 'OVERSIGHT', 'DRIFT', 'AGENTS', 'MEMORY', 'VERSION',
    'SETTINGS', 'LICENSE', 'PM', 'PLANNER', 'LIBRARY', 'CLOUD',
    'DASH', 'PROGRESS', 'WORKFLOW', 'AVIOS', 'INSTALLER', 'TIER', 'HTTP'
  ];
  for (const prefix of requiredPrefixes) {
    const hasCode = Object.keys(ERROR_CODES).some(k => k.startsWith(prefix + '_'));
    assert(hasCode, 'Missing error code for category: ' + prefix);
  }
});

test('formatError interpolates placeholders', () => {
  const result = formatError('GUARD_001', { path: 'src/auth.js' });
  assert(result.includes('GUARD-001'), 'should contain code');
  assert(result.includes('src/auth.js'), 'should interpolate {path}');
  assert(result.includes('EZRA'), 'should start with EZRA prefix');
});

test('formatError works without context', () => {
  const result = formatError('GUARD_001');
  assert(result.includes('GUARD-001'), 'should contain code');
  assert(result.includes('EZRA'), 'should have prefix');
});

test('formatError handles unknown code gracefully', () => {
  const result = formatError('NONEXISTENT_999');
  assert(result.includes('UNKNOWN'), 'should indicate unknown code');
  assert(result.includes('NONEXISTENT_999'), 'should include the bad key');
});

test('formatError interpolates multiple placeholders', () => {
  const result = formatError('DRIFT_001', { count: 5, docs: 'README.md, SPEC.md' });
  assert(result.includes('5'), 'should interpolate count');
  assert(result.includes('README.md, SPEC.md'), 'should interpolate docs');
});

test('at least 25 error codes defined', () => {
  const count = Object.keys(ERROR_CODES).length;
  assert(count >= 25, 'Expected at least 25 codes, found ' + count);
});

test('formatError returns string', () => {
  for (const key of Object.keys(ERROR_CODES)) {
    const result = formatError(key);
    assert(typeof result === 'string', key + ' should produce string');
    assert(result.length > 10, key + ' message too short');
  }
});

// ─── Summary ─────────────────────────────────────────────────────

console.log('');
console.log('Error Codes Tests');
console.log('PASSED: ' + passed + ' FAILED: ' + failed);
if (failed > 0) process.exit(1);
