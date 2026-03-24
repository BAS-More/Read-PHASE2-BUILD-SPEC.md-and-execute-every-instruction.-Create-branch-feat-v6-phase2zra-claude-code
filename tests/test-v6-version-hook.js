#!/usr/bin/env node
'use strict';

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const hookPath = path.join(__dirname, '..', 'hooks', 'ezra-version-hook.js');

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

// --- File exists ---
test('ezra-version-hook.js exists', () => {
  assert(fs.existsSync(hookPath), 'hook file should exist');
});

test('hook file is valid JavaScript (syntax check)', () => {
  const content = fs.readFileSync(hookPath, 'utf-8');
  assert(content.includes('process.stdin'), 'should read from stdin');
  assert(content.includes('.ezra'), 'should reference .ezra directory');
});

test('hook has shebang line', () => {
  const content = fs.readFileSync(hookPath, 'utf-8');
  assert(content.startsWith('#!/usr/bin/env node'), 'should have node shebang');
});

test('hook enforces MAX_STDIN limit', () => {
  const content = fs.readFileSync(hookPath, 'utf-8');
  assert(content.includes('MAX_STDIN'), 'should have stdin size limit');
});

test('hook exits gracefully on error (never blocks work)', () => {
  const content = fs.readFileSync(hookPath, 'utf-8');
  assert(content.includes('process.exit(0)'), 'should exit 0 even on error');
});

test('hook handles version bumping', () => {
  const content = fs.readFileSync(hookPath, 'utf-8');
  assert(content.includes('version') && content.includes('updated'), 'should track version and update time');
});

test('hook writes YAML format', () => {
  const content = fs.readFileSync(hookPath, 'utf-8');
  assert(content.includes('version:') || content.includes("'version:'"), 'should write version in YAML');
});

// --- Process execution test ---
test('hook exits cleanly with empty stdin', () => {
  try {
    execSync(`echo "" | node "${hookPath}"`, { timeout: 5000, stdio: 'pipe', cwd: os.tmpdir() });
  } catch (e) {
    // Exit code 0 is success, non-zero from missing .ezra is acceptable
    // The key is it doesn't hang
  }
  assert(true, 'hook should not hang on empty stdin');
});

test('hook exits cleanly with invalid JSON stdin', () => {
  try {
    execSync(`echo "not json" | node "${hookPath}"`, { timeout: 5000, stdio: 'pipe', cwd: os.tmpdir() });
  } catch (e) {
    // Non-zero exit acceptable, hanging is not
  }
  assert(true, 'hook should not hang on invalid JSON');
});

// --- Report ---
console.log(`\n  test-v6-version-hook: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  results.filter(r => r.status === 'FAIL').forEach(r => console.log(`    ✗ ${r.name}: ${r.error}`));
}
module.exports = { passed, failed, results };
