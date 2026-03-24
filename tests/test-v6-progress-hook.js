#!/usr/bin/env node
'use strict';

const path = require('path');
const {
  processEvent,
  hookOutput,
  parseCheckInterval,
  getActivityCount,
  logActivity,
} = require(path.join(__dirname, '..', 'hooks', 'ezra-progress-hook.js'));

let passed = 0;
let failed = 0;
const results = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    results.push({ name, status: 'PASS' });
  } catch (err) {
    failed++;
    results.push({ name, status: 'FAIL', error: err.message });
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

// --- Exports exist ---
test('processEvent is a function', () => {
  assert(typeof processEvent === 'function');
});

test('hookOutput is a function', () => {
  assert(typeof hookOutput === 'function');
});

test('parseCheckInterval is a function', () => {
  assert(typeof parseCheckInterval === 'function');
});

test('getActivityCount is a function', () => {
  assert(typeof getActivityCount === 'function');
});

test('logActivity is a function', () => {
  assert(typeof logActivity === 'function');
});

// --- parseCheckInterval ---
test('parseCheckInterval parses minutes', () => {
  const ms = parseCheckInterval('5m');
  assert(ms === 5 * 60 * 1000, `expected 300000, got ${ms}`);
});

test('parseCheckInterval parses hours', () => {
  const ms = parseCheckInterval('2h');
  assert(ms === 2 * 60 * 60 * 1000, `expected 7200000, got ${ms}`);
});

test('parseCheckInterval parses seconds', () => {
  const ms = parseCheckInterval('30s');
  assert(ms === 30 * 1000, `expected 30000, got ${ms}`);
});

test('parseCheckInterval returns default for invalid input', () => {
  const ms = parseCheckInterval('invalid');
  assert(typeof ms === 'number' && ms > 0, 'should return a positive number');
});

test('parseCheckInterval handles null', () => {
  const ms = parseCheckInterval(null);
  assert(typeof ms === 'number' && ms > 0, 'should return default');
});

// --- getActivityCount ---
test('getActivityCount returns a number', () => {
  const count = getActivityCount();
  assert(typeof count === 'number');
});

// --- hookOutput ---
test('hookOutput returns a string', () => {
  const out = hookOutput({ tool: 'test', event: 'test' });
  assert(typeof out === 'string' || out === null || out === undefined);
});

// --- Report ---
console.log(`\n  test-v6-progress-hook: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  results.filter(r => r.status === 'FAIL').forEach(r => console.log(`    ✗ ${r.name}: ${r.error}`));
}
module.exports = { passed, failed, results };
