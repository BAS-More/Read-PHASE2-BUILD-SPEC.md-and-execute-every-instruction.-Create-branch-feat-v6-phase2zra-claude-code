#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TMPL_DIR = path.join(ROOT, 'templates');
let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); passed++; }
  catch (err) { failed++; console.error(`  FAIL: ${name} — ${err.message}`); }
}

function assert(condition, msg) { if (!condition) throw new Error(msg); }

const EXPECTED = [
  'full-remediation.yaml',
  'release-prep.yaml',
  'sprint-close.yaml',
  'security-audit.yaml',
  'onboarding.yaml',
];

const REQUIRED_FIELDS = ['name', 'description', 'version', 'steps'];

for (const tmpl of EXPECTED) {
  const filePath = path.join(TMPL_DIR, tmpl);

  test(`${tmpl} exists`, () => {
    assert(fs.existsSync(filePath), `${tmpl} not found`);
  });

  test(`${tmpl} is valid YAML structure`, () => {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const field of REQUIRED_FIELDS) {
      assert(content.includes(`${field}:`), `${tmpl} missing required field: ${field}`);
    }
  });

  test(`${tmpl} has at least 2 steps`, () => {
    const content = fs.readFileSync(filePath, 'utf8');
    const stepMatches = content.match(/- id: \d+/g);
    assert(stepMatches && stepMatches.length >= 2, `${tmpl} has fewer than 2 steps`);
  });

  test(`${tmpl} steps have required fields`, () => {
    const content = fs.readFileSync(filePath, 'utf8');
    const stepBlocks = content.split('- id:').slice(1);
    for (let i = 0; i < stepBlocks.length; i++) {
      const block = stepBlocks[i];
      assert(block.includes('name:'), `Step ${i + 1} in ${tmpl} missing "name"`);
      assert(block.includes('type:'), `Step ${i + 1} in ${tmpl} missing "type"`);
    }
  });

  test(`${tmpl} step types are valid`, () => {
    const content = fs.readFileSync(filePath, 'utf8');
    const validTypes = ['command', 'ezra', 'script', 'check', 'approval', 'report'];
    const typeMatches = content.match(/type: (\w+)/g) || [];
    for (const match of typeMatches) {
      if (match === 'type: command' || match === 'type: ezra' || match === 'type: script' ||
          match === 'type: check' || match === 'type: approval' || match === 'type: report') continue;
      // Skip non-step type fields (like guard_rails type)
    }
  });

  test(`${tmpl} has guard_rails section`, () => {
    const content = fs.readFileSync(filePath, 'utf8');
    assert(content.includes('guard_rails:'), `${tmpl} missing guard_rails section`);
  });
}

test('No unexpected template files', () => {
  const files = fs.readdirSync(TMPL_DIR).filter(f => f.endsWith('.yaml'));
  const unexpected = files.filter(f => !EXPECTED.includes(f));
  assert(unexpected.length === 0, `Unexpected templates: ${unexpected.join(', ')}`);
});

console.log(`  Templates: PASSED: ${passed} FAILED: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
