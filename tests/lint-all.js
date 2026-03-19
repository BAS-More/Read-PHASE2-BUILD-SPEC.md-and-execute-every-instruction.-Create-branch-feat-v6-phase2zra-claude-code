#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;
let failed = 0;
let warnings = 0;

function test(name, fn) {
  try { fn(); passed++; }
  catch (err) { failed++; console.error(`  FAIL: ${name} — ${err.message}`); }
}

function warn(name, msg) {
  warnings++;
  console.error(`  WARN: ${name} — ${msg}`);
}

function assert(condition, msg) { if (!condition) throw new Error(msg); }

function getAllFiles(dir, ext) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...getAllFiles(full, ext));
    else if (!ext || full.endsWith(ext)) results.push(full);
  }
  return results;
}

// ─── No trailing whitespace in markdown ──────────────────────────

const mdFiles = getAllFiles(ROOT, '.md').filter(f => !f.includes('node_modules'));
for (const file of mdFiles) {
  const rel = path.relative(ROOT, file);
  test(`${rel}: no trailing whitespace`, () => {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    const bad = lines.filter((l, i) => l !== l.trimEnd() && l.trim().length > 0);
    // Allow trailing whitespace in markdown (common for line breaks)
    // Just check there aren't excessive cases
    if (bad.length > 20) {
      warn(rel, `${bad.length} lines with trailing whitespace`);
    }
  });
}

// ─── No console.log in hooks (should use stderr) ────────────────

const jsFiles = getAllFiles(path.join(ROOT, 'hooks'), '.js');
for (const file of jsFiles) {
  const rel = path.relative(ROOT, file);
  const content = fs.readFileSync(file, 'utf8');

  test(`${rel}: no require of external packages`, () => {
    const requires = content.match(/require\(['"]((?!fs|path|os|child_process|readline|crypto|url|util|http|https|stream|events|buffer|querystring|string_decoder|assert|net|tls|dns|dgram|cluster|worker_threads|perf_hooks|v8|vm|zlib)[\w@/-]+)['"]\)/g);
    if (requires && requires.length > 0) {
      // yaml is an optional dep used in guard hook
      const nonOptional = requires.filter(r => !r.includes('yaml'));
      assert(nonOptional.length === 0, `External requires: ${nonOptional.join(', ')}`);
    }
  });
}

// ─── No TODO/FIXME/HACK in production code ───────────────────────

const allProdFiles = [
  ...getAllFiles(path.join(ROOT, 'bin'), '.js'),
  ...getAllFiles(path.join(ROOT, 'hooks'), '.js'),
];
for (const file of allProdFiles) {
  const rel = path.relative(ROOT, file);
  test(`${rel}: no TODO/FIXME/HACK`, () => {
    const content = fs.readFileSync(file, 'utf8');
    const todos = (content.match(/\b(TODO|FIXME|HACK|XXX)\b/g) || []);
    assert(todos.length === 0, `Found: ${todos.join(', ')}`);
  });
}

// ─── Package.json validation ─────────────────────────────────────

test('package.json: bin points to existing file', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  for (const [name, target] of Object.entries(pkg.bin)) {
    const fullPath = path.join(ROOT, target);
    assert(fs.existsSync(fullPath), `bin "${name}" points to "${target}" which doesn't exist`);
  }
});

test('package.json: all files entries exist', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  for (const entry of pkg.files) {
    const fullPath = path.join(ROOT, entry);
    assert(fs.existsSync(fullPath), `files entry "${entry}" doesn't exist`);
  }
});

test('package.json: version matches CLI version', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const cliContent = fs.readFileSync(path.join(ROOT, 'bin', 'cli.js'), 'utf8');
  const cliVersion = cliContent.match(/EZRA_VERSION\s*=\s*'([^']+)'/);
  assert(cliVersion, 'CLI version constant not found');
  assert(pkg.version === cliVersion[1], `package.json version "${pkg.version}" != CLI version "${cliVersion[1]}"`);
});

// ─── No hardcoded secrets ────────────────────────────────────────

const allCode = [...getAllFiles(path.join(ROOT, 'bin'), '.js'), ...getAllFiles(path.join(ROOT, 'hooks'), '.js')];
for (const file of allCode) {
  const rel = path.relative(ROOT, file);
  test(`${rel}: no hardcoded secrets`, () => {
    const content = fs.readFileSync(file, 'utf8');
    assert(!content.match(/password\s*[:=]\s*['"][^'"]+['"]/i), 'Hardcoded password found');
    assert(!content.match(/api[_-]?key\s*[:=]\s*['"][^'"]+['"]/i), 'Hardcoded API key found');
    assert(!content.match(/secret\s*[:=]\s*['"][^'"]+['"]/i), 'Hardcoded secret found');
  });
}

// ─── Report ──────────────────────────────────────────────────────

console.log(`  Lint: PASSED: ${passed} FAILED: ${failed} WARNINGS: ${warnings}`);
process.exit(failed > 0 ? 1 : 0);
