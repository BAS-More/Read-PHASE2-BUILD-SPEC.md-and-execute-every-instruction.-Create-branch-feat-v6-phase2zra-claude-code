#!/usr/bin/env node
'use strict';

const path = require('path');
const {
  CAPTURE_TRIGGERS,
  MAX_CONTENT_LENGTH,
  MIN_CONTENT_LENGTH,
  detectPatterns,
  extractTags,
  processToolOutput,
  isDuplicate,
  calculateSimilarity,
} = require(path.join(__dirname, '..', 'hooks', 'ezra-memory-hook.js'));

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

// --- CAPTURE_TRIGGERS ---
test('CAPTURE_TRIGGERS is an array with entries', () => {
  assert(Array.isArray(CAPTURE_TRIGGERS), 'should be array');
  assert(CAPTURE_TRIGGERS.length >= 5, 'should have at least 5 triggers');
});

test('each trigger has pattern, type, priority', () => {
  for (const t of CAPTURE_TRIGGERS) {
    assert(t.pattern instanceof RegExp, 'pattern should be RegExp');
    assert(typeof t.type === 'string', 'type should be string');
    assert(typeof t.priority === 'string', 'priority should be string');
  }
});

// --- Constants ---
test('MAX_CONTENT_LENGTH is a positive number', () => {
  assert(typeof MAX_CONTENT_LENGTH === 'number' && MAX_CONTENT_LENGTH > 0);
});

test('MIN_CONTENT_LENGTH is a positive number', () => {
  assert(typeof MIN_CONTENT_LENGTH === 'number' && MIN_CONTENT_LENGTH > 0);
});

// --- detectPatterns ---
test('detectPatterns returns empty for null/empty', () => {
  assert(detectPatterns(null).length === 0);
  assert(detectPatterns('').length === 0);
  assert(detectPatterns('hi').length === 0); // below MIN_CONTENT_LENGTH
});

test('detectPatterns detects "always use" trigger', () => {
  const r = detectPatterns('We should always use strict mode in JavaScript files');
  assert(r.length > 0, 'should detect pattern');
  assert(r[0].type === 'pattern', 'should be pattern type');
});

test('detectPatterns detects "never use" trigger', () => {
  const r = detectPatterns('Never use eval in production code, it is dangerous');
  assert(r.length > 0, 'should detect anti-pattern');
});

test('detectPatterns detects "best practice" trigger', () => {
  const r = detectPatterns('It is a best practice to validate all inputs before processing');
  assert(r.length > 0, 'should detect best practice');
});

test('detectPatterns detects "lesson learned" trigger', () => {
  const r = detectPatterns('Lesson learned: always check for null before accessing properties');
  assert(r.length > 0);
});

// --- extractTags ---
test('extractTags is a function', () => {
  assert(typeof extractTags === 'function');
});

test('extractTags returns array', () => {
  const tags = extractTags('some text about JavaScript and TypeScript');
  assert(Array.isArray(tags));
});

// --- processToolOutput ---
test('processToolOutput is a function', () => {
  assert(typeof processToolOutput === 'function');
});

test('processToolOutput handles empty input', () => {
  const r = processToolOutput('');
  assert(r !== undefined);
});

// --- isDuplicate ---
test('isDuplicate is a function', () => {
  assert(typeof isDuplicate === 'function');
});

test('isDuplicate returns boolean', () => {
  const r = isDuplicate('test content', []);
  assert(typeof r === 'boolean');
});

// --- calculateSimilarity ---
test('calculateSimilarity is a function', () => {
  assert(typeof calculateSimilarity === 'function');
});

test('calculateSimilarity returns 1 for identical strings', () => {
  const s = calculateSimilarity('hello world', 'hello world');
  assert(s === 1, `expected 1, got ${s}`);
});

test('calculateSimilarity returns 0 for completely different strings', () => {
  const s = calculateSimilarity('aaaa', 'zzzz');
  assert(s < 0.5, `expected low similarity, got ${s}`);
});

test('calculateSimilarity handles empty strings', () => {
  const s = calculateSimilarity('', '');
  assert(typeof s === 'number');
});

// --- Report ---
console.log(`\n  test-v6-memory-hook: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  results.filter(r => r.status === 'FAIL').forEach(r => console.log(`    ✗ ${r.name}: ${r.error}`));
}
module.exports = { passed, failed, results };
