#!/usr/bin/env node
'use strict';

/**
 * EZRA v6 — Settings Round-Trip Tests
 * Verifies serialize → parse round-trip for all 14 settings sections.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

const settings = require(path.join(__dirname, '..', 'hooks', 'ezra-settings.js'));
const writer = require(path.join(__dirname, '..', 'hooks', 'ezra-settings-writer.js'));

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    console.log(`  FAIL: ${name} — ${e.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

// Round-trip each section
const sections = Object.keys(settings.DEFAULTS);

for (const sec of sections) {
  test(`round-trip: ${sec}`, () => {
    const orig = settings.DEFAULTS[sec];
    const yaml = writer.serializeYaml({ [sec]: orig });
    const parsed = settings.parseYamlSimple(yaml);
    assert(
      JSON.stringify(orig) === JSON.stringify(parsed[sec]),
      `${sec} mismatch:\n  ORIG: ${JSON.stringify(orig).substring(0, 100)}\n  BACK: ${JSON.stringify(parsed[sec]).substring(0, 100)}`
    );
  });
}

// Full settings round-trip
test('round-trip: all sections combined', () => {
  const yaml = writer.serializeYaml(settings.DEFAULTS);
  const parsed = settings.parseYamlSimple(yaml);
  for (const sec of sections) {
    assert(
      JSON.stringify(settings.DEFAULTS[sec]) === JSON.stringify(parsed[sec]),
      `combined round-trip failed on ${sec}`
    );
  }
});

// 3-level nesting specifically
test('round-trip: self_learning.domains (3-level)', () => {
  const yaml = writer.serializeYaml({ self_learning: settings.DEFAULTS.self_learning });
  const parsed = settings.parseYamlSimple(yaml);
  assert(typeof parsed.self_learning.domains === 'object', 'domains should be object');
  assert(!Array.isArray(parsed.self_learning.domains), 'domains should not be array');
  assert(parsed.self_learning.domains.standards_effectiveness === true, 'standards_effectiveness');
  assert(parsed.self_learning.domains.cost_optimisation === true, 'cost_optimisation');
});

test('round-trip: self_learning.cross_project (3-level)', () => {
  const yaml = writer.serializeYaml({ self_learning: settings.DEFAULTS.self_learning });
  const parsed = settings.parseYamlSimple(yaml);
  assert(typeof parsed.self_learning.cross_project === 'object', 'cross_project should be object');
  assert(parsed.self_learning.cross_project.enabled === false, 'cross_project.enabled should be false');
  assert(Array.isArray(parsed.self_learning.cross_project.shared_domains), 'shared_domains should be array');
});

// Inline arrays
test('round-trip: inline arrays preserved', () => {
  const yaml = 'test:\n  items: [a, b, c]\n';
  const parsed = settings.parseYamlSimple(yaml);
  assert(Array.isArray(parsed.test.items), 'should be array');
  assert(parsed.test.items.length === 3, 'should have 3 items');
  assert(parsed.test.items[0] === 'a', 'first item');
});

// Edge cases
test('round-trip: empty object', () => {
  const yaml = writer.serializeYaml({});
  const parsed = settings.parseYamlSimple(yaml);
  assert(Object.keys(parsed).length === 0, 'should be empty');
});

test('round-trip: null values', () => {
  const yaml = 'test:\n  key: null\n';
  const parsed = settings.parseYamlSimple(yaml);
  assert(parsed.test.key === null, 'should be null');
});

test('round-trip: boolean values', () => {
  const yaml = 'test:\n  a: true\n  b: false\n';
  const parsed = settings.parseYamlSimple(yaml);
  assert(parsed.test.a === true, 'true');
  assert(parsed.test.b === false, 'false');
});

test('round-trip: numeric values', () => {
  const yaml = 'test:\n  int: 42\n  float: 3.14\n';
  const parsed = settings.parseYamlSimple(yaml);
  assert(parsed.test.int === 42, 'int');
  assert(parsed.test.float === 3.14, 'float');
});

console.log(`  V6-Settings-RoundTrip: PASSED: ${passed}  FAILED: ${failed}`);
if (failed > 0) process.exit(1);
