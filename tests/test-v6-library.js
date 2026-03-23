#!/usr/bin/env node
'use strict';

/**
 * EZRA V6 Library Test Suite
 * Tests: library categories, entry schema, init, add, remove, search, relevant, export
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  LIBRARY_CATEGORIES,
  ENTRY_SCHEMA,
  SEVERITY_LEVELS,
  initLibrary,
  getCategories,
  getEntries,
  addEntry,
  removeEntry,
  searchLibrary,
  getRelevant,
  importFromUrl,
  exportLibrary,
  serializeEntry,
  serializeEntries,
  parseEntries,
} = require(path.join(__dirname, '..', 'hooks', 'ezra-library.js'));

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); passed++; }
  catch (err) { failed++; console.error('  FAIL: ' + name + ' — ' + err.message); }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

function makeTempDir() {
  const dir = path.join(os.tmpdir(), 'ezra-lib-test-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

// ═══════════════════════════════════════════════════════════════
// 1. LIBRARY_CATEGORIES
// ═══════════════════════════════════════════════════════════════

test('LIBRARY_CATEGORIES has exactly 14 entries', () => {
  assert(LIBRARY_CATEGORIES.length === 14, 'Expected 14, got ' + LIBRARY_CATEGORIES.length);
});

test('LIBRARY_CATEGORIES includes code-quality', () => {
  assert(LIBRARY_CATEGORIES.includes('code-quality'));
});

test('LIBRARY_CATEGORIES includes security', () => {
  assert(LIBRARY_CATEGORIES.includes('security'));
});

test('LIBRARY_CATEGORIES includes testing', () => {
  assert(LIBRARY_CATEGORIES.includes('testing'));
});

test('LIBRARY_CATEGORIES includes architecture', () => {
  assert(LIBRARY_CATEGORIES.includes('architecture'));
});

test('LIBRARY_CATEGORIES includes devops', () => {
  assert(LIBRARY_CATEGORIES.includes('devops'));
});

test('LIBRARY_CATEGORIES includes ui-ux', () => {
  assert(LIBRARY_CATEGORIES.includes('ui-ux'));
});

test('LIBRARY_CATEGORIES includes performance', () => {
  assert(LIBRARY_CATEGORIES.includes('performance'));
});

test('LIBRARY_CATEGORIES includes documentation', () => {
  assert(LIBRARY_CATEGORIES.includes('documentation'));
});

test('LIBRARY_CATEGORIES includes process-qc', () => {
  assert(LIBRARY_CATEGORIES.includes('process-qc'));
});

test('LIBRARY_CATEGORIES includes iso-standards', () => {
  assert(LIBRARY_CATEGORIES.includes('iso-standards'));
});

test('LIBRARY_CATEGORIES includes compliance', () => {
  assert(LIBRARY_CATEGORIES.includes('compliance'));
});

test('LIBRARY_CATEGORIES includes ai-agent', () => {
  assert(LIBRARY_CATEGORIES.includes('ai-agent'));
});

test('LIBRARY_CATEGORIES includes database', () => {
  assert(LIBRARY_CATEGORIES.includes('database'));
});

test('LIBRARY_CATEGORIES includes api-design', () => {
  assert(LIBRARY_CATEGORIES.includes('api-design'));
});

test('LIBRARY_CATEGORIES are all unique', () => {
  const set = new Set(LIBRARY_CATEGORIES);
  assert(set.size === LIBRARY_CATEGORIES.length, 'Duplicate categories found');
});

// ═══════════════════════════════════════════════════════════════
// 2. ENTRY_SCHEMA
// ═══════════════════════════════════════════════════════════════

test('ENTRY_SCHEMA has all required fields', () => {
  const required = ['id', 'title', 'description', 'category', 'subcategory', 'source_url', 'date_added', 'date_verified', 'relevance_score', 'applicable_to', 'tags', 'severity'];
  for (const field of required) {
    assert(field in ENTRY_SCHEMA, 'Missing field: ' + field);
  }
});

test('ENTRY_SCHEMA has correct types', () => {
  assert(ENTRY_SCHEMA.id === 'string');
  assert(ENTRY_SCHEMA.relevance_score === 'number');
  assert(ENTRY_SCHEMA.applicable_to === 'array');
  assert(ENTRY_SCHEMA.tags === 'array');
});

test('SEVERITY_LEVELS has 4 entries', () => {
  assert(SEVERITY_LEVELS.length === 4, 'Expected 4, got ' + SEVERITY_LEVELS.length);
});

test('SEVERITY_LEVELS includes required and info', () => {
  assert(SEVERITY_LEVELS.includes('info'));
  assert(SEVERITY_LEVELS.includes('advisory'));
  assert(SEVERITY_LEVELS.includes('recommended'));
  assert(SEVERITY_LEVELS.includes('required'));
});

// ═══════════════════════════════════════════════════════════════
// 3. getCategories
// ═══════════════════════════════════════════════════════════════

test('getCategories returns 14 categories', () => {
  const cats = getCategories();
  assert(cats.length === 14);
});

test('getCategories returns a copy', () => {
  const cats = getCategories();
  cats.push('fake');
  assert(LIBRARY_CATEGORIES.length === 14, 'Original modified');
});

// ═══════════════════════════════════════════════════════════════
// 4. initLibrary
// ═══════════════════════════════════════════════════════════════

test('initLibrary creates library directory', () => {
  const dir = makeTempDir();
  try {
    initLibrary(dir);
    assert(fs.existsSync(path.join(dir, '.ezra', 'library')), 'library dir missing');
  } finally { cleanup(dir); }
});

test('initLibrary creates all 14 category files', () => {
  const dir = makeTempDir();
  try {
    initLibrary(dir);
    for (const cat of LIBRARY_CATEGORIES) {
      const p = path.join(dir, '.ezra', 'library', cat + '.yaml');
      assert(fs.existsSync(p), 'Missing: ' + cat + '.yaml');
    }
  } finally { cleanup(dir); }
});

test('initLibrary creates meta.yaml', () => {
  const dir = makeTempDir();
  try {
    initLibrary(dir);
    const metaPath = path.join(dir, '.ezra', 'library', 'meta.yaml');
    assert(fs.existsSync(metaPath), 'meta.yaml missing');
    const content = fs.readFileSync(metaPath, 'utf8');
    assert(content.includes('total_entries:'), 'meta missing total_entries');
    assert(content.includes('research_agent_status:'), 'meta missing research_agent_status');
  } finally { cleanup(dir); }
});

test('initLibrary returns correct counts', () => {
  const dir = makeTempDir();
  try {
    const result = initLibrary(dir);
    assert(result.categories === 14, 'Expected 14 categories');
    assert(result.entries > 40, 'Expected 40+ seed entries, got ' + result.entries);
  } finally { cleanup(dir); }
});

test('initLibrary seeds code-quality with 4 entries', () => {
  const dir = makeTempDir();
  try {
    initLibrary(dir);
    const entries = getEntries(dir, 'code-quality');
    assert(entries.length === 4, 'Expected 4, got ' + entries.length);
  } finally { cleanup(dir); }
});

test('initLibrary seeds security with 5 entries', () => {
  const dir = makeTempDir();
  try {
    initLibrary(dir);
    const entries = getEntries(dir, 'security');
    assert(entries.length === 5, 'Expected 5, got ' + entries.length);
  } finally { cleanup(dir); }
});

test('initLibrary seeds all categories with 3+ entries', () => {
  const dir = makeTempDir();
  try {
    initLibrary(dir);
    for (const cat of LIBRARY_CATEGORIES) {
      const entries = getEntries(dir, cat);
      assert(entries.length >= 3, cat + ' has only ' + entries.length + ' entries, need 3+');
    }
  } finally { cleanup(dir); }
});

// ═══════════════════════════════════════════════════════════════
// 5. Serialization
// ═══════════════════════════════════════════════════════════════

test('serializeEntry produces id line', () => {
  const entry = { id: 'test-1', title: 'Test', description: 'Desc', category: 'testing', subcategory: 'unit', source_url: '', date_added: '2025-01-01', date_verified: '2025-01-01', relevance_score: 8, applicable_to: ['js'], tags: ['test'], severity: 'recommended' };
  const yaml = serializeEntry(entry);
  assert(yaml.includes('- id: test-1'), 'Missing id');
  assert(yaml.includes('title:'), 'Missing title');
});

test('serializeEntries produces entries header', () => {
  const entries = [{ id: 'x-1', title: 'X', description: '', category: 'testing', subcategory: '', source_url: '', date_added: '', date_verified: '', relevance_score: 5, applicable_to: [], tags: [], severity: 'info' }];
  const yaml = serializeEntries(entries);
  assert(yaml.startsWith('entries:'), 'Should start with entries:');
});

test('serializeEntries handles empty array', () => {
  const yaml = serializeEntries([]);
  assert(yaml.includes('entries: []'), 'Should show empty array');
});

test('parseEntries round-trips correctly', () => {
  const entries = [
    { id: 'rt-001', title: 'Round Trip', description: 'Test round trip', category: 'testing', subcategory: 'unit', source_url: 'https://example.com', date_added: '2025-01-01', date_verified: '2025-01-01', relevance_score: 8, applicable_to: ['js', 'ts'], tags: ['test', 'round-trip'], severity: 'recommended' },
  ];
  const yaml = serializeEntries(entries);
  const parsed = parseEntries(yaml);
  assert(parsed.length === 1, 'Expected 1 entry');
  assert(parsed[0].id === 'rt-001', 'ID mismatch');
  assert(parsed[0].title === 'Round Trip', 'Title mismatch');
  assert(parsed[0].relevance_score === 8, 'Score mismatch');
});

// ═══════════════════════════════════════════════════════════════
// 6. addEntry
// ═══════════════════════════════════════════════════════════════

test('addEntry adds to correct category', () => {
  const dir = makeTempDir();
  try {
    initLibrary(dir);
    const result = addEntry(dir, { id: 'custom-001', title: 'Custom', category: 'security', description: 'Custom entry' });
    assert(result.success === true, 'Expected success');
    const entries = getEntries(dir, 'security');
    assert(entries.some(e => e.id === 'custom-001'), 'Entry not found');
  } finally { cleanup(dir); }
});

test('addEntry rejects missing id', () => {
  const dir = makeTempDir();
  try {
    initLibrary(dir);
    const result = addEntry(dir, { category: 'security', title: 'No ID' });
    assert(result.success === false, 'Should fail without ID');
  } finally { cleanup(dir); }
});

test('addEntry rejects invalid category', () => {
  const dir = makeTempDir();
  try {
    initLibrary(dir);
    const result = addEntry(dir, { id: 'x-1', category: 'nonexistent', title: 'Bad' });
    assert(result.success === false, 'Should fail with invalid category');
  } finally { cleanup(dir); }
});

test('addEntry rejects duplicate ID', () => {
  const dir = makeTempDir();
  try {
    initLibrary(dir);
    const result = addEntry(dir, { id: 'sec-001', category: 'security', title: 'Dup' });
    assert(result.success === false, 'Should reject duplicate');
    assert(result.reason.includes('Duplicate'), 'Reason should mention duplicate');
  } finally { cleanup(dir); }
});

test('addEntry auto-fills defaults', () => {
  const dir = makeTempDir();
  try {
    initLibrary(dir);
    addEntry(dir, { id: 'auto-001', title: 'Auto', category: 'testing' });
    const entries = getEntries(dir, 'testing');
    const entry = entries.find(e => e.id === 'auto-001');
    assert(entry, 'Entry not found');
    assert(entry.date_added, 'date_added not set');
    assert(Array.isArray(entry.tags), 'tags not array');
  } finally { cleanup(dir); }
});

test('addEntry normalises invalid severity to info', () => {
  const dir = makeTempDir();
  try {
    initLibrary(dir);
    addEntry(dir, { id: 'sev-001', title: 'Sev', category: 'testing', severity: 'critical' });
    const entries = getEntries(dir, 'testing');
    const entry = entries.find(e => e.id === 'sev-001');
    assert(entry.severity === 'info', 'Should normalise to info');
  } finally { cleanup(dir); }
});

// ═══════════════════════════════════════════════════════════════
// 7. removeEntry
// ═══════════════════════════════════════════════════════════════

test('removeEntry removes existing entry', () => {
  const dir = makeTempDir();
  try {
    initLibrary(dir);
    const before = getEntries(dir, 'security').length;
    const result = removeEntry(dir, 'security', 'sec-001');
    assert(result.success === true, 'Expected success');
    const after = getEntries(dir, 'security').length;
    assert(after === before - 1, 'Entry not removed');
  } finally { cleanup(dir); }
});

test('removeEntry fails for nonexistent entry', () => {
  const dir = makeTempDir();
  try {
    initLibrary(dir);
    const result = removeEntry(dir, 'security', 'nonexistent');
    assert(result.success === false, 'Should fail');
  } finally { cleanup(dir); }
});

test('removeEntry fails for invalid category', () => {
  const dir = makeTempDir();
  try {
    const result = removeEntry(dir, 'fake-cat', 'x');
    assert(result.success === false, 'Should fail');
  } finally { cleanup(dir); }
});

// ═══════════════════════════════════════════════════════════════
// 8. searchLibrary
// ═══════════════════════════════════════════════════════════════

test('searchLibrary finds entries by title keyword', () => {
  const dir = makeTempDir();
  try {
    initLibrary(dir);
    const results = searchLibrary(dir, 'secrets');
    assert(results.length >= 1, 'Should find at least 1 entry about secrets');
  } finally { cleanup(dir); }
});

test('searchLibrary finds entries by tag', () => {
  const dir = makeTempDir();
  try {
    initLibrary(dir);
    const results = searchLibrary(dir, 'owasp');
    assert(results.length >= 2, 'Should find 2+ OWASP entries');
  } finally { cleanup(dir); }
});

test('searchLibrary returns empty for no match', () => {
  const dir = makeTempDir();
  try {
    initLibrary(dir);
    const results = searchLibrary(dir, 'xyznonexistent123');
    assert(results.length === 0, 'Should find nothing');
  } finally { cleanup(dir); }
});

test('searchLibrary handles empty query', () => {
  const dir = makeTempDir();
  try {
    initLibrary(dir);
    const results = searchLibrary(dir, '');
    assert(results.length === 0, 'Empty query should return nothing');
  } finally { cleanup(dir); }
});

test('searchLibrary is case insensitive', () => {
  const dir = makeTempDir();
  try {
    initLibrary(dir);
    const r1 = searchLibrary(dir, 'OWASP');
    const r2 = searchLibrary(dir, 'owasp');
    assert(r1.length === r2.length, 'Case sensitivity mismatch');
  } finally { cleanup(dir); }
});

// ═══════════════════════════════════════════════════════════════
// 9. getRelevant
// ═══════════════════════════════════════════════════════════════

test('getRelevant returns entries for .js files', () => {
  const dir = makeTempDir();
  try {
    initLibrary(dir);
    const results = getRelevant(dir, 'src/app.js');
    assert(results.length > 0, 'Should find relevant entries for .js');
  } finally { cleanup(dir); }
});

test('getRelevant returns entries for .sql files', () => {
  const dir = makeTempDir();
  try {
    initLibrary(dir);
    const results = getRelevant(dir, 'db/schema.sql');
    assert(results.length > 0, 'Should find relevant entries for .sql');
    assert(results.some(e => e.category === 'database'), 'Should include database entries');
  } finally { cleanup(dir); }
});

test('getRelevant returns entries for test files', () => {
  const dir = makeTempDir();
  try {
    initLibrary(dir);
    const results = getRelevant(dir, 'tests/app.test.js');
    assert(results.some(e => e.category === 'testing'), 'Should include testing entries');
  } finally { cleanup(dir); }
});

test('getRelevant handles empty path', () => {
  const dir = makeTempDir();
  try {
    initLibrary(dir);
    const results = getRelevant(dir, '');
    assert(results.length === 0);
  } finally { cleanup(dir); }
});

test('getRelevant returns entries for API files', () => {
  const dir = makeTempDir();
  try {
    initLibrary(dir);
    const results = getRelevant(dir, 'src/api/routes.ts');
    assert(results.some(e => e.category === 'api-design'), 'Should include api-design');
  } finally { cleanup(dir); }
});

// ═══════════════════════════════════════════════════════════════
// 10. importFromUrl
// ═══════════════════════════════════════════════════════════════

test('importFromUrl returns placeholder', () => {
  const result = importFromUrl('/tmp', 'https://example.com');
  assert(result.status === 'requires_research_agent', 'Should return placeholder');
});

// ═══════════════════════════════════════════════════════════════
// 11. exportLibrary
// ═══════════════════════════════════════════════════════════════

test('exportLibrary returns all categories', () => {
  const dir = makeTempDir();
  try {
    initLibrary(dir);
    const data = exportLibrary(dir);
    assert(data.categories === 14, 'Expected 14 categories');
    assert(data.total_entries > 40, 'Expected 40+ entries');
    assert(typeof data.entries === 'object', 'entries should be object');
  } finally { cleanup(dir); }
});

test('exportLibrary entries match categories', () => {
  const dir = makeTempDir();
  try {
    initLibrary(dir);
    const data = exportLibrary(dir);
    for (const cat of LIBRARY_CATEGORIES) {
      assert(cat in data.entries, 'Missing category: ' + cat);
    }
  } finally { cleanup(dir); }
});

// ═══════════════════════════════════════════════════════════════
// 12. getEntries with filter
// ═══════════════════════════════════════════════════════════════

test('getEntries with filter narrows results', () => {
  const dir = makeTempDir();
  try {
    initLibrary(dir);
    const all = getEntries(dir, 'security');
    const filtered = getEntries(dir, 'security', 'secrets');
    assert(filtered.length < all.length, 'Filter should narrow results');
    assert(filtered.length >= 1, 'Should find at least 1');
  } finally { cleanup(dir); }
});

test('getEntries returns empty for invalid category', () => {
  const dir = makeTempDir();
  try {
    initLibrary(dir);
    const entries = getEntries(dir, 'nonexistent');
    assert(entries.length === 0, 'Should return empty');
  } finally { cleanup(dir); }
});

test('getEntries returns empty for uninitialized library', () => {
  const dir = makeTempDir();
  try {
    const entries = getEntries(dir, 'security');
    assert(entries.length === 0, 'Should return empty');
  } finally { cleanup(dir); }
});

// ═══════════════════════════════════════════════════════════════
// 13. Edge cases
// ═══════════════════════════════════════════════════════════════

test('addEntry works on empty library (no init)', () => {
  const dir = makeTempDir();
  try {
    const result = addEntry(dir, { id: 'edge-001', title: 'Edge', category: 'security', description: 'test' });
    assert(result.success === true, 'Should create file and add');
    const entries = getEntries(dir, 'security');
    assert(entries.length === 1);
  } finally { cleanup(dir); }
});

test('Multiple adds increase count', () => {
  const dir = makeTempDir();
  try {
    initLibrary(dir);
    const before = getEntries(dir, 'testing').length;
    addEntry(dir, { id: 'multi-001', title: 'M1', category: 'testing' });
    addEntry(dir, { id: 'multi-002', title: 'M2', category: 'testing' });
    const after = getEntries(dir, 'testing').length;
    assert(after === before + 2, 'Expected + 2');
  } finally { cleanup(dir); }
});

test('Remove then add same ID works', () => {
  const dir = makeTempDir();
  try {
    initLibrary(dir);
    removeEntry(dir, 'security', 'sec-001');
    const result = addEntry(dir, { id: 'sec-001', title: 'Re-added', category: 'security' });
    assert(result.success === true, 'Should allow re-add after remove');
  } finally { cleanup(dir); }
});

test('searchLibrary finds by description keyword', () => {
  const dir = makeTempDir();
  try {
    initLibrary(dir);
    const results = searchLibrary(dir, 'parameterised');
    assert(results.length >= 1, 'Should find parameterised queries entry');
  } finally { cleanup(dir); }
});

test('getRelevant for .md returns documentation entries', () => {
  const dir = makeTempDir();
  try {
    initLibrary(dir);
    const results = getRelevant(dir, 'README.md');
    assert(results.some(e => e.category === 'documentation'), 'Should include documentation');
  } finally { cleanup(dir); }
});

// ═══════════════════════════════════════════════════════════════
// 14. Module structure
// ═══════════════════════════════════════════════════════════════

test('Module exports all required functions', () => {
  const lib = require(path.join(__dirname, '..', 'hooks', 'ezra-library.js'));
  const required = ['LIBRARY_CATEGORIES', 'ENTRY_SCHEMA', 'initLibrary', 'getCategories', 'getEntries', 'addEntry', 'removeEntry', 'searchLibrary', 'getRelevant', 'importFromUrl', 'exportLibrary'];
  for (const name of required) {
    assert(name in lib, 'Missing export: ' + name);
  }
});

test('Module exports serializeEntry and parseEntries', () => {
  const lib = require(path.join(__dirname, '..', 'hooks', 'ezra-library.js'));
  assert(typeof lib.serializeEntry === 'function');
  assert(typeof lib.parseEntries === 'function');
  assert(typeof lib.serializeEntries === 'function');
});

// ═══════════════════════════════════════════════════════════════
// 15. Settings integration
// ═══════════════════════════════════════════════════════════════

test('Settings DEFAULTS includes library section', () => {
  const settings = require(path.join(__dirname, '..', 'hooks', 'ezra-settings.js'));
  assert(settings.DEFAULTS.library, 'library section missing from DEFAULTS');
  assert(settings.DEFAULTS.library.research_enabled === true);
  assert(settings.DEFAULTS.library.update_frequency === 'weekly');
  assert(Array.isArray(settings.DEFAULTS.library.sources_whitelist));
});

test('getLibrary accessor works', () => {
  const settings = require(path.join(__dirname, '..', 'hooks', 'ezra-settings.js'));
  assert(typeof settings.getLibrary === 'function');
  const dir = makeTempDir();
  try {
    const lib = settings.getLibrary(dir);
    assert(lib.research_enabled === true);
  } finally { cleanup(dir); }
});

// ═══════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════

console.log('  V6-Library: ' + passed + ' passed, ' + failed + ' failed');
console.log('  V6-Library: PASSED: ' + passed + ' FAILED: ' + failed);
process.exit(failed > 0 ? 1 : 0);
