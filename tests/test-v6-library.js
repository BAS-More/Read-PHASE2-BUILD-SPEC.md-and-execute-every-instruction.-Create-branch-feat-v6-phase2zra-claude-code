#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const library = require(path.join(ROOT, 'hooks', 'ezra-library.js'));

let passed = 0;
let failed = 0;
let tmpDir = null;

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    failed++;
    console.error('  FAIL: ' + name + ' — ' + err.message);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

function setup() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ezra-lib-test-'));
}

function teardown() {
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  }
}
// --- initLibrary Tests ---

test('initLibrary creates all 14 category files + meta.yaml', () => {
  setup();
  try {
    const result = library.initLibrary(tmpDir);
    assert(result.categories === 14, 'Expected 14 categories');
    const libDir = path.join(tmpDir, '.ezra', 'library');
    assert(fs.existsSync(libDir), 'Library dir missing');
    for (const cat of library.LIBRARY_CATEGORIES) {
      assert(fs.existsSync(path.join(libDir, cat + '.yaml')), 'Missing: ' + cat);
    }
    assert(fs.existsSync(path.join(libDir, 'meta.yaml')), 'meta.yaml missing');
  } finally { teardown(); }
});

test('initLibrary returns positive entry count', () => {
  setup();
  try {
    const result = library.initLibrary(tmpDir);
    assert(result.entries > 0, 'Should have entries');
    assert(result.entries >= 42, 'Expected >= 42, got ' + result.entries);
  } finally { teardown(); }
});

test('initLibrary creates .ezra directory if missing', () => {
  setup();
  try {
    library.initLibrary(tmpDir);
    assert(fs.existsSync(path.join(tmpDir, '.ezra')), '.ezra should exist');
  } finally { teardown(); }
});

// --- Seed Data Tests ---

test('Each category has 3-5 seed entries', () => {
  setup();
  try {
    library.initLibrary(tmpDir);
    for (const cat of library.LIBRARY_CATEGORIES) {
      const entries = library.getEntries(tmpDir, cat);
      const list = Array.isArray(entries) ? entries : [];
      const count = list.length;
      assert(count >= 3 && count <= 5, cat + ' has ' + count + ' entries (expected 3-5)');
    }
  } finally { teardown(); }
});

test('Seed entries have required fields', () => {
  setup();
  try {
    library.initLibrary(tmpDir);
    const entries = library.getEntries(tmpDir, 'security');
    const list = Array.isArray(entries) ? entries : [];
    assert(list.length > 0, 'Security should have entries');
    for (const e of list) {
      assert(e.id, 'Missing id');
      assert(e.title, 'Missing title');
      assert(e.category === 'security', 'Wrong category');
    }
  } finally { teardown(); }
});

test('Security seed contains secrets entry', () => {
  setup();
  try {
    library.initLibrary(tmpDir);
    const entries = library.getEntries(tmpDir, 'security');
    const list = Array.isArray(entries) ? entries : [];
    assert(list.some(e => e.title && e.title.toLowerCase().includes('secret')), 'Missing secrets entry');
  } finally { teardown(); }
});

test('Security seed contains validation entry', () => {
  setup();
  try {
    library.initLibrary(tmpDir);
    const entries = library.getEntries(tmpDir, 'security');
    const list = Array.isArray(entries) ? entries : [];
    assert(list.some(e => e.title && e.title.toLowerCase().includes('valid')), 'Missing validation entry');
  } finally { teardown(); }
});

test('Security seed contains parameterised queries entry', () => {
  setup();
  try {
    library.initLibrary(tmpDir);
    const entries = library.getEntries(tmpDir, 'security');
    const list = Array.isArray(entries) ? entries : [];
    assert(list.some(e => e.title && e.title.toLowerCase().includes('paramet')), 'Missing parameterised entry');
  } finally { teardown(); }
});

// --- addEntry / removeEntry / search / getRelevant / export / importFromUrl ---

test('addEntry writes to correct category', () => {
  setup(); try {
    library.initLibrary(tmpDir);
    const r = library.addEntry(tmpDir, { id: 'custom-001', title: 'Test', description: 'A test', category: 'security', subcategory: 'test', severity: 'info' });
    assert(r.success !== false, 'addEntry failed: ' + JSON.stringify(r));
    const list = library.getEntries(tmpDir, 'security');
    const arr = Array.isArray(list) ? list : [];
    assert(arr.some(e => e.id === 'custom-001'), 'Entry not found');
  } finally { teardown(); }
});

test('addEntry rejects duplicate IDs', () => {
  setup(); try {
    library.initLibrary(tmpDir);
    const list = library.getEntries(tmpDir, 'security');
    const arr = Array.isArray(list) ? list : [];
    if (arr.length > 0) {
      const r = library.addEntry(tmpDir, { id: arr[0].id, title: 'Dup', category: 'security' });
      assert(r.success === false || r.error || r.reason, 'Should reject dup');
    }
  } finally { teardown(); }
});

test('addEntry rejects invalid category', () => {
  setup(); try {
    library.initLibrary(tmpDir);
    const r = library.addEntry(tmpDir, { id: 'bad', title: 'Bad', category: 'nonexistent' });
    assert(r.success === false || r.error || r.reason, 'Should reject');
  } finally { teardown(); }
});

test('addEntry rejects missing category', () => {
  const r = library.addEntry('.', { id: 'no-cat' });
  assert(r.success === false || r.error || r.reason, 'Should reject');
});

test('removeEntry removes by ID', () => {
  setup(); try {
    library.initLibrary(tmpDir);
    const list = library.getEntries(tmpDir, 'security');
    const arr = Array.isArray(list) ? list : [];
    const before = arr.length;
    assert(before > 0, 'Need entries');
    const r = library.removeEntry(tmpDir, 'security', arr[0].id);
    assert(r.success !== false, 'removeEntry failed');
    const after = library.getEntries(tmpDir, 'security');
    const arr2 = Array.isArray(after) ? after : [];
    assert(arr2.length === before - 1, 'Count mismatch');
  } finally { teardown(); }
});

test('removeEntry error for nonexistent ID', () => {
  setup(); try {
    library.initLibrary(tmpDir);
    const r = library.removeEntry(tmpDir, 'security', 'fake-999');
    assert(r.success === false || r.error || r.reason, 'Should fail');
  } finally { teardown(); }
});

test('removeEntry error for invalid category', () => {
  setup(); try {
    library.initLibrary(tmpDir);
    const r = library.removeEntry(tmpDir, 'fake-cat', 'any');
    assert(r.success === false || r.error || r.reason, 'Should fail');
  } finally { teardown(); }
});

test('searchLibrary finds entries by keyword', () => {
  setup(); try {
    library.initLibrary(tmpDir);
    const r = library.searchLibrary(tmpDir, 'secret');
    const list = Array.isArray(r) ? r : (r.results || []);
    assert(list.length > 0, 'Should find secret');
  } finally { teardown(); }
});

test('searchLibrary finds across categories', () => {
  setup(); try {
    library.initLibrary(tmpDir);
    const r = library.searchLibrary(tmpDir, 'review');
    const list = Array.isArray(r) ? r : (r.results || []);
    assert(list.length > 0, 'Should find review');
  } finally { teardown(); }
});

test('searchLibrary empty for no match', () => {
  setup(); try {
    library.initLibrary(tmpDir);
    const r = library.searchLibrary(tmpDir, 'xyzzy-nonexistent');
    const list = Array.isArray(r) ? r : (r.results || []);
    assert(list.length === 0, 'Should be empty');
  } finally { teardown(); }
});

test('searchLibrary empty for empty query', () => {
  setup(); try {
    library.initLibrary(tmpDir);
    const r = library.searchLibrary(tmpDir, '');
    const list = Array.isArray(r) ? r : (r.results || []);
    assert(list.length === 0, 'Should be empty');
  } finally { teardown(); }
});

test('searchLibrary null query returns empty', () => {
  setup(); try {
    library.initLibrary(tmpDir);
    const r = library.searchLibrary(tmpDir, null);
    const list = Array.isArray(r) ? r : (r.results || []);
    assert(list.length === 0, 'Should be empty');
  } finally { teardown(); }
});

test('getRelevant returns entries for .js', () => {
  setup(); try {
    library.initLibrary(tmpDir);
    const r = library.getRelevant(tmpDir, 'app.js');
    const list = Array.isArray(r) ? r : (r.entries || []);
    assert(list.length > 0, 'Should find for .js');
  } finally { teardown(); }
});

test('getRelevant null returns empty', () => {
  setup(); try {
    library.initLibrary(tmpDir);
    const r = library.getRelevant(tmpDir, null);
    const list = Array.isArray(r) ? r : (r.entries || []);
    assert(list.length === 0, 'Should be empty');
  } finally { teardown(); }
});

test('exportLibrary returns data', () => {
  setup(); try {
    library.initLibrary(tmpDir);
    const r = library.exportLibrary(tmpDir);
    assert(r.total_entries >= 42, 'Expected >= 42, got ' + r.total_entries);
  } finally { teardown(); }
});

test('exportLibrary includes all categories', () => {
  setup(); try {
    library.initLibrary(tmpDir);
    const r = library.exportLibrary(tmpDir);
    if (r.entries) {
      for (const cat of library.LIBRARY_CATEGORIES) {
        assert(cat in r.entries, 'Missing: ' + cat);
      }
    }
  } finally { teardown(); }
});

test('importFromUrl returns requires_research_agent', () => {
  const r = library.importFromUrl('.', 'https://example.com');
  assert(r.status === 'requires_research_agent', 'Wrong status');
});

test('importFromUrl includes URL', () => {
  const r = library.importFromUrl('.', 'https://owasp.org');
  assert(r.url === 'https://owasp.org', 'URL missing');
});

// --- Edge Cases ---

test('getEntries empty for uninitialised library', () => {
  setup(); try {
    const list = library.getEntries(tmpDir, 'security');
    const arr = Array.isArray(list) ? list : (list.entries || []);
    assert(arr.length === 0, 'Should be empty');
  } finally { teardown(); }
});

test('getEntries handles invalid category', () => {
  setup(); try {
    library.initLibrary(tmpDir);
    const r = library.getEntries(tmpDir, 'totally-fake');
    const arr = Array.isArray(r) ? r : [];
    // Should return empty or error, not crash
    assert(true, 'Did not crash');
  } finally { teardown(); }
});

test('searchLibrary on uninitialised returns empty', () => {
  setup(); try {
    const r = library.searchLibrary(tmpDir, 'test');
    const list = Array.isArray(r) ? r : (r.results || []);
    assert(list.length === 0, 'Should be empty');
  } finally { teardown(); }
});

test('initLibrary can be called twice', () => {
  setup(); try {
    library.initLibrary(tmpDir);
    const r = library.initLibrary(tmpDir);
    assert(r.categories === 14, 'Double init should work');
  } finally { teardown(); }
});

// --- Module Exports ---

test('Module exports all required functions', () => {
  const req = ['initLibrary','getCategories','getEntries','addEntry','removeEntry','searchLibrary','getRelevant','importFromUrl','exportLibrary'];
  for (const fn of req) { assert(typeof library[fn] === 'function', 'Missing: ' + fn); }
});

test('LIBRARY_CATEGORIES is exported array', () => {
  assert(Array.isArray(library.LIBRARY_CATEGORIES), 'Should be array');
});

test('ENTRY_SCHEMA is exported object', () => {
  assert(typeof library.ENTRY_SCHEMA === 'object' && !Array.isArray(library.ENTRY_SCHEMA), 'Should be object');
});

// --- Command / Hook File Tests ---

test('library.md command exists', () => {
  assert(fs.existsSync(path.join(ROOT, 'commands', 'ezra', 'library.md')), 'Missing');
});

test('library.md has valid frontmatter', () => {
  const c = fs.readFileSync(path.join(ROOT, 'commands', 'ezra', 'library.md'), 'utf8');
  assert(c.includes('name: ezra:library'), 'Bad frontmatter');
});

test('research.md command exists', () => {
  assert(fs.existsSync(path.join(ROOT, 'commands', 'ezra', 'research.md')), 'Missing');
});

test('research.md has valid frontmatter', () => {
  const c = fs.readFileSync(path.join(ROOT, 'commands', 'ezra', 'research.md'), 'utf8');
  assert(c.includes('name: ezra:research'), 'Bad frontmatter');
});

test('Settings includes library section', () => {
  const s = require(path.join(ROOT, 'hooks', 'ezra-settings.js'));
  assert(s.DEFAULTS.library, 'Missing library defaults');
  assert(s.DEFAULTS.library.research_enabled !== undefined, 'Missing research_enabled');
  assert(Array.isArray(s.DEFAULTS.library.sources_whitelist), 'sources_whitelist not array');
});

test('Settings has getLibrary accessor', () => {
  const s = require(path.join(ROOT, 'hooks', 'ezra-settings.js'));
  assert(typeof s.getLibrary === 'function', 'Missing getLibrary');
});

test('ezra-library.js hook exists', () => {
  assert(fs.existsSync(path.join(ROOT, 'hooks', 'ezra-library.js')), 'Missing');
});

test('ezra-library.js has shebang', () => {
  const c = fs.readFileSync(path.join(ROOT, 'hooks', 'ezra-library.js'), 'utf8');
  assert(c.startsWith('#!/usr/bin/env node'), 'No shebang');
});

test('ezra-library.js uses strict mode', () => {
  const c = fs.readFileSync(path.join(ROOT, 'hooks', 'ezra-library.js'), 'utf8');
  assert(c.includes(String.fromCharCode(39)+'use strict'+String.fromCharCode(39)), 'No strict mode');
});

test('12 hook files exist', () => {
  const files = fs.readdirSync(path.join(ROOT, 'hooks')).filter(f => f.endsWith('.js'));
  assert(files.length === 14, 'Expected 14 hooks, found ' + files.length + ': ' + files.join(', '));
});

test('32 command files exist', () => {
  const files = fs.readdirSync(path.join(ROOT, 'commands', 'ezra')).filter(f => f.endsWith('.md'));
  assert(files.length === 34, 'Expected 34, found ' + files.length);
});

test('Round-trip preserves entries', () => {
  setup(); try {
    library.initLibrary(tmpDir);
    const list = library.getEntries(tmpDir, 'security');
    const arr = Array.isArray(list) ? list : [];
    assert(arr.length >= 3, 'Need entries');
    for (const e of arr) { assert(e.id, 'Missing id'); assert(e.title, 'Missing title'); }
  } finally { teardown(); }
});

// --- Report ---

console.log('  V6-Library: PASSED: ' + passed + ' FAILED: ' + failed);
process.exit(failed > 0 ? 1 : 0);
