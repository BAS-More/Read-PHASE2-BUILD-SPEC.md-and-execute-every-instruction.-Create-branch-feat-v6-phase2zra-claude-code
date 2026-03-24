#!/usr/bin/env node
'use strict';

const path = require('path');
const {
  GATED_COMMANDS,
  CORE_COMMANDS,
  checkGate,
  handleHook,
} = require(path.join(__dirname, '..', 'hooks', 'ezra-tier-gate.js'));

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

// --- Exports ---
test('GATED_COMMANDS is an array', () => {
  assert(Array.isArray(GATED_COMMANDS), 'should be array');
});

test('CORE_COMMANDS is an array', () => {
  assert(Array.isArray(CORE_COMMANDS), 'should be array');
});

test('GATED_COMMANDS has entries', () => {
  assert(GATED_COMMANDS.length > 0, 'should have gated commands');
});

test('CORE_COMMANDS has entries', () => {
  assert(CORE_COMMANDS.length > 0, 'should have core commands');
});

test('checkGate is a function', () => {
  assert(typeof checkGate === 'function');
});

test('handleHook is a function', () => {
  assert(typeof handleHook === 'function');
});

// --- No overlap between core and gated ---
test('CORE and GATED commands do not overlap', () => {
  const overlap = CORE_COMMANDS.filter(c => GATED_COMMANDS.includes(c));
  assert(overlap.length === 0, `overlapping commands: ${overlap.join(', ')}`);
});

// --- checkGate ---
test('checkGate allows core commands without license', () => {
  if (CORE_COMMANDS.length > 0) {
    const result = checkGate(CORE_COMMANDS[0], null);
    assert(result === true || (result && result.allowed !== false), 'core command should be allowed');
  }
});

test('checkGate blocks gated commands without license', () => {
  if (GATED_COMMANDS.length > 0) {
    const result = checkGate(GATED_COMMANDS[0], null);
    assert(result === false || (result && result.allowed === false), 'gated command should be blocked without license');
  }
});

test('checkGate allows gated commands with valid license', () => {
  if (GATED_COMMANDS.length > 0) {
    const fakeLicense = { tier: 'pro', valid: true, expires: '2099-01-01' };
    const result = checkGate(GATED_COMMANDS[0], fakeLicense);
    assert(result === true || (result && result.allowed !== false), 'gated command should be allowed with license');
  }
});

test('checkGate handles unknown command gracefully', () => {
  const result = checkGate('nonexistent-command-xyz', null);
  assert(result !== undefined, 'should return a defined value');
});

// --- handleHook ---
test('handleHook returns a result object or string', () => {
  const result = handleHook({ tool: 'test', input: {} });
  assert(result !== undefined);
});

// --- Report ---
console.log(`\n  test-v6-tier-gate: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  results.filter(r => r.status === 'FAIL').forEach(r => console.log(`    ✗ ${r.name}: ${r.error}`));
}
module.exports = { passed, failed, results };
