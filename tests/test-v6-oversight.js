#!/usr/bin/env node
'use strict';

/**
 * EZRA V6 Oversight & Settings Tests
 *
 * Comprehensive tests for:
 * - parseValue (booleans, null, integers, floats, quoted strings, inline arrays/objects)
 * - parseYamlSimple (sections, key-values, comments, blank lines)
 * - deepMerge (nested objects, array replacement)
 * - DEFAULTS validation
 * - loadSettings with temp directories
 * - Section accessors
 * - Oversight hook: runChecks, decide, matchGlob, logViolations
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const settings = require(path.resolve(__dirname, '..', 'hooks', 'ezra-settings.js'));
const oversight = require(path.resolve(__dirname, '..', 'hooks', 'ezra-oversight.js'));

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); passed++; }
  catch (err) { failed++; console.error(`  FAIL: ${name} — ${err.message}`); }
}

function assert(condition, msg) { if (!condition) throw new Error(msg); }

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ezra-v6-test-'));
}

function rmDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

// ═══════════════════════════════════════════════════════════════════
// parseValue Tests
// ═══════════════════════════════════════════════════════════════════

test('parseValue: true', () => {
  assert(settings.parseValue('true') === true, 'true failed');
});

test('parseValue: false', () => {
  assert(settings.parseValue('false') === false, 'false failed');
});

test('parseValue: null', () => {
  assert(settings.parseValue('null') === null, 'null failed');
});

test('parseValue: tilde null', () => {
  assert(settings.parseValue('~') === null, 'tilde failed');
});

test('parseValue: empty string', () => {
  assert(settings.parseValue('') === null, 'empty string failed');
});

test('parseValue: integer', () => {
  assert(settings.parseValue('42') === 42, 'integer failed');
});

test('parseValue: negative integer', () => {
  assert(settings.parseValue('-7') === -7, 'negative int failed');
});

test('parseValue: float', () => {
  assert(settings.parseValue('3.14') === 3.14, 'float failed');
});

test('parseValue: negative float', () => {
  assert(settings.parseValue('-0.5') === -0.5, 'negative float failed');
});

test('parseValue: double-quoted string', () => {
  assert(settings.parseValue('"hello world"') === 'hello world', 'double quote failed');
});

test('parseValue: single-quoted string', () => {
  assert(settings.parseValue("'foo'") === 'foo', 'single quote failed');
});

test('parseValue: plain string', () => {
  assert(settings.parseValue('camelCase') === 'camelCase', 'plain string failed');
});

test('parseValue: inline array', () => {
  const result = settings.parseValue('[a, b, c]');
  assert(Array.isArray(result), 'not array');
  assert(result.length === 3, `length ${result.length}`);
  assert(result[0] === 'a', 'first element');
  assert(result[2] === 'c', 'third element');
});

test('parseValue: empty inline array', () => {
  const result = settings.parseValue('[]');
  assert(Array.isArray(result), 'not array');
  assert(result.length === 0, 'not empty');
});

test('parseValue: inline array with numbers', () => {
  const result = settings.parseValue('[1, 2, 3]');
  assert(result[0] === 1, 'first not int');
  assert(result[2] === 3, 'third not int');
});

test('parseValue: inline object', () => {
  const result = settings.parseValue('{key: value, num: 42}');
  assert(typeof result === 'object', 'not object');
  assert(result.key === 'value', 'key wrong');
  assert(result.num === 42, 'num wrong');
});

test('parseValue: empty inline object', () => {
  const result = settings.parseValue('{}');
  assert(typeof result === 'object', 'not object');
  assert(Object.keys(result).length === 0, 'not empty');
});

test('parseValue: undefined input', () => {
  assert(settings.parseValue(undefined) === null, 'undefined failed');
});

// ═══════════════════════════════════════════════════════════════════
// parseYamlSimple Tests
// ═══════════════════════════════════════════════════════════════════

test('parseYamlSimple: flat keys', () => {
  const result = settings.parseYamlSimple('name: ezra\nversion: 6');
  assert(result.name === 'ezra', 'name wrong');
  assert(result.version === 6, 'version wrong');
});

test('parseYamlSimple: section with nested keys', () => {
  const yaml = `oversight:\n  enabled: true\n  level: warn\n  threshold: 75`;
  const result = settings.parseYamlSimple(yaml);
  assert(result.oversight.enabled === true, 'enabled');
  assert(result.oversight.level === 'warn', 'level');
  assert(result.oversight.threshold === 75, 'threshold');
});

test('parseYamlSimple: comments and blank lines', () => {
  const yaml = `# This is a comment\nkey: value\n\n# Another comment\nkey2: 42`;
  const result = settings.parseYamlSimple(yaml);
  assert(result.key === 'value', 'key');
  assert(result.key2 === 42, 'key2');
});

test('parseYamlSimple: list items', () => {
  const yaml = `items:\n  - alpha\n  - beta\n  - gamma`;
  const result = settings.parseYamlSimple(yaml);
  assert(Array.isArray(result.items), 'not array');
  assert(result.items.length === 3, `length ${result.items.length}`);
  assert(result.items[0] === 'alpha', 'first');
  assert(result.items[2] === 'gamma', 'third');
});

test('parseYamlSimple: multiple sections', () => {
  const yaml = `standards:\n  strict: true\nsecurity:\n  profile: standard`;
  const result = settings.parseYamlSimple(yaml);
  assert(result.standards.strict === true, 'standards');
  assert(result.security.profile === 'standard', 'security');
});

test('parseYamlSimple: empty input', () => {
  const result = settings.parseYamlSimple('');
  assert(Object.keys(result).length === 0, 'not empty');
});

// ═══════════════════════════════════════════════════════════════════
// deepMerge Tests
// ═══════════════════════════════════════════════════════════════════

test('deepMerge: simple merge', () => {
  const result = settings.deepMerge({ a: 1 }, { b: 2 });
  assert(result.a === 1, 'a missing');
  assert(result.b === 2, 'b missing');
});

test('deepMerge: nested objects', () => {
  const result = settings.deepMerge(
    { outer: { a: 1, b: 2 } },
    { outer: { b: 3, c: 4 } }
  );
  assert(result.outer.a === 1, 'a lost');
  assert(result.outer.b === 3, 'b not overridden');
  assert(result.outer.c === 4, 'c missing');
});

test('deepMerge: array replacement', () => {
  const result = settings.deepMerge(
    { items: [1, 2, 3] },
    { items: [4, 5] }
  );
  assert(result.items.length === 2, 'array not replaced');
  assert(result.items[0] === 4, 'first wrong');
});

test('deepMerge: source does not mutate target', () => {
  const target = { x: { y: 1 } };
  const source = { x: { z: 2 } };
  const result = settings.deepMerge(target, source);
  assert(target.x.z === undefined, 'target mutated');
  assert(result.x.y === 1, 'y lost');
  assert(result.x.z === 2, 'z missing');
});

test('deepMerge: empty source', () => {
  const result = settings.deepMerge({ a: 1 }, {});
  assert(result.a === 1, 'a lost');
});

test('deepMerge: empty target', () => {
  const result = settings.deepMerge({}, { a: 1 });
  assert(result.a === 1, 'a missing');
});

// ═══════════════════════════════════════════════════════════════════
// DEFAULTS Validation
// ═══════════════════════════════════════════════════════════════════

test('DEFAULTS has all sections', () => {
  const d = settings.DEFAULTS;
  assert(d.standards, 'standards missing');
  assert(d.security, 'security missing');
  assert(d.oversight, 'oversight missing');
  assert(d.best_practices, 'best_practices missing');
  assert(d.workflows, 'workflows missing');
});

test('DEFAULTS oversight has correct defaults', () => {
  const o = settings.DEFAULTS.oversight;
  assert(o.enabled === true, 'enabled');
  assert(o.level === 'gate', 'level');
  assert(o.health_threshold === 75, 'threshold');
  assert(o.auto_pause_on_critical === true, 'auto_pause');
  assert(o.review_every_n_files === 5, 'review_every');
  assert(Array.isArray(o.excluded_paths), 'excluded_paths not array');
  assert(o.excluded_paths.length === 4, 'excluded_paths count');
  assert(Array.isArray(o.notify_on), 'notify_on not array');
});

test('DEFAULTS standards has correct defaults', () => {
  const s = settings.DEFAULTS.standards;
  assert(s.typescript_strict === true, 'ts strict');
  assert(s.no_any === true, 'no_any');
  assert(s.max_complexity === 10, 'max_complexity');
  assert(s.test_coverage_minimum === 80, 'coverage');
});

test('getDefault returns deep clone', () => {
  const d1 = settings.getDefault();
  const d2 = settings.getDefault();
  d1.oversight.level = 'strict';
  assert(d2.oversight.level === 'gate', 'not a deep clone');
});

// ═══════════════════════════════════════════════════════════════════
// loadSettings Tests (with temp directories)
// ═══════════════════════════════════════════════════════════════════

test('loadSettings: defaults when no settings file', () => {
  const tmpDir = makeTempDir();
  try {
    const s = settings.loadSettings(tmpDir);
    assert(s.oversight.level === 'gate', 'default level');
    assert(s.standards.no_any === true, 'default no_any');
  } finally {
    rmDir(tmpDir);
  }
});

test('loadSettings: merge when file exists', () => {
  const tmpDir = makeTempDir();
  const ezraDir = path.join(tmpDir, '.ezra');
  fs.mkdirSync(ezraDir, { recursive: true });
  fs.writeFileSync(path.join(ezraDir, 'settings.yaml'), [
    'oversight:',
    '  level: strict',
    '  health_threshold: 90',
    'standards:',
    '  max_complexity: 15',
  ].join('\n'));
  try {
    const s = settings.loadSettings(tmpDir);
    assert(s.oversight.level === 'strict', 'level not overridden');
    assert(s.oversight.health_threshold === 90, 'threshold not overridden');
    assert(s.oversight.enabled === true, 'enabled default lost');
    assert(s.standards.max_complexity === 15, 'complexity not overridden');
    assert(s.standards.no_any === true, 'no_any default lost');
  } finally {
    rmDir(tmpDir);
  }
});

test('loadSettings: handles malformed file gracefully', () => {
  const tmpDir = makeTempDir();
  const ezraDir = path.join(tmpDir, '.ezra');
  fs.mkdirSync(ezraDir, { recursive: true });
  fs.writeFileSync(path.join(ezraDir, 'settings.yaml'), '{{invalid yaml{{');
  try {
    const s = settings.loadSettings(tmpDir);
    // Should return defaults on parse error
    assert(s.oversight.level === 'gate', 'fallback failed');
  } finally {
    rmDir(tmpDir);
  }
});

// ═══════════════════════════════════════════════════════════════════
// Section Accessors
// ═══════════════════════════════════════════════════════════════════

test('getStandards returns standards section', () => {
  const tmpDir = makeTempDir();
  try {
    const s = settings.getStandards(tmpDir);
    assert(s.no_any === true, 'no_any');
    assert(s.max_complexity === 10, 'max_complexity');
  } finally {
    rmDir(tmpDir);
  }
});

test('getSecurity returns security section', () => {
  const tmpDir = makeTempDir();
  try {
    const s = settings.getSecurity(tmpDir);
    assert(s.secrets_scanning === true, 'secrets_scanning');
    assert(s.profile === 'standard', 'profile');
  } finally {
    rmDir(tmpDir);
  }
});

test('getOversight returns oversight section', () => {
  const tmpDir = makeTempDir();
  try {
    const s = settings.getOversight(tmpDir);
    assert(s.enabled === true, 'enabled');
    assert(s.level === 'gate', 'level');
  } finally {
    rmDir(tmpDir);
  }
});

test('getBestPractices returns best_practices section', () => {
  const tmpDir = makeTempDir();
  try {
    const s = settings.getBestPractices(tmpDir);
    assert(s.enabled === true, 'enabled');
    assert(s.suggest_frequency === 'always', 'frequency');
  } finally {
    rmDir(tmpDir);
  }
});

test('getWorkflows returns workflows section', () => {
  const tmpDir = makeTempDir();
  try {
    const s = settings.getWorkflows(tmpDir);
    assert(Array.isArray(s.active_templates), 'templates');
    assert(s.approval_gates === true, 'gates');
  } finally {
    rmDir(tmpDir);
  }
});

// ═══════════════════════════════════════════════════════════════════
// Oversight: matchGlob Tests
// ═══════════════════════════════════════════════════════════════════

test('matchGlob: exact match', () => {
  assert(oversight.matchGlob('src/index.ts', 'src/index.ts'), 'exact');
});

test('matchGlob: wildcard', () => {
  assert(oversight.matchGlob('src/foo.ts', 'src/*.ts'), 'wildcard');
});

test('matchGlob: double star', () => {
  assert(oversight.matchGlob('src/deep/nested/file.ts', 'src/**/*.ts'), 'double star');
});

test('matchGlob: no match', () => {
  assert(!oversight.matchGlob('lib/other.js', 'src/*.ts'), 'should not match');
});

// ═══════════════════════════════════════════════════════════════════
// Oversight: runChecks Tests
// ═══════════════════════════════════════════════════════════════════

test('runChecks: detects any type', () => {
  const tmpDir = makeTempDir();
  const ezraDir = path.join(tmpDir, '.ezra');
  fs.mkdirSync(ezraDir, { recursive: true });
  fs.writeFileSync(path.join(ezraDir, 'settings.yaml'), 'standards:\n  no_any: true');
  try {
    const content = 'const x: any = 5;\nconst y = x as any;';
    const violations = oversight.runChecks(content, 'src/foo.ts', tmpDir);
    const anyViolations = violations.filter(v => v.code === 'STD-ANY');
    assert(anyViolations.length >= 2, `Expected >=2 STD-ANY, got ${anyViolations.length}`);
  } finally {
    rmDir(tmpDir);
  }
});

test('runChecks: detects secrets (API key pattern)', () => {
  const tmpDir = makeTempDir();
  const ezraDir = path.join(tmpDir, '.ezra');
  fs.mkdirSync(ezraDir, { recursive: true });
  fs.writeFileSync(path.join(ezraDir, 'settings.yaml'), 'security:\n  secrets_scanning: true');
  try {
    const content = 'const apiKey = "FAKE_KEY_test_only_not_real_1234567890abcdef";';
    const violations = oversight.runChecks(content, 'src/config.ts', tmpDir);
    const secViolations = violations.filter(v => v.code === 'SEC-SECRETS');
    assert(secViolations.length >= 1, `Expected >=1 SEC-SECRETS, got ${secViolations.length}`);
  } finally {
    rmDir(tmpDir);
  }
});

test('runChecks: clean code produces no violations', () => {
  const tmpDir = makeTempDir();
  try {
    const content = 'const name: string = "ezra";\nfunction greet(n: string): string { return n; }';
    const violations = oversight.runChecks(content, 'src/clean.ts', tmpDir);
    assert(violations.length === 0, `Expected 0 violations, got ${violations.length}: ${violations.map(v => v.code).join(', ')}`);
  } finally {
    rmDir(tmpDir);
  }
});

test('runChecks: detects complexity', () => {
  const tmpDir = makeTempDir();
  const ezraDir = path.join(tmpDir, '.ezra');
  fs.mkdirSync(ezraDir, { recursive: true });
  fs.writeFileSync(path.join(ezraDir, 'settings.yaml'), 'standards:\n  max_complexity: 3');
  try {
    // 5 nested blocks: exceeds max of 3
    const content = 'if (a) {\n  if (b) {\n    if (c) {\n      if (d) {\n        if (e) {\n        }\n      }\n    }\n  }\n}';
    const violations = oversight.runChecks(content, 'src/deep.ts', tmpDir);
    const complex = violations.filter(v => v.code === 'STD-COMPLEXITY');
    assert(complex.length >= 1, `Expected >=1 STD-COMPLEXITY, got ${complex.length}`);
  } finally {
    rmDir(tmpDir);
  }
});

test('runChecks: detects console.log in production code', () => {
  const tmpDir = makeTempDir();
  try {
    const content = 'console.log("debug info");\nconsole.debug("trace");';
    const violations = oversight.runChecks(content, 'src/service.ts', tmpDir);
    const logV = violations.filter(v => v.code === 'SEC-LOG');
    assert(logV.length >= 1, `Expected >=1 SEC-LOG, got ${logV.length}`);
  } finally {
    rmDir(tmpDir);
  }
});

test('runChecks: excludes test files from console.log check', () => {
  const tmpDir = makeTempDir();
  try {
    const content = 'console.log("test output");';
    const violations = oversight.runChecks(content, 'src/service.test.ts', tmpDir);
    const logV = violations.filter(v => v.code === 'SEC-LOG');
    assert(logV.length === 0, `Expected 0 SEC-LOG for test file, got ${logV.length}`);
  } finally {
    rmDir(tmpDir);
  }
});

test('runChecks: detects protected path violation', () => {
  const tmpDir = makeTempDir();
  const ezraDir = path.join(tmpDir, '.ezra');
  fs.mkdirSync(ezraDir, { recursive: true });
  fs.writeFileSync(path.join(ezraDir, 'settings.yaml'), '');
  fs.writeFileSync(path.join(ezraDir, 'governance.yaml'), 'protected_paths:\n  - .env*\n  - docker-compose*.yml');
  try {
    const content = 'SECRET=value';
    const violations = oversight.runChecks(content, '.env.local', tmpDir);
    const govV = violations.filter(v => v.code === 'GOV-PROTECTED');
    assert(govV.length >= 1, `Expected >=1 GOV-PROTECTED, got ${govV.length}`);
  } finally {
    rmDir(tmpDir);
  }
});

// ═══════════════════════════════════════════════════════════════════
// Oversight: decide Tests
// ═══════════════════════════════════════════════════════════════════

test('decide: monitor mode never blocks', () => {
  const violations = [{ code: 'STD-ANY', severity: 'critical', message: 'test' }];
  const result = oversight.decide(violations, 'monitor');
  assert(result.decision === 'allow', 'monitor should allow');
  assert(result.message.includes('MONITOR'), 'should have MONITOR prefix');
});

test('decide: warn mode never blocks', () => {
  const violations = [{ code: 'SEC-SECRETS', severity: 'critical', message: 'test' }];
  const result = oversight.decide(violations, 'warn');
  assert(result.decision === 'allow', 'warn should allow');
  assert(result.message.includes('WARN'), 'should have WARN prefix');
});

test('decide: gate mode blocks critical', () => {
  const violations = [{ code: 'SEC-SECRETS', severity: 'critical', message: 'secret found' }];
  const result = oversight.decide(violations, 'gate');
  assert(result.decision === 'deny', 'gate should deny critical');
  assert(result.message.includes('GATE'), 'should have GATE prefix');
});

test('decide: gate mode blocks high', () => {
  const violations = [{ code: 'STD-ANY', severity: 'high', message: 'any found' }];
  const result = oversight.decide(violations, 'gate');
  assert(result.decision === 'deny', 'gate should deny high');
});

test('decide: gate mode allows low/medium', () => {
  const violations = [{ code: 'SEC-LOG', severity: 'low', message: 'console.log' }];
  const result = oversight.decide(violations, 'gate');
  assert(result.decision === 'allow', 'gate should allow low');
});

test('decide: strict mode blocks any violation', () => {
  const violations = [{ code: 'SEC-LOG', severity: 'low', message: 'console.log' }];
  const result = oversight.decide(violations, 'strict');
  assert(result.decision === 'deny', 'strict should deny');
  assert(result.message.includes('STRICT'), 'should have STRICT prefix');
});

test('decide: no violations returns allow with empty message', () => {
  const result = oversight.decide([], 'strict');
  assert(result.decision === 'allow', 'no violations should allow');
  assert(result.message === '', 'should have empty message');
});

// ═══════════════════════════════════════════════════════════════════
// Oversight: logViolations Tests
// ═══════════════════════════════════════════════════════════════════

test('logViolations: creates log file', () => {
  const tmpDir = makeTempDir();
  const ezraDir = path.join(tmpDir, '.ezra');
  fs.mkdirSync(ezraDir, { recursive: true });
  try {
    const violations = [{ code: 'STD-ANY', severity: 'high', message: 'test violation' }];
    oversight.logViolations(tmpDir, violations, 'src/foo.ts');
    const logPath = path.join(ezraDir, 'oversight', 'violations.log');
    assert(fs.existsSync(logPath), 'log file not created');
    const content = fs.readFileSync(logPath, 'utf8');
    assert(content.includes('STD-ANY'), 'violation code missing');
    assert(content.includes('HIGH'), 'severity missing');
  } finally {
    rmDir(tmpDir);
  }
});

test('logViolations: appends to existing log', () => {
  const tmpDir = makeTempDir();
  const oversightDir = path.join(tmpDir, '.ezra', 'oversight');
  fs.mkdirSync(oversightDir, { recursive: true });
  fs.writeFileSync(path.join(oversightDir, 'violations.log'), 'existing line\n');
  try {
    const violations = [{ code: 'SEC-LOG', severity: 'low', message: 'new' }];
    oversight.logViolations(tmpDir, violations, 'src/bar.ts');
    const content = fs.readFileSync(path.join(oversightDir, 'violations.log'), 'utf8');
    assert(content.includes('existing line'), 'existing content lost');
    assert(content.includes('SEC-LOG'), 'new violation missing');
  } finally {
    rmDir(tmpDir);
  }
});

test('logViolations: no-op for empty violations', () => {
  const tmpDir = makeTempDir();
  const ezraDir = path.join(tmpDir, '.ezra');
  fs.mkdirSync(ezraDir, { recursive: true });
  try {
    oversight.logViolations(tmpDir, [], 'src/clean.ts');
    const logPath = path.join(ezraDir, 'oversight', 'violations.log');
    assert(!fs.existsSync(logPath), 'log should not be created for 0 violations');
  } finally {
    rmDir(tmpDir);
  }
});

// ═══════════════════════════════════════════════════════════════════
// Oversight: loadOversightSettings Tests
// ═══════════════════════════════════════════════════════════════════

test('loadOversightSettings: returns defaults when no file', () => {
  const tmpDir = makeTempDir();
  try {
    const o = oversight.loadOversightSettings(tmpDir);
    assert(o.enabled === true, 'enabled');
    assert(o.level === 'gate', 'level');
  } finally {
    rmDir(tmpDir);
  }
});

// ═══════════════════════════════════════════════════════════════════
// Edge Cases
// ═══════════════════════════════════════════════════════════════════

test('parseValue: handles whitespace', () => {
  assert(settings.parseValue('  true  ') === true, 'whitespace true');
  assert(settings.parseValue('  42  ') === 42, 'whitespace int');
});

test('parseYamlSimple: handles Windows line endings', () => {
  const yaml = 'key: value\r\nkey2: 42\r\n';
  const result = settings.parseYamlSimple(yaml);
  assert(result.key === 'value', 'key');
  assert(result.key2 === 42, 'key2');
});

test('runChecks: handles empty content', () => {
  const tmpDir = makeTempDir();
  try {
    const violations = oversight.runChecks('', 'src/empty.ts', tmpDir);
    assert(violations.length === 0, 'empty content should have no violations');
  } finally {
    rmDir(tmpDir);
  }
});

test('decide: handles unknown level gracefully', () => {
  const violations = [{ code: 'STD-ANY', severity: 'high', message: 'test' }];
  const result = oversight.decide(violations, 'unknown-level');
  assert(result.decision === 'allow', 'unknown level should default to allow');
});

// ═══════════════════════════════════════════════════════════════════
// Report
// ═══════════════════════════════════════════════════════════════════

console.log(`PASSED: ${passed} FAILED: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
