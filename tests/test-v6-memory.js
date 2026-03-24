'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); passed++; } catch (e) { failed++; console.log('  FAIL: ' + name); console.log('    ' + e.message); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function assertEqual(a, b) { if (a !== b) throw new Error('Expected ' + JSON.stringify(b) + ' but got ' + JSON.stringify(a)); }

function makeTempDir() {
  const dir = path.join(os.tmpdir(), 'ezra-test-mem-' + crypto.randomBytes(4).toString('hex'));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function cleanTempDir(dir) { if (dir && dir.includes('ezra-test-mem')) fs.rmSync(dir, { recursive: true, force: true }); }

const mem = require('../hooks/ezra-memory.js');
const hook = require('../hooks/ezra-memory-hook.js');

// ═══ MEMORY MODULE ═══

test('memory: exports count', () => { assertEqual(Object.keys(mem).length, 24); });

test('MEMORY_TYPES: has all types', () => {
  const expected = ['pattern', 'anti-pattern', 'lesson', 'decision-context', 'preference', 'fact', 'warning'];
  for (const t of expected) assert(mem.MEMORY_TYPES.includes(t), 'Missing: ' + t);
  assertEqual(mem.MEMORY_TYPES.length, 7);
});

test('MEMORY_PRIORITIES: has all priorities', () => {
  assertEqual(mem.MEMORY_PRIORITIES.length, 4);
  assert(mem.MEMORY_PRIORITIES.includes('critical'), 'Missing critical');
});

test('initMemory: creates directory structure', () => {
  const dir = makeTempDir();
  try {
    const result = mem.initMemory(dir);
    assertEqual(result.initialized, true);
    assertEqual(result.types, 7);
    for (const type of mem.MEMORY_TYPES) {
      assert(fs.existsSync(path.join(dir, '.ezra', 'memory', type)), 'Missing dir: ' + type);
    }
    assert(fs.existsSync(path.join(dir, '.ezra', 'memory', 'index.yaml')), 'Missing index');
  } finally { cleanTempDir(dir); }
});

test('addMemory: adds entry', () => {
  const dir = makeTempDir();
  try {
    mem.initMemory(dir);
    const result = mem.addMemory(dir, { type: 'pattern', content: 'Always use strict mode' });
    assert(result.id, 'Should have id');
    assert(result.path, 'Should have path');
    assertEqual(result.type, 'pattern');
  } finally { cleanTempDir(dir); }
});

test('addMemory: rejects invalid type', () => {
  const dir = makeTempDir();
  try {
    const result = mem.addMemory(dir, { type: 'invalid', content: 'test' });
    assert(result.error, 'Should have error');
  } finally { cleanTempDir(dir); }
});

test('addMemory: rejects missing content', () => {
  const result = mem.addMemory('/tmp', { type: 'pattern' });
  assert(result.error, 'Should require content');
});

test('getMemory: retrieves added entry', () => {
  const dir = makeTempDir();
  try {
    mem.initMemory(dir);
    const added = mem.addMemory(dir, { type: 'fact', content: 'Project uses Node 20', id: 'test-id' });
    const retrieved = mem.getMemory(dir, 'fact', 'test-id');
    assert(retrieved, 'Should find entry');
    assertEqual(retrieved.content, 'Project uses Node 20');
    assertEqual(retrieved.type, 'fact');
  } finally { cleanTempDir(dir); }
});

test('getMemory: returns null for missing', () => {
  const dir = makeTempDir();
  try {
    assertEqual(mem.getMemory(dir, 'pattern', 'nonexistent'), null);
  } finally { cleanTempDir(dir); }
});

test('updateMemory: updates entry', () => {
  const dir = makeTempDir();
  try {
    mem.initMemory(dir);
    mem.addMemory(dir, { type: 'pattern', content: 'Original', id: 'upd-test' });
    const result = mem.updateMemory(dir, 'pattern', 'upd-test', { content: 'Updated' });
    assertEqual(result.content, 'Updated');
    assert(result.updated, 'Should have updated timestamp');
  } finally { cleanTempDir(dir); }
});

test('deleteMemory: removes entry', () => {
  const dir = makeTempDir();
  try {
    mem.initMemory(dir);
    mem.addMemory(dir, { type: 'lesson', content: 'To delete', id: 'del-test' });
    const result = mem.deleteMemory(dir, 'lesson', 'del-test');
    assert(result.deleted, 'Should confirm deletion');
    assertEqual(mem.getMemory(dir, 'lesson', 'del-test'), null);
  } finally { cleanTempDir(dir); }
});

test('listMemories: lists all entries', () => {
  const dir = makeTempDir();
  try {
    mem.initMemory(dir);
    mem.addMemory(dir, { type: 'pattern', content: 'Pattern 1' });
    mem.addMemory(dir, { type: 'fact', content: 'Fact 1' });
    mem.addMemory(dir, { type: 'pattern', content: 'Pattern 2' });
    const all = mem.listMemories(dir);
    assertEqual(all.length, 3);
  } finally { cleanTempDir(dir); }
});

test('listMemories: filters by type', () => {
  const dir = makeTempDir();
  try {
    mem.initMemory(dir);
    mem.addMemory(dir, { type: 'pattern', content: 'P1' });
    mem.addMemory(dir, { type: 'fact', content: 'F1' });
    mem.addMemory(dir, { type: 'pattern', content: 'P2' });
    const patterns = mem.listMemories(dir, 'pattern');
    assertEqual(patterns.length, 2);
  } finally { cleanTempDir(dir); }
});

test('searchMemory: finds matching entries', () => {
  const dir = makeTempDir();
  try {
    mem.initMemory(dir);
    mem.addMemory(dir, { type: 'pattern', content: 'Always validate user input' });
    mem.addMemory(dir, { type: 'fact', content: 'Server runs on port 3000' });
    const results = mem.searchMemory(dir, 'validate');
    assertEqual(results.length, 1);
    assert(results[0].content.includes('validate'), 'Should match');
  } finally { cleanTempDir(dir); }
});

test('searchMemory: returns empty for no match', () => {
  const dir = makeTempDir();
  try {
    mem.initMemory(dir);
    mem.addMemory(dir, { type: 'fact', content: 'Project uses TypeScript' });
    const results = mem.searchMemory(dir, 'zzzznonexistent');
    assertEqual(results.length, 0);
  } finally { cleanTempDir(dir); }
});

test('getRelevantMemories: scores by relevance', () => {
  const dir = makeTempDir();
  try {
    mem.initMemory(dir);
    mem.addMemory(dir, { type: 'pattern', content: 'Always sanitize database queries', tags: ['security', 'database'] });
    mem.addMemory(dir, { type: 'fact', content: 'Server runs on port 3000', tags: ['server'] });
    mem.addMemory(dir, { type: 'warning', content: 'Database connections must be pooled', tags: ['database', 'performance'], priority: 'critical' });
    const relevant = mem.getRelevantMemories(dir, 'database query optimization');
    assert(relevant.length > 0, 'Should find relevant');
    assert(relevant[0].relevance > 0, 'Should have relevance score');
  } finally { cleanTempDir(dir); }
});

test('getMemoryStats: returns stats', () => {
  const dir = makeTempDir();
  try {
    mem.initMemory(dir);
    mem.addMemory(dir, { type: 'pattern', content: 'P1' });
    mem.addMemory(dir, { type: 'fact', content: 'F1' });
    const stats = mem.getMemoryStats(dir);
    assertEqual(stats.initialized, true);
    assertEqual(stats.total_entries, 2);
  } finally { cleanTempDir(dir); }
});

test('getMemoryStats: uninitialized project', () => {
  const dir = makeTempDir();
  try {
    const stats = mem.getMemoryStats(dir);
    assertEqual(stats.initialized, false);
    assertEqual(stats.total_entries, 0);
  } finally { cleanTempDir(dir); }
});

test('archiveMemory: soft-deletes entry', () => {
  const dir = makeTempDir();
  try {
    mem.initMemory(dir);
    mem.addMemory(dir, { type: 'pattern', content: 'Old pattern', id: 'arch-test' });
    mem.archiveMemory(dir, 'pattern', 'arch-test');
    const archived = mem.getArchivedMemories(dir);
    assertEqual(archived.length, 1);
    const active = mem.listMemories(dir);
    assertEqual(active.length, 0);
  } finally { cleanTempDir(dir); }
});

test('exportMemories + importMemories: round-trip', () => {
  const dir1 = makeTempDir();
  const dir2 = makeTempDir();
  try {
    mem.initMemory(dir1);
    mem.addMemory(dir1, { type: 'pattern', content: 'Test pattern' });
    mem.addMemory(dir1, { type: 'fact', content: 'Test fact' });
    const exported = mem.exportMemories(dir1);
    assertEqual(exported.count, 2);
    
    mem.initMemory(dir2);
    const imported = mem.importMemories(dir2, exported);
    assertEqual(imported.imported, 2);
    assertEqual(imported.skipped, 0);
    assertEqual(mem.listMemories(dir2).length, 2);
  } finally { cleanTempDir(dir1); cleanTempDir(dir2); }
});

test('importMemories: skips duplicates', () => {
  const dir = makeTempDir();
  try {
    mem.initMemory(dir);
    mem.addMemory(dir, { type: 'pattern', content: 'Existing', id: 'dup-id' });
    const exported = { entries: [{ type: 'pattern', content: 'Existing', id: 'dup-id' }] };
    const result = mem.importMemories(dir, exported);
    assertEqual(result.skipped, 1);
    assertEqual(result.imported, 0);
  } finally { cleanTempDir(dir); }
});

// ═══ MEMORY HOOK ═══

test('hook: exports count', () => { assertEqual(Object.keys(hook).length, 8); });

test('detectPatterns: finds "always use" pattern', () => {
  const results = hook.detectPatterns('You should always use strict mode in JavaScript files.');
  assert(results.length > 0, 'Should detect pattern');
  assertEqual(results[0].type, 'pattern');
});

test('detectPatterns: finds "never use" anti-pattern', () => {
  const results = hook.detectPatterns('Never use eval() in production code.');
  assert(results.length > 0, 'Should detect anti-pattern');
  assertEqual(results[0].type, 'anti-pattern');
});

test('detectPatterns: finds best practice', () => {
  const results = hook.detectPatterns('It is a best practice to validate all inputs.');
  assert(results.length > 0, 'Should detect');
  assertEqual(results[0].type, 'pattern');
});

test('detectPatterns: finds warning', () => {
  const results = hook.detectPatterns('Warning: this API will be deprecated in v3.');
  assert(results.length > 0, 'Should detect warning');
  assertEqual(results[0].type, 'warning');
});

test('detectPatterns: returns empty for no triggers', () => {
  const results = hook.detectPatterns('Just a normal sentence about nothing special.');
  assertEqual(results.length, 0);
});

test('detectPatterns: handles empty input', () => {
  assertEqual(hook.detectPatterns('').length, 0);
  assertEqual(hook.detectPatterns(null).length, 0);
});

test('extractTags: extracts tech keywords', () => {
  const tags = hook.extractTags('Use React with TypeScript for the frontend API.');
  assert(tags.includes('react'), 'Should find react');
  assert(tags.includes('typescript'), 'Should find typescript');
  assert(tags.includes('api'), 'Should find api');
});

test('extractTags: handles empty', () => {
  assertEqual(hook.extractTags('').length, 0);
  assertEqual(hook.extractTags(null).length, 0);
});

test('calculateSimilarity: identical strings', () => {
  const sim = hook.calculateSimilarity('hello world', 'hello world');
  assertEqual(sim, 1);
});

test('calculateSimilarity: different strings', () => {
  const sim = hook.calculateSimilarity('hello world', 'goodbye moon');
  assertEqual(sim, 0);
});

test('calculateSimilarity: partial overlap', () => {
  const sim = hook.calculateSimilarity('hello world foo', 'hello world bar');
  assert(sim > 0 && sim < 1, 'Should be partial: ' + sim);
});

test('calculateSimilarity: handles empty', () => {
  assertEqual(hook.calculateSimilarity('', 'test'), 0);
  assertEqual(hook.calculateSimilarity(null, null), 0);
});

// ═══ SETTINGS ═══

test('settings: has memory section', () => {
  const s = require('../hooks/ezra-settings.js');
  assert(s.DEFAULTS.memory, 'Should have memory');
  assertEqual(s.DEFAULTS.memory.auto_capture, true);
  assertEqual(s.DEFAULTS.memory.max_entries, 500);
});

test('settings: getMemory accessor', () => {
  const s = require('../hooks/ezra-settings.js');
  assertEqual(typeof s.getMemory, 'function');
});

console.log('  V6-Memory: PASSED: ' + passed + '  FAILED: ' + failed);
process.exit(failed > 0 ? 1 : 0);
